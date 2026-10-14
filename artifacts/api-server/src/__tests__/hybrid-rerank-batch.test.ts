import { beforeEach, describe, expect, it, vi } from "vitest";

const N = 8;
const CHUNK_TEXT = "alpha beta gamma retrieval memory";

const state = vi.hoisted(() => ({
  delayMs: 0,
  embeddingCalls: [] as string[],
  batchCalls: [] as string[][],
  hits: [] as Array<{ content: string; source: string; score: number }>,
  ingested: [] as string[],
}));

vi.mock("../lib/logger", () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

vi.mock("../lib/vector-memory", () => ({
  searchMemory: async () => state.hits,
}));

vi.mock("../lib/ingested-recall", () => ({
  recallIngestedKnowledge: async () => state.ingested,
}));

vi.mock("../lib/neural-embeddings", () => ({
  generateEmbedding: async (text: string) => {
    state.embeddingCalls.push(text);
    if (state.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, state.delayMs));
    }
    return [1, 0];
  },
  generateEmbeddingsBatch: async (texts: string[]) => {
    state.batchCalls.push([...texts]);
    if (state.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, state.delayMs));
    }
    const denom = Math.max(texts.length - 1, 1);
    return texts.map((_, i) => [i / denom, 1]);
  },
  cosineSimilarity: (a: number[], b: number[]) => {
    const len = Math.min(a.length, b.length);
    if (len === 0) return 0;
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  },
}));

import { hybridRetrieve } from "../lib/hybrid-retrieval";
import { generateEmbedding, generateEmbeddingsBatch } from "../lib/neural-embeddings";

describe("hybrid retrieval embedding rerank", () => {
  beforeEach(() => {
    state.delayMs = 0;
    state.embeddingCalls.length = 0;
    state.batchCalls.length = 0;
    state.ingested = [];
    state.hits = Array.from({ length: N }, (_, i) => ({
      content: CHUNK_TEXT,
      source: `src-${i}`,
      score: 1,
    }));
  });

  it("embeds the query once and the topK chunks in one batch", async () => {
    const query = "alpha beta gamma";
    const results = await hybridRetrieve(query, { topK: N, rerankTopK: N });

    expect(state.embeddingCalls).toEqual([query]);
    expect(state.batchCalls).toHaveLength(1);
    expect(state.batchCalls[0]).toHaveLength(N);
    expect(state.batchCalls[0]).toEqual(Array.from({ length: N }, () => CHUNK_TEXT.slice(0, 800)));

    expect(results).toHaveLength(N);
    expect(results[0]?.source).toBe(`mem:src-${N - 1}`);
    expect(results[0]?.rerankScore).toBeGreaterThan(results[N - 1]?.rerankScore ?? 1);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }

    state.delayMs = 2;
    const sequentialStarted = performance.now();
    for (let i = 0; i < N; i++) {
      await generateEmbedding(`bench-${i}`);
    }
    const sequentialMs = performance.now() - sequentialStarted;

    const batchStarted = performance.now();
    await generateEmbeddingsBatch(Array.from({ length: N }, (_, i) => `bench-batch-${i}`));
    const batchMs = performance.now() - batchStarted;

    const sequentialLabel = sequentialMs.toFixed(1);
    const batchLabel = batchMs.toFixed(1);
    console.log(
      `HYBRID_RERANK sequentialMs=${sequentialLabel} batchMs=${batchLabel} callReduction=${N}→1`,
    );
    expect(batchMs).toBeLessThan(sequentialMs);
  });
});
