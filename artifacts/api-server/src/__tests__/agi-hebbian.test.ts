import { describe, it, expect } from "vitest";
import { HebbianGraph } from "../lib/agi/hebbian";

describe("Hebbian links (REA-09)", () => {
  it("strengthens co-activated pairs toward 1", () => {
    const g = new HebbianGraph({ rate: 0.5 });
    g.coActivate(["a", "b"], 0);
    expect(g.weight("a", "b", 0)).toBeCloseTo(0.5);
    g.coActivate(["b", "a"], 0);
    expect(g.weight("a", "b", 0)).toBeCloseTo(0.75);
    expect(g.weight("a", "c", 0)).toBe(0);
  });
  it("decays with half-life and prunes", () => {
    const g = new HebbianGraph({ rate: 0.5, halfLifeMs: 100, minWeight: 0.1 });
    g.coActivate(["a", "b"], 0);
    expect(g.weight("a", "b", 100)).toBeCloseTo(0.25);
    expect(g.prune(1000)).toBe(1);
    expect(g.size).toBe(0);
  });
  it("associates ranks neighbours", () => {
    const g = new HebbianGraph({ rate: 0.3 });
    g.coActivate(["x", "y", "z"], 0);
    g.coActivate(["x", "y"], 0);
    const n = g.associates("x", 5, 0);
    expect(n[0].id).toBe("y");
    expect(n.map((v) => v.id)).toContain("z");
  });
});
