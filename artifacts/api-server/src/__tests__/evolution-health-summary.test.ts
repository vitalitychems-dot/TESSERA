import { describe, it, expect, beforeEach } from "vitest";
import {
  getThrottleMetrics,
  recordEvolutionDeferred,
  recordEvolutionFailure,
  recordEvolutionRolledBack,
  recordEvolutionSuccess,
  pauseModule,
  _resetThrottleForTests,
} from "../lib/evolution-throttle";
import { summarizeEvolutionHealth, type EvolutionModuleCounters } from "../lib/evolution-health-summary";

function counters(moduleId: string, over: Partial<EvolutionModuleCounters> = {}): EvolutionModuleCounters {
  return {
    moduleId,
    consecutiveFailures: 0,
    totalFailures: 0,
    totalSuccesses: 0,
    totalOfflineApplied: 0,
    totalRolledBack: 0,
    totalDeferred: 0,
    cooldownRemainingMs: 0,
    paused: false,
    ...over,
  };
}

function metricsFor(id: string) {
  const m = getThrottleMetrics().modules.find(x => x.moduleId === id);
  if (!m) throw new Error(`no metrics for ${id}`);
  return m;
}

describe("throttle counters are honest", () => {
  beforeEach(() => _resetThrottleForTests());

  it("a module that only deferred has no success rate and nothing verified", () => {
    for (let i = 0; i < 5; i++) recordEvolutionDeferred("a.ts", "llm-unavailable");
    const m = metricsFor("a.ts");
    expect(m.totalDeferred).toBe(5);
    expect(m.verifiedApplied).toBe(0);
    expect(m.successRate).toBeNull();
  });

  it("deferred attempts never dilute or inflate the success rate", () => {
    recordEvolutionSuccess("a.ts", "offline");
    recordEvolutionSuccess("a.ts", "offline");
    recordEvolutionFailure("a.ts");
    for (let i = 0; i < 10; i++) recordEvolutionDeferred("a.ts", "offline-no-recipe");
    const m = metricsFor("a.ts");
    expect(m.successRate).toBe(67);
    expect(m.verifiedApplied).toBe(2);
    expect(m.totalOfflineApplied).toBe(2);
  });

  it("separates LLM-applied from offline-applied", () => {
    recordEvolutionSuccess("a.ts", "llm");
    recordEvolutionSuccess("a.ts");
    recordEvolutionSuccess("a.ts", "offline");
    const m = metricsFor("a.ts");
    expect(m.verifiedApplied).toBe(3);
    expect(m.totalOfflineApplied).toBe(1);
  });

  it("counts rollbacks", () => {
    recordEvolutionSuccess("a.ts", "offline");
    recordEvolutionRolledBack("a.ts");
    expect(metricsFor("a.ts").totalRolledBack).toBe(1);
  });
});

describe("summarizeEvolutionHealth", () => {
  const tracked = ["a.ts", "b.ts", "c.ts", "d.ts"];

  it("reports an empty system as vacuous, not as passing", () => {
    const s = summarizeEvolutionHealth([], tracked);
    expect(s.attempts).toBe(0);
    expect(s.deferredSharePct).toBeNull();
    expect(s.verifiedApplyRatePct).toBeNull();
    expect(s.gate.m3aNoCoolingModules.vacuous).toBe(true);
    expect(s.gate.m3cDeferredShare.vacuous).toBe(true);
    expect(s.gate.m3cDeferredShare.pass).toBe(false);
    expect(s.gate.meetsM3Snapshot).toBe(false);
  });

  it("fails an all-deferred system", () => {
    const s = summarizeEvolutionHealth(
      tracked.map(id => counters(id, { totalDeferred: 10 })),
      tracked,
    );
    expect(s.deferredSharePct).toBe(100);
    expect(s.totals.verifiedApplied).toBe(0);
    expect(s.gate.m3bOfflinePatchedModules.pass).toBe(false);
    expect(s.gate.m3cDeferredShare.pass).toBe(false);
    expect(s.gate.meetsM3Snapshot).toBe(false);
  });

  it("passes a snapshot that meets all three M3 thresholds", () => {
    const s = summarizeEvolutionHealth(
      [
        counters("a.ts", { totalSuccesses: 3, totalOfflineApplied: 3, totalRolledBack: 1 }),
        counters("b.ts", { totalSuccesses: 2, totalOfflineApplied: 2 }),
        counters("c.ts", { totalDeferred: 1 }),
        counters("d.ts"),
      ],
      tracked,
    );
    expect(s.totals).toEqual({ verifiedApplied: 5, offlineApplied: 5, failed: 0, deferred: 1, rolledBack: 1 });
    expect(s.attempts).toBe(6);
    expect(s.deferredSharePct).toBe(16.7);
    expect(s.verifiedApplyRatePct).toBe(83.3);
    expect(s.modulesWithOfflinePatch).toEqual(["a.ts", "b.ts"]);
    expect(s.modulesWithOfflinePatchPct).toBe(50);
    expect(s.gate.m3aNoCoolingModules.pass).toBe(true);
    expect(s.gate.m3bOfflinePatchedModules.pass).toBe(true);
    expect(s.gate.m3cDeferredShare.pass).toBe(true);
    expect(s.gate.meetsM3Snapshot).toBe(true);
  });

  it("does not count an LLM-only patch as offline-patched", () => {
    const s = summarizeEvolutionHealth(
      [counters("a.ts", { totalSuccesses: 4, totalOfflineApplied: 0 })],
      ["a.ts"],
    );
    expect(s.modulesWithOfflinePatch).toEqual([]);
    expect(s.gate.m3bOfflinePatchedModules.pass).toBe(false);
  });

  it("treats exactly 25% deferred as passing and just above as failing", () => {
    const at = summarizeEvolutionHealth([counters("a.ts", { totalSuccesses: 3, totalOfflineApplied: 3, totalDeferred: 1 })], ["a.ts"]);
    expect(at.deferredSharePct).toBe(25);
    expect(at.gate.m3cDeferredShare.pass).toBe(true);
    const above = summarizeEvolutionHealth([counters("a.ts", { totalSuccesses: 2, totalOfflineApplied: 2, totalDeferred: 1 })], ["a.ts"]);
    expect(above.gate.m3cDeferredShare.pass).toBe(false);
  });

  it.each([
    ["cooling down", { cooldownRemainingMs: 5000 }],
    ["paused", { paused: true }],
    ["failure streak of 5", { consecutiveFailures: 5 }],
  ])("flags a module that is %s", (_label, over) => {
    const s = summarizeEvolutionHealth(
      [counters("a.ts", { totalSuccesses: 1, totalOfflineApplied: 1, ...over })],
      ["a.ts"],
    );
    expect(s.coolingOrFailingModules).toEqual(["a.ts"]);
    expect(s.gate.m3aNoCoolingModules.pass).toBe(false);
    expect(s.gate.meetsM3Snapshot).toBe(false);
  });

  it("does not flag a streak of 4", () => {
    const s = summarizeEvolutionHealth([counters("a.ts", { totalSuccesses: 1, consecutiveFailures: 4 })], ["a.ts"]);
    expect(s.coolingOrFailingModules).toEqual([]);
  });

  it("ignores untracked modules for the module checks but not for totals", () => {
    const s = summarizeEvolutionHealth(
      [counters("a.ts", { totalOfflineApplied: 1, totalSuccesses: 1 }), counters("zzz.ts", { paused: true, totalOfflineApplied: 9, totalSuccesses: 9 })],
      ["a.ts", "b.ts"],
    );
    expect(s.trackedModules).toBe(2);
    expect(s.coolingOrFailingModules).toEqual([]);
    expect(s.modulesWithOfflinePatch).toEqual(["a.ts"]);
    expect(s.modulesWithOfflinePatchPct).toBe(50);
  });

  it("normalizes aliases and de-duplicates the tracked list", () => {
    const s = summarizeEvolutionHealth(
      [counters("sovereign-sacred-geometry.ts", { totalOfflineApplied: 1, totalSuccesses: 1 })],
      ["sacred-geometry", "sovereign-sacred-geometry.ts"],
    );
    expect(s.trackedModules).toBe(1);
    expect(s.modulesWithOfflinePatchPct).toBe(100);
  });

  it("says the 24h soak was not measured", () => {
    expect(summarizeEvolutionHealth([], tracked).gate.soak).toMatch(/not measured/);
  });

  it("works from live throttle metrics", () => {
    _resetThrottleForTests();
    recordEvolutionSuccess("a.ts", "offline");
    recordEvolutionDeferred("b.ts", "llm-unavailable");
    pauseModule("c.ts");
    const s = summarizeEvolutionHealth(getThrottleMetrics().modules, ["a.ts", "b.ts", "c.ts"]);
    expect(s.totals.verifiedApplied).toBe(1);
    expect(s.totals.deferred).toBe(1);
    expect(s.coolingOrFailingModules).toEqual(["c.ts"]);
  });
});
