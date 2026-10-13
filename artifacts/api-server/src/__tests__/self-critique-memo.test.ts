import { describe, expect, it, vi } from "vitest";

// R4-19: runCritiqueLoop re-ran validateResponse + analyzeTruthfulnessV2 on a
// draft it had already critiqued. Identical drafts now reuse the critique.
let validateCalls = 0;
let truthCalls = 0;
vi.mock("@workspace/db", () => ({ db: { insert: () => ({ values: () => Promise.resolve() }) } }));
vi.mock("@workspace/db/schema", () => ({ selfCritiqueLogTable: {} }));
vi.mock("../lib/vector-memory", () => ({ searchMemory: async () => [] }));
vi.mock("../lib/ingested-recall", () => ({ recallIngestedKnowledge: async () => [] }));
vi.mock("../lib/response-validation-engine", () => ({
  validateResponse: async (c: string) => {
    validateCalls++;
    await new Promise((r) => setTimeout(r, 50));
    return { overallGroundingScore: 0.3, passedClaims: [], validatedResponse: c, wasModified: false };
  },
}));
vi.mock("../lib/truthfulness-engine", () => ({
  analyzeTruthfulnessV2: async () => {
    truthCalls++;
    await new Promise((r) => setTimeout(r, 50));
    return { overallTruthScore: 0.3, hallucinationCheck: { severity: "low" }, recommendation: "caution", verificationResults: [] };
  },
}));

describe("runCritiqueLoop skip-if-unchanged", () => {
  it("critiques an unchanged draft once across 3 attempts", async () => {
    const { runCritiqueLoop } = await import("../lib/self-critique");
    const t0 = Date.now();
    const r = await runCritiqueLoop("q", async () => "same draft", { maxAttempts: 3, persist: false });
    const ms = Date.now() - t0;
    console.log(`R4-19 attempts=${r.attempts} validateCalls=${validateCalls} truthCalls=${truthCalls} wallMs=${ms}`);
    expect(r.attempts).toBe(3);
    expect(r.passed).toBe(false);
    expect(validateCalls).toBe(1);
    expect(truthCalls).toBe(1);
  });
});
