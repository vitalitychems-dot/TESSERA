import { describe, it, expect } from "vitest";
import { SubgoalEngine } from "../lib/agi/subgoaling";
import { listGoals } from "../lib/agi/working-memory";

const ev = (p: number) => ({ g1: { progress: p, done: false, signature: "builtInventions:stuck" } });

describe("Soar-style subgoaling (REA-10)", () => {
  it("creates a subgoal after N stalled ticks, then chunks the fix", () => {
    const s = new SubgoalEngine(2);
    expect(s.tick(ev(0.2)).subgoals).toEqual([]);
    expect(s.tick(ev(0.2)).subgoals).toEqual([]);
    const r = s.tick(ev(0.2));
    expect(r.subgoals).toHaveLength(1);
    expect(listGoals().find((g) => g.id === "g1-impasse-1")?.parentId).toBe("g1");
    expect(s.resolve(r.subgoals[0], "spawn builder agent")?.signature).toBe("builtInventions:stuck");

    // same impasse again -> resolved from chunk, no new subgoal
    s.tick(ev(0.3)); s.tick(ev(0.3));
    const again = s.tick(ev(0.3));
    expect(again.subgoals).toEqual([]);
    expect(again.applied[0].resolution).toBe("spawn builder agent");
    expect(s.listChunks()[0].uses).toBe(1);
  });
  it("progress resets the stall counter", () => {
    const s = new SubgoalEngine(2);
    for (const p of [0.1, 0.2, 0.3, 0.4]) expect(s.tick(ev(p)).subgoals).toEqual([]);
  });
});
