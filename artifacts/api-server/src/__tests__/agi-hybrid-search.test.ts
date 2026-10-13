import { describe, it, expect } from "vitest";
import { cosine, bm25Scores, hybridSearch } from "../lib/agi/hybrid-search";

const docs = [
  { id: 1, content: "postgres hnsw index for vectors", embedding: [1, 0, 0] },
  { id: 2, content: "cooking pasta recipes", embedding: [0, 1, 0] },
  { id: 3, content: "agent memory search", embedding: [0.9, 0.1, 0] },
];

describe("hybrid search (REA-02)", () => {
  it("cosine basics", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([], [])).toBe(0);
  });
  it("bm25 scores only matching docs", () => {
    const s = bm25Scores("hnsw postgres", docs);
    expect(s[0]).toBeGreaterThan(0);
    expect(s[1]).toBe(0);
  });
  it("fusion prefers docs that win both rankings", () => {
    const hits = hybridSearch("hnsw index", [1, 0, 0], docs, 3);
    expect(hits[0].id).toBe(1);
    expect(hits[0].vectorRank).toBe(1);
    expect(hits[0].keywordRank).toBe(1);
    expect(hits.at(-1)!.id).toBe(2);
  });
});
