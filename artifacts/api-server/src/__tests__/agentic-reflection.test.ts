import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {} }));
vi.mock("../lib/logger", () => {
  const logger: any = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  logger.child = () => logger;
  return { logger };
});

import { composeReflection, type ReflectionSignals } from "../lib/agentic-reflection";

function signals(overrides: Partial<ReflectionSignals> = {}): ReflectionSignals {
  return {
    engineRunning: true,
    cycleCount: 10,
    episodicMemorySize: 5,
    semanticGraphSize: 8,
    reflectionCount: 2,
    stimuliProcessed: 12,
    pendingStimuli: 0,
    snapshotDiffs: 3,
    metaPatterns: 0,
    identityAlignment: 0.8,
    identityDrift: false,
    identityDriftDetails: [],
    ...overrides,
  };
}

describe("agentic reflection composition", () => {
  it("marks the first cycle as having no baseline", () => {
    const r = composeReflection(signals(), null, 1);
    expect(r.observations.join(" ")).toMatch(/First reflection cycle/);
    expect(r.cycle).toBe(1);
    expect(r.id).toBe("aref-1");
  });

  it("reports deltas against the previous cycle and notices stagnation", () => {
    const prev = composeReflection(signals(), null, 1);
    const r = composeReflection(signals(), prev, 2);
    expect(r.observations.join(" ")).toMatch(/memories 0, stimuli 0, snapshot diffs 0/);
    expect(r.conclusions.join(" ")).toMatch(/nothing new to learn from/i);
  });

  it("surfaces identity drift with commitments to re-anchor", () => {
    const r = composeReflection(
      signals({ identityDrift: true, identityAlignment: 0.3, identityDriftDetails: ["Core value 'truth' below threshold: 20%"] }),
      null,
      1,
    );
    expect(r.conclusions.join(" ")).toMatch(/drift detected/i);
    expect(r.commitments.join(" ")).toMatch(/re-anchor identity/i);
    expect(r.observations.join(" ")).toMatch(/Core value 'truth'/);
  });

  it("commits to draining a non-empty stimulus queue", () => {
    const r = composeReflection(signals({ pendingStimuli: 4 }), null, 1);
    expect(r.observations.join(" ")).toMatch(/4 stimuli are queued/);
    expect(r.commitments.join(" ")).toMatch(/stimulus queue/i);
  });

  it("never fabricates content beyond the measured signals", () => {
    const r = composeReflection(signals(), null, 1);
    const text = [...r.observations, ...r.conclusions, ...r.commitments].join(" ");
    expect(text).not.toMatch(/I feel|I believe|conscious|alive|aware/i);
  });
});
