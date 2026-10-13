import { describe, it, expect } from "vitest";
import { publish, pullRecent, importBusState } from "../lib/agi/agent-bus";
import { setGoal, listGoals, assertHypothesis, importWorkingMemoryState, recentObservations } from "../lib/agi/working-memory";
import { createInMemoryCheckpointStore, saveCheckpoint, resumeFromCheckpoint } from "../lib/agi/checkpoint";

describe("AGI checkpoint (REA-01)", () => {
  it("round-trips bus and working memory through a store", async () => {
    const store = createInMemoryCheckpointStore();
    publish("alpha", "t", { x: "hello world" }, 80);
    setGoal({ id: "g-cp", goal: "survive restart", priority: 70 });
    assertHypothesis("checkpoints work", 0.9);
    await saveCheckpoint(store);

    // simulate restart: wipe state
    importBusState({ version: 1, messages: [] });
    importWorkingMemoryState({ version: 1, observations: [], hypotheses: [], goals: [], contradictions: [] });
    expect(pullRecent(10)).toHaveLength(0);
    expect(listGoals()).toHaveLength(0);

    expect(await resumeFromCheckpoint(store)).toBe(true);
    expect(pullRecent(10)[0]?.from).toBe("alpha");
    expect(listGoals().map((g) => g.id)).toContain("g-cp");
    expect(recentObservations(10).length).toBeGreaterThan(0);
  });

  it("returns false when nothing is stored", async () => {
    expect(await resumeFromCheckpoint(createInMemoryCheckpointStore())).toBe(false);
  });
});
