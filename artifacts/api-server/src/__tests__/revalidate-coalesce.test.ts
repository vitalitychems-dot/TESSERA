import { describe, expect, it, vi } from "vitest";

// R4-01: stale-fact revalidation used to await one LLM batcher debounce window
// (2s) per fact. Firing all verifications together lets one window coalesce them.
const FACTS = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  fact: i < 4 ? `Water boils at 100 degrees celsius at sea level (${i % 2})` : `The speed of light is constant ${i}`,
  confidence: 0.7,
}));

let llmCalls = 0;
vi.mock("../lib/llm-client", () => ({
  callLLM: vi.fn(async () => { llmCalls++; return "true"; }),
}));
vi.mock("../lib/tessera-llm-http", () => ({ resolveTesseraLlmModel: () => "test-model" }));
vi.mock("../lib/neural-embeddings", () => ({
  generateEmbedding: vi.fn(async () => null),
  cosineSimilarity: () => 0,
}));
vi.mock("../lib/semantic-cache", () => ({ evictExpired: vi.fn(), invalidateRelatedEntries: vi.fn() }));
vi.mock("../lib/semantic-deduplication", () => ({ resolveCanonicalId: (_t: string, id: number) => id }));
vi.mock("../lib/semantic-compression", () => ({ compressNewFacts: vi.fn(), portalJumpResolve: vi.fn() }));
vi.mock("@workspace/db", () => {
  const chain: any = {};
  for (const k of ["select", "from", "where", "orderBy", "update", "set"]) chain[k] = () => chain;
  chain.limit = async () => FACTS;
  chain.then = (res: (v: unknown) => void) => res(undefined);
  return { db: chain };
});
vi.mock("@workspace/db/schema", () => ({ distilledKnowledgeTable: {}, knowledgeCanonicalTable: {} }));

describe("revalidateStaleKnowledge coalesces into one batcher window", () => {
  it("verifies 6 facts in ~one 2s window with deduped LLM calls", async () => {
    const { revalidateStaleKnowledge } = await import("../lib/knowledge-distillation");
    const { batchedCallLLM } = await import("../lib/llm-batcher");
    const t0 = Date.now();
    const n = await revalidateStaleKnowledge(async (fact) =>
      (await batchedCallLLM([{ role: "user", content: fact }], { maxTokens: 10 })).includes("true"));
    const ms = Date.now() - t0;
    console.log(`R4-01 revalidated=${n} wallMs=${ms} llmCalls=${llmCalls}`);
    expect(n).toBe(6);
    expect(ms).toBeLessThan(3500); // sequential was >= 6 x 2000ms
    expect(llmCalls).toBeLessThan(6); // identical facts deduped in one window
  }, 20000);
});
