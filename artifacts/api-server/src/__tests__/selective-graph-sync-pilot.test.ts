import { beforeEach, describe, expect, it, vi } from "vitest";
import { TESSERA_SUBJECTS } from "../lib/tessera-knowledge";
import {
  createNetworkTheoryPartition,
  estimateContextTokens,
  searchGraphPartition,
  VersionedGraphPartitionCache,
} from "../lib/selective-graph-sync-pilot";

const retrievalMocks = vi.hoisted(() => ({
  searchMemory: vi.fn(),
  recallIngestedKnowledge: vi.fn(),
  generateEmbedding: vi.fn(),
  cosineSimilarity: vi.fn(),
}));

vi.mock("../lib/vector-memory", () => ({ searchMemory: retrievalMocks.searchMemory }));
vi.mock("../lib/ingested-recall", () => ({ recallIngestedKnowledge: retrievalMocks.recallIngestedKnowledge }));
vi.mock("../lib/neural-embeddings", () => ({
  generateEmbedding: retrievalMocks.generateEmbedding,
  cosineSimilarity: retrievalMocks.cosineSimilarity,
}));

import { hybridRetrieve } from "../lib/hybrid-retrieval";

const BENCHMARK_QUERIES = [
  { query: "Dijkstra shortest paths in weighted graphs", evidence: "Dijkstra's algorithm finds shortest paths" },
  { query: "PageRank measures node importance", evidence: "PageRank evaluates node importance" },
  { query: "scale-free network hubs power law", evidence: "Scale-free networks follow power-law" },
  { query: "small-world clustering and path length", evidence: "Small-world networks combine high clustering" },
  { query: "network resilience targeted hub attacks", evidence: "vulnerable to targeted hub attacks" },
];

function overlap(query: string, text: string): number {
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter(term => term.length > 2);
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)].toFixed(3));
}

function timeSyncSearch(cache: VersionedGraphPartitionCache, partition: ReturnType<typeof createNetworkTheoryPartition>, query: string) {
  const start = performance.now();
  const synced = cache.sync(partition);
  const results = searchGraphPartition(synced.partition, query, 3);
  return { elapsedMs: performance.now() - start, results, ...synced };
}

describe("selective graph sync pilot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("compares mocked current hybrid retrieval against a versioned cached public partition", async () => {
    const partition = createNetworkTheoryPartition();
    const fullCorpus = Object.entries(TESSERA_SUBJECTS).map(([domain, subject]) => ({
      content: subject.knowledge,
      source: `tessera-knowledge#${domain}`,
      score: 0,
    }));
    const cache = new VersionedGraphPartitionCache();
    const firstSync = cache.sync(partition);

    retrievalMocks.searchMemory.mockImplementation(async (query: string, limit: number) =>
      fullCorpus
        .map(item => ({ ...item, score: overlap(query, item.content) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit),
    );
    retrievalMocks.recallIngestedKnowledge.mockResolvedValue([]);
    retrievalMocks.generateEmbedding.mockResolvedValue([1, 0, 0]);
    retrievalMocks.cosineSimilarity.mockReturnValue(1);

    const baselineTimes: number[] = [];
    const pilotTimes: number[] = [];
    let baselineTokens = 0;
    let pilotTokens = 0;
    let baselineCovered = 0;
    let pilotCovered = 0;
    let pilotCacheHits = 0;
    let warmBytesSynced = 0;
    const repetitions = 20;

    for (let repetition = 0; repetition < repetitions; repetition++) {
      for (const item of BENCHMARK_QUERIES) {
        const baselineStart = performance.now();
        const baseline = await hybridRetrieve(item.query, { topK: 6, rerankTopK: 3 });
        baselineTimes.push(performance.now() - baselineStart);
        baselineTokens += baseline.reduce((sum, chunk) => sum + Math.ceil(chunk.text.length / 4), 0);
        if (baseline.some(chunk => chunk.text.includes(item.evidence))) baselineCovered++;

        const pilot = timeSyncSearch(cache, partition, item.query);
        pilotTimes.push(pilot.elapsedMs);
        pilotCacheHits += Number(pilot.cacheHit);
        warmBytesSynced += pilot.bytesSynced;
        pilotTokens += estimateContextTokens(pilot.results);
        if (pilot.results.some(node => node.text.includes(item.evidence))) pilotCovered++;
      }
    }

    const trials = repetitions * BENCHMARK_QUERIES.length;
    const metrics = {
      trials,
      baseline: {
        contextTokensPerQuery: Number((baselineTokens / trials).toFixed(2)),
        evidenceCoveragePercent: Number((baselineCovered / trials * 100).toFixed(1)),
        p50Ms: percentile(baselineTimes, 0.5),
        p95Ms: percentile(baselineTimes, 0.95),
        retrievalFixtureNodes: fullCorpus.length,
      },
      selectiveSync: {
        contextTokensPerQuery: Number((pilotTokens / trials).toFixed(2)),
        evidenceCoveragePercent: Number((pilotCovered / trials * 100).toFixed(1)),
        cacheHits: pilotCacheHits,
        cacheHitRatePercent: Number((pilotCacheHits / trials * 100).toFixed(1)),
        coldBytesSynced: firstSync.bytesSynced,
        warmBytesSynced: warmBytesSynced,
        partitionNodes: partition.nodes.length,
        p50Ms: percentile(pilotTimes, 0.5),
        p95Ms: percentile(pilotTimes, 0.95),
      },
      methodology: "In-process deterministic fixture; current hybridRetrieve is exercised with mocked vector, ingestion and embedding providers. No database, network or live model calls.",
    };
    console.log("SELECTIVE_GRAPH_SYNC_PILOT", JSON.stringify(metrics));

    expect(partition.classification).toBe("public-curated");
    expect(firstSync.bytesSynced).toBeGreaterThan(0);
    expect(cache.sync(partition).cacheHit).toBe(true);
    expect(metrics.selectiveSync.warmBytesSynced).toBe(0);
    expect(pilotCovered).toBeGreaterThanOrEqual(baselineCovered);
    expect(metrics.selectiveSync.p95Ms).toBeLessThanOrEqual(metrics.baseline.p95Ms * 3 + 1);
  });

  it("rejects private partitions and same-version content drift", () => {
    const cache = new VersionedGraphPartitionCache();
    const partition = createNetworkTheoryPartition();
    cache.sync(partition);
    expect(() => cache.sync({ ...partition, classification: "private" as "public-curated" })).toThrow(/Only public-curated/);
    expect(() => cache.sync({ ...partition, nodes: [...partition.nodes, { ...partition.nodes[0], text: "changed" }] }))
      .toThrow(/without a version increment/);
  });

  it("retrieves only evidence from the selected partition", () => {
    const partition = createNetworkTheoryPartition();
    const hits = searchGraphPartition(partition, "Dijkstra shortest paths", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every(node => node.source.includes("#network-theory"))).toBe(true);
    expect(estimateContextTokens(hits)).toBeGreaterThan(0);
  });
});
