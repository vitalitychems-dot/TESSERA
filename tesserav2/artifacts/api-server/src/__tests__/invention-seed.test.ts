import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { hashStringFNV, getRealityAudit } from "../lib/reality-audit";
import {
  seedFeasibility, seedNovelty, deterministicInventionId, resolveSeedInventionId, abstainIncrement,
  buildStartProgress, buildStep, testRegressed, pickFreshCandidate,
} from "../lib/invention-seed";

describe("invention seed determinism", () => {
  const titles = ["Sovereign Mesh Gossip", "Reality-Check Simulator", "Agent Marketplace", "Océan ☃ title"];

  it("FNV-1a matches known vectors", () => {
    expect(hashStringFNV("")).toBe(2166136261);
    expect(hashStringFNV("a")).toBe(0xe40c292c);
    expect(hashStringFNV("foobar")).toBe(0xbf9cf968);
  });

  it("scores are stable and within documented ranges", () => {
    for (const t of titles) {
      expect(seedFeasibility(t)).toBe(seedFeasibility(t));
      expect(seedFeasibility(t)).toBeGreaterThanOrEqual(70);
      expect(seedFeasibility(t)).toBeLessThanOrEqual(94);
      expect(seedNovelty(t)).toBeGreaterThanOrEqual(65);
      expect(seedNovelty(t)).toBeLessThanOrEqual(94);
    }
  });

  it("invention ids are deterministic, slugged and prefix-scoped", () => {
    const id = deterministicInventionId("sys", "Sovereign Mesh Gossip!");
    expect(id).toBe(deterministicInventionId("sys", "Sovereign Mesh Gossip!"));
    expect(id).toMatch(/^sys-sovereign-mesh-gossip-+[a-z0-9]+$/);
    expect(deterministicInventionId("auto", "X")).not.toBe(deterministicInventionId("sys", "X"));
  });

  it("skips a repeat title and suffixes an id that already belongs to someone else", () => {
    const title = "Sovereign Mesh Gossip!";
    const stored = deterministicInventionId("sys", title);
    expect(resolveSeedInventionId("sys", title, [{ inventionId: stored, title }])).toEqual({
      action: "skip",
      inventionId: stored,
    });
    expect(resolveSeedInventionId("sys", "  sovereign   mesh gossip! ", [{ inventionId: stored, title }])).toEqual({
      action: "skip",
      inventionId: stored,
    });
    const takenByOther = resolveSeedInventionId("sys", title, [{ inventionId: stored, title: "Different Device" }]);
    expect(takenByOther).toEqual({ action: "insert", inventionId: `${stored}-2` });
    expect(resolveSeedInventionId("auto", "Brand New", [])).toEqual({
      action: "insert",
      inventionId: deterministicInventionId("auto", "Brand New"),
    });
  });

  it("abstain, build step, start progress and regression follow the documented formulas", () => {
    for (const t of titles) {
      const h = hashStringFNV(t);
      for (const tick of [0, 1, 7, 12, 99]) {
        expect(abstainIncrement(t, tick)).toBe(1 + ((h + tick) % 3));
        expect(buildStep(t, tick)).toBe(8 + ((h + tick) % 14));
        expect(testRegressed(t, tick)).toBe((h + tick) % 12 === 0);
      }
      expect(buildStartProgress(t)).toBe(10 + (h % 20));
    }
  });

  it("regression fires exactly once in every 12 consecutive ticks", () => {
    const hits = Array.from({ length: 12 }, (_, tick) => testRegressed("Agent Marketplace", tick)).filter(Boolean);
    expect(hits).toHaveLength(1);
  });

  it("pick is round-robin over hash-sorted candidates and independent of input order", () => {
    const fresh = titles.map((title) => ({ title }));
    const reversed = [...fresh].reverse();
    for (let tick = 0; tick < 8; tick++) {
      expect(pickFreshCandidate(fresh, tick)).toEqual(pickFreshCandidate(reversed, tick));
    }
    const seen = new Set(Array.from({ length: fresh.length }, (_, tick) => pickFreshCandidate(fresh, tick)!.title));
    expect(seen.size).toBe(fresh.length);
    expect(pickFreshCandidate([], 3)).toBeUndefined();
  });
});

describe("reality audit registry stays honest", () => {
  it("none of the top-5 converted entries were auto-downgraded by source verification", async () => {
    const audit = await getRealityAudit();
    expect(audit.summary.verifyMismatches).toBe(0);
    for (const id of [
      "inventions-seed-generation", "inventions-autoloop-voting", "inventions-autoloop-build-test",
      "quantum-tesseract-fidelity", "rick-catchphrase-picker",
    ]) {
      const entry = audit.registry.find((f) => f.id === id);
      expect(entry, id).toBeDefined();
      expect(entry!.status, id).not.toBe("simulated");
    }
  });

  it("registry engine links point at routes that exist", () => {
    const src = readFileSync(resolve(__dirname, "..", "routes", "inventions.ts"), "utf8");
    expect(src).toContain('router.post("/inventions/generate"');
    expect(src).toContain('router.post("/inventions/autonomous/tick"');
    const audit = readFileSync(join(resolve(__dirname, ".."), "lib", "reality-audit.ts"), "utf8");
    expect(audit).not.toContain("/api/inventions/auto-loop/tick");
  });

  it("inventions route no longer mixes DB size or the clock into seeded ids and scores", () => {
    const src = readFileSync(resolve(__dirname, "..", "routes", "inventions.ts"), "utf8");
    expect(src).not.toMatch(/realActivity/);
    expect(src).not.toMatch(/`(?:sys|auto)-\$\{[^`]*Date\.now\(\)/);
  });

  it("measureQubit keeps Math.random on purpose (Born rule)", () => {
    const src = readFileSync(resolve(__dirname, "..", "lib", "quantum-tesseract.ts"), "utf8");
    expect(src).toMatch(/Math\.random\(\) < prob0/);
    expect(src).not.toMatch(/errorRate:[^\n]*Math\.random/);
  });
});
