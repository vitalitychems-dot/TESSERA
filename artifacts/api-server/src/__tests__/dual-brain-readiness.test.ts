import { afterEach, describe, expect, it, vi } from "vitest";
import { getDualBrainState, runManualCycle, startDualBrain, stopDualBrain } from "../lib/dual-brain";

afterEach(() => {
  stopDualBrain();
  vi.unstubAllEnvs();
});

describe("dual-brain readiness and provenance", () => {
  it("does not start background cycles unless autorun and both model lanes are enabled", () => {
    vi.stubEnv("TESSERA_DUAL_BRAIN_AUTORUN", "0");
    vi.stubEnv("SOVEREIGN_NO_EXTERNAL_LLM", "1");
    vi.stubEnv("TESSERA_PEN_ENABLED", "0");

    expect(startDualBrain()).toBe(false);
    expect(getDualBrainState().running).toBe(false);
    expect(getDualBrainState().totalRounds).toBe(0);
    expect(getDualBrainState().totalExecutions).toBe(0);
  });

  it("does not synthesize a manual cycle when the primary model is disabled", async () => {
    vi.stubEnv("SOVEREIGN_NO_EXTERNAL_LLM", "1");
    vi.stubEnv("TESSERA_LLM_BASE_URL", "https://model.invalid/v1");
    vi.stubEnv("TESSERA_LLM_API_KEY", "test-only-key");
    vi.stubEnv("TESSERA_LLM_MODEL", "test-only-model");
    vi.stubEnv("TESSERA_PEN_ENABLED", "1");
    const before = getDualBrainState().totalRounds;

    await expect(runManualCycle("test topic")).rejects.toThrow(/configure and explicitly enable the primary model/i);
    expect(getDualBrainState().totalRounds).toBe(before);
    expect(getDualBrainState().totalExecutions).toBe(0);
    expect(getDualBrainState().totalImprovements).toBe(0);
  });
});
