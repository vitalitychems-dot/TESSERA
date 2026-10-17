import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cortex: vi.fn(),
  pen: vi.fn(),
  save: vi.fn(),
  rows: [] as Array<{ value: unknown }>,
  available: true,
  penEnabled: true,
}));

vi.mock("../lib/llm-client", () => ({
  callLLM: mocks.cortex,
  callTesseraPen: mocks.pen,
  isLLMAvailable: () => mocks.available,
  isTesseraPenEnabled: () => mocks.penEnabled,
}));
vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.rows }) }) }),
    insert: () => ({ values: (value: unknown) => ({ onConflictDoUpdate: async () => mocks.save(value) }) }),
  },
}));
vi.mock("../lib/sovereign-fetch-guard", () => ({
  runWithShepherdContext: async (_lane: string, run: () => Promise<string>) => run(),
}));

import { getDualBrainMetrics, getDualBrainState, initDualBrain, runManualCycle } from "../lib/dual-brain";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows = [];
  mocks.available = true;
  mocks.penEnabled = true;
  mocks.cortex.mockResolvedValue("Analysis with an explicit evidence gap.");
  mocks.pen.mockResolvedValue("A proposal, not an applied change.");
  const state = getDualBrainState();
  Object.assign(state, {
    running: false, totalRounds: 0, totalImprovements: 0, totalExecutions: 0,
    legacyReportedRounds: 0, legacyReportedImprovements: 0,
    currentTopic: "Awaiting an explicitly requested model cycle",
    conversations: [], improvements: [], cycleCount: 0, lastCycleAt: 0,
  });
  state.brainStats.cortex.questionsAsked = 0;
  state.brainStats.cortex.critiquesGiven = 0;
  state.brainStats.executor.answersGiven = 0;
  state.brainStats.executor.revisionsApplied = 0;
});

describe("configured dual-brain cycles (offline adapters)", () => {
  it("passes Cortex analysis to Pen without counting generated text as execution", async () => {
    const round = await runManualCycle("Review recent-history retention");
    expect(mocks.cortex).toHaveBeenCalledOnce();
    expect(mocks.pen).toHaveBeenCalledOnce();
    expect(mocks.pen.mock.calls[0]?.[0]?.[1]?.content).toContain("Analysis with an explicit evidence gap.");
    expect(mocks.cortex.mock.calls[0]?.[1]).toMatchObject({ skipCache: true, skipBatcher: true });
    expect(mocks.pen.mock.calls[0]?.[1]).toMatchObject({ skipCache: true, skipBatcher: true });
    expect(round.provenance).toBe("configured-model-two-pass");
    expect(round.executorAnswer).toBe("A proposal, not an applied change.");
    expect(getDualBrainState().totalRounds).toBe(1);
    expect(getDualBrainState().totalExecutions).toBe(0);
    expect(getDualBrainState().totalImprovements).toBe(0);
    expect(getDualBrainMetrics().configurationReady).toBe(true);
    expect(getDualBrainMetrics().readinessBasis).toContain("does not perform a provider health check");
  });

  it("does not record a completed cycle when the Pen pass fails", async () => {
    mocks.pen.mockRejectedValueOnce(new Error("test-only adapter failure"));
    await expect(runManualCycle("A failing two-pass run")).rejects.toThrow("test-only adapter failure");
    expect(getDualBrainState().totalRounds).toBe(0);
    expect(getDualBrainState().conversations).toHaveLength(0);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("persists the newest twenty rounds, including the just-completed round", async () => {
    const state = getDualBrainState();
    state.conversations = Array.from({ length: 25 }, (_, index) => ({
      round: 25 - index, cortexQuestion: "older topic", executorAnswer: "older answer",
      cortexCritique: "older analysis", executorRevision: "No change", improvement: null,
      topic: "older topic", timestamp: 25 - index, provenance: "configured-model-two-pass" as const,
    }));
    state.totalRounds = 25;
    await runManualCycle("Newest topic");
    const saved = mocks.save.mock.calls[0]?.[0] as { value: { conversations: Array<{ topic: string; round: number }> } };
    expect(saved.value.conversations).toHaveLength(20);
    expect(saved.value.conversations[0]?.topic).toBe("Newest topic");
    expect(saved.value.conversations.at(-1)?.round).toBe(7);
  });

  it("serializes concurrent cycles so a delayed write cannot erase a newer round", async () => {
    let releaseFirstWrite!: () => void;
    const delayedWrite = new Promise<void>((resolve) => { releaseFirstWrite = resolve; });
    mocks.save.mockImplementationOnce(async () => delayedWrite);
    const first = runManualCycle("First concurrent topic");
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const second = runManualCycle("Second concurrent topic");
    await Promise.resolve();
    expect(mocks.cortex).toHaveBeenCalledTimes(1);
    releaseFirstWrite();
    await Promise.all([first, second]);
    expect(mocks.cortex).toHaveBeenCalledTimes(2);
    expect(mocks.save).toHaveBeenCalledTimes(2);
    const saved = mocks.save.mock.calls[1]?.[0] as { value: { totalRounds: number; conversations: Array<{ topic: string }> } };
    expect(saved.value.totalRounds).toBe(2);
    expect(saved.value.conversations.map((round) => round.topic)).toEqual([
      "Second concurrent topic", "First concurrent topic",
    ]);
  });

  it("preserves legacy records as simulations, never as applied improvements", async () => {
    mocks.rows = [{ value: {
      totalRounds: 12, totalImprovements: 3,
      conversations: [{ topic: "legacy", round: 12 }],
      improvements: [{ description: "old claim", applied: true }],
    } }];
    await initDualBrain();
    const state = getDualBrainState();
    expect(state.totalRounds).toBe(0);
    expect(state.totalExecutions).toBe(0);
    expect(state.legacyReportedRounds).toBe(12);
    expect(state.legacyReportedImprovements).toBe(3);
    expect(state.conversations[0]?.provenance).toBe("legacy-simulation");
    expect(state.improvements[0]?.applied).toBe(false);
    expect(state.improvements[0]?.reportedApplied).toBe(true);
  });
});
