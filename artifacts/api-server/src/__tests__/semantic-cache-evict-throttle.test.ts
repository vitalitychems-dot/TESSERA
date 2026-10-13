import { describe, expect, it, vi } from "vitest";

// R4-14: evictExpired ran a DELETE on every fact extraction / re-embed batch.
// Reads already ignore expired rows, so opportunistic eviction is throttled.
let deletes = 0;
vi.mock("@workspace/db", () => ({
  db: { delete: () => { deletes++; return { where: () => ({ returning: async () => [] }) }; } },
}));
vi.mock("@workspace/db/schema", () => ({ semanticCacheTable: {} }));
vi.mock("../lib/neural-embeddings", () => ({ generateEmbedding: async () => null, cosineSimilarity: () => 0 }));
vi.mock("../lib/dimensional-lru-cache", () => ({ semanticDimensionalCache: { get: () => null, set: () => {}, clear: () => {}, getStats: () => ({}) } }));

describe("evictExpired throttle", () => {
  it("50 opportunistic calls in a burst run 1 DELETE; force still runs", async () => {
    const { evictExpired } = await import("../lib/semantic-cache");
    for (let i = 0; i < 50; i++) await evictExpired();
    const burst = deletes;
    await evictExpired(true);
    console.log(`R4-14 opportunisticCalls=50 deletes=${burst} forcedDeletes=${deletes - burst}`);
    expect(burst).toBe(1);
    expect(deletes - burst).toBe(1);
  });
});
