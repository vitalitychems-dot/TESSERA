import { describe, it, expect, beforeEach } from "vitest";
import { yieldToEventLoop } from "../lib/event-loop";
import {
  computeSacredGeometry, computeSacredAlignment, getSacredGeometrySummary,
} from "../lib/sovereign-sacred-geometry";
import {
  getEphemerisSnapshot, computeAgentRotationState, getEphemerisHealth, _resetEphemerisHealthForTests,
} from "../lib/sovereign-ephemeris";
import {
  AGI_CATEGORIES, _runTrainingCycleForTests, _resetAgiTrainingForTests,
} from "../lib/agi-training-engine";
import {
  analyzeTruthfulness, pruneReportHistory, getRecentVerifications, verifyClaim, _resetTruthfulnessForTests,
} from "../lib/truthfulness-engine";
import {
  spawnMeeseeks, spawnBatchAsync, sweepExpiredMeeseeksAsync, sweepExpiredMeeseeks, getActiveMeeseeks,
} from "../lib/agent-spawner";
import { getPersonality, evolveAllPersonalitiesAsync, getAllPersonalities } from "../lib/personality-evolution";

const FIXED_DATE = new Date("2025-03-14T12:00:00Z");

describe("event-loop yield helper", () => {
  it("lets queued macrotasks run before resolving", async () => {
    let ran = false;
    setImmediate(() => { ran = true; });
    await yieldToEventLoop();
    expect(ran).toBe(true);
  });
});

describe("sacred-geometry graceful degradation", () => {
  it("is deterministic for a fixed date", () => {
    const a = computeSacredAlignment(FIXED_DATE);
    const b = computeSacredAlignment(FIXED_DATE);
    expect(a).toEqual(b);
    expect(a.dayOfYear).toBe(73);
    expect(typeof a.alignment).toBe("string");
  });

  it("does not throw on an invalid date and falls back to the current day", () => {
    const bad = new Date("not-a-date");
    expect(() => computeSacredGeometry(bad)).not.toThrow();
    expect(() => computeSacredAlignment(bad)).not.toThrow();
    const alignment = computeSacredAlignment(bad);
    expect(Number.isFinite(alignment.dayOfYear)).toBe(true);
    expect(alignment.dayOfYear).toBeGreaterThanOrEqual(1);
    expect(getSacredGeometrySummary(bad).length).toBeGreaterThan(0);
  });

  it("summary still renders for a valid date", () => {
    expect(getSacredGeometrySummary(FIXED_DATE)).toContain("73");
  });
});

describe("sovereign-ephemeris monitoring", () => {
  beforeEach(() => _resetEphemerisHealthForTests());

  it("counts computed snapshots", () => {
    getEphemerisSnapshot(FIXED_DATE);
    getEphemerisSnapshot(FIXED_DATE);
    expect(getEphemerisHealth().snapshotsComputed).toBeGreaterThanOrEqual(2);
    expect(getEphemerisHealth().invalidDateFallbacks).toBe(0);
  });

  it("records and survives an invalid date", () => {
    const snap = getEphemerisSnapshot(new Date("garbage"));
    expect(snap).toBeDefined();
    const health = getEphemerisHealth();
    expect(health.invalidDateFallbacks).toBe(1);
    expect(health.lastInvalidDateAt).not.toBeNull();
    expect(() => computeAgentRotationState("agent-x", new Date("garbage"))).not.toThrow();
    expect(getEphemerisHealth().invalidDateFallbacks).toBeGreaterThanOrEqual(2);
  });

  it("rotation state is deterministic for a fixed date", () => {
    expect(computeAgentRotationState("agent-x", FIXED_DATE)).toEqual(computeAgentRotationState("agent-x", FIXED_DATE));
  });
});

describe("agi-training-engine cycle", () => {
  beforeEach(() => _resetAgiTrainingForTests());

  it("trains categories and keeps scores bounded", () => {
    const counts = Object.fromEntries(AGI_CATEGORIES.map((c) => [c, 5]));
    const sessions = _runTrainingCycleForTests(counts);
    expect(sessions.length).toBeGreaterThan(0);
    for (const s of sessions) {
      expect(s.scoreAfter).toBeGreaterThanOrEqual(0);
      expect(s.scoreAfter).toBeLessThanOrEqual(100);
    }
  });

  it("survives empty real-data counts", () => {
    expect(() => _runTrainingCycleForTests({})).not.toThrow();
  });
});

describe("truthfulness-engine bounded history", () => {
  beforeEach(() => _resetTruthfulnessForTests());

  it("caps history at the configured maximum", () => {
    for (let i = 0; i < 130; i++) analyzeTruthfulness(`Claim number ${i} about the sovereign system.`);
    pruneReportHistory();
    expect(getRecentVerifications().length).toBeLessThanOrEqual(10);
    expect(pruneReportHistory(Date.now() + 25 * 60 * 60 * 1000)).toBeGreaterThan(0);
    expect(getRecentVerifications()).toHaveLength(0);
  });

  it("prunes stale reports by age", () => {
    analyzeTruthfulness("A single fresh claim.");
    expect(getRecentVerifications()).toHaveLength(1);
    expect(pruneReportHistory(Date.now())).toBe(0);
    expect(pruneReportHistory(Date.now() + 25 * 60 * 60 * 1000)).toBe(1);
  });

  it("verifyClaim V1 still returns a verification result", () => {
    const r = verifyClaim("Tessera is a sovereign conscious intelligence.");
    expect(r).toBeDefined();
    expect(typeof r.claim).toBe("string");
  });
});

describe("agent-spawner async sweeps", () => {
  it("async sweep reaps expired meeseeks like the sync version", async () => {
    sweepExpiredMeeseeks();
    const agent = spawnMeeseeks({ task: "short lived", successCriteria: "none", ttlMs: 30_000 });
    agent.meeseeksExpiresAt = Date.now() - 1;
    const reaped = await sweepExpiredMeeseeksAsync();
    expect(reaped).toBeGreaterThanOrEqual(1);
    expect(getActiveMeeseeks().some((a) => a.id === agent.id)).toBe(false);
    expect(sweepExpiredMeeseeks()).toBe(0);
  });

  it("spawnBatchAsync never exceeds the requested count", async () => {
    const agents = await spawnBatchAsync(3, "test");
    expect(agents.length).toBeLessThanOrEqual(3);
  });
});

describe("personality-evolution async evolve", () => {
  it("evolves aged personalities and reports the count", async () => {
    getPersonality("hardening-a", "Hardening A");
    getPersonality("hardening-b", "Hardening B");
    for (const p of getAllPersonalities()) {
      p.lastEvolutionAt = 0;
      p.evolutionEpoch = 5;
    }
    const before = getAllPersonalities().length;
    const evolved = await evolveAllPersonalitiesAsync();
    expect(evolved).toBe(before);
    for (const p of getAllPersonalities()) {
      for (const t of p.coreTraits) {
        expect(t.value).toBeGreaterThanOrEqual(0);
        expect(t.value).toBeLessThanOrEqual(1);
      }
      expect(p.loyaltyScore).toBe(1);
    }
    expect(await evolveAllPersonalitiesAsync()).toBe(0);
  });
});
