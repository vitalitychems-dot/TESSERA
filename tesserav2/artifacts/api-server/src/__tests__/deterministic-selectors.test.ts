import { describe, it, expect } from "vitest";
import { seededUnit, seededIndex, seededPick, seededInt, seededDistinctIndices, hourBucket } from "../lib/deterministic-selectors";
import { synthesizeKnowledge, spellResonance, selectUniverseWisdom } from "../lib/deterministic-content";

describe("deterministic selectors (FNV-1a)", () => {
  it("identical input gives identical output", () => {
    expect(seededUnit("a")).toBe(seededUnit("a"));
    expect(seededIndex("x", 7)).toBe(seededIndex("x", 7));
    expect(seededPick("p", [1, 2, 3, 4])).toBe(seededPick("p", [1, 2, 3, 4]));
    expect(seededDistinctIndices("s", 10, 3)).toEqual(seededDistinctIndices("s", 10, 3));
  });
  it("respects ranges", () => {
    for (let i = 0; i < 200; i++) {
      const u = seededUnit(`u${i}`); expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThan(1);
      const n = seededInt(`n${i}`, 70, 30); expect(n).toBeGreaterThanOrEqual(70); expect(n).toBeLessThan(100);
    }
    expect(seededIndex("z", 0)).toBe(0);
    expect(new Set(seededDistinctIndices("d", 5, 3)).size).toBe(3);
    expect(seededDistinctIndices("d", 2, 3).length).toBe(2);
  });
  it("different seeds spread", () => {
    const s = new Set(Array.from({ length: 50 }, (_, i) => seededIndex(`k${i}`, 8)));
    expect(s.size).toBeGreaterThan(4);
  });
  it("hourBucket is stable within an hour", () => {
    expect(hourBucket(Date.UTC(2026, 0, 1, 5, 1))).toBe(hourBucket(Date.UTC(2026, 0, 1, 5, 59)));
  });
});

describe("deterministic route content", () => {
  it("knowledge synthesis is reproducible for a seed", () => {
    expect(synthesizeKnowledge("seed-1")).toEqual(synthesizeKnowledge("seed-1"));
  });
  it("spell resonance is reproducible", () => {
    expect(spellResonance("s1", "heal")).toEqual(spellResonance("s1", "heal"));
  });
  it("ask-universe selection is reproducible", () => {
    const a = selectUniverseWisdom("what is consciousness?");
    expect(a).toEqual(selectUniverseWisdom("what is consciousness?"));
  });
});
