import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bm25Scores } from "../lib/hybrid-retrieval";

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

/** Reference BM25 that counts document frequency with filter + Array.includes. */
function bm25ScoresFilterDf(query: string, docs: string[], k1 = 1.5, b = 0.75): number[] {
  const qTerms = Array.from(new Set(tokenize(query)));
  if (qTerms.length === 0 || docs.length === 0) return docs.map(() => 0);
  const tokenized = docs.map(tokenize);
  const lens = tokenized.map((d) => d.length);
  const avgdl = lens.reduce((a, b) => a + b, 0) / lens.length || 1;
  const N = docs.length;
  const df: Record<string, number> = {};
  for (const t of qTerms) {
    df[t] = tokenized.filter((d) => d.includes(t)).length;
  }
  const idf: Record<string, number> = {};
  for (const t of qTerms) {
    idf[t] = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
  }
  return tokenized.map((d, i) => {
    const counts: Record<string, number> = {};
    for (const w of d) counts[w] = (counts[w] || 0) + 1;
    let s = 0;
    for (const t of qTerms) {
      const f = counts[t] || 0;
      if (!f) continue;
      s += idf[t] * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * lens[i]) / avgdl)));
    }
    return s;
  });
}

function documentFrequencyFilter(tokenized: string[][], qTerms: string[]): Record<string, number> {
  const df: Record<string, number> = {};
  for (const t of qTerms) {
    df[t] = tokenized.filter((d) => d.includes(t)).length;
  }
  return df;
}

/** Same single pass as bm25Scores: each query term counted once per document. */
function documentFrequencySinglePass(tokenized: string[][], qTerms: string[]): Record<string, number> {
  const qSet = new Set(qTerms);
  const df: Record<string, number> = Object.fromEntries(qTerms.map((t) => [t, 0]));
  for (const d of tokenized) {
    const seen = new Set<string>();
    for (const w of d) {
      if (qSet.has(w) && !seen.has(w)) {
        seen.add(w);
        df[w]++;
      }
    }
  }
  return df;
}

function expectScoresEqual(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(1e-12);
  }
}

function loadDocLines(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const mdPath = resolve(here, "../../../../docs/TESSERA_SYSTEM.md");
  const raw = readFileSync(mdPath, "utf8");
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 40);
}

describe("hybrid bm25 document frequency", () => {
  const lines = loadDocLines();

  it("matches filter-based df scores on real documentation lines", () => {
    expect(lines.length).toBeGreaterThanOrEqual(20);
    const docs = lines.slice(0, 24);
    const query = "sovereign computation council knowledge embeddings system agents integrity";
    expect(new Set(tokenize(query)).size).toBe(8);
    expectScoresEqual(bm25Scores(query, docs), bm25ScoresFilterDf(query, docs));
  });

  it("counts a repeated token once per document", () => {
    const docs = [
      "sovereign sovereign sovereign computation lattice",
      "knowledge embeddings only",
      "council council agents",
    ];
    const query = "sovereign computation knowledge embeddings council agents";
    expectScoresEqual(bm25Scores(query, docs), bm25ScoresFilterDf(query, docs));
  });

  it("single-pass df is faster on a repeated documentation corpus", () => {
    expect(lines.length).toBeGreaterThanOrEqual(20);
    const paragraph = lines.slice(0, 20).join(" ");
    const tail = "xylophone quartzite marigold zeppelin harmonica nebula kayak fjord";
    const qTerms = tokenize(tail);
    expect(qTerms).toHaveLength(8);
    const paragraphTerms = new Set(tokenize(paragraph));
    for (const term of qTerms) {
      expect(paragraphTerms.has(term)).toBe(false);
    }
    const body = Array.from({ length: 6 }, () => paragraph).join(" ");
    const docs = Array.from({ length: 500 }, (_, i) => `${body} ${tail} copy${i}`);
    expectScoresEqual(bm25Scores(tail, docs), bm25ScoresFilterDf(tail, docs));

    // Time the document-frequency pass, not the whole scorer. Tokenizing and
    // per-document term counts dominate bm25Scores and hide this loop.
    const tokenized = docs.map(tokenize);
    const iterations = 8;
    const time = (fn: () => Record<string, number>) => {
      const start = performance.now();
      for (let i = 0; i < iterations; i++) fn();
      return performance.now() - start;
    };
    documentFrequencyFilter(tokenized, qTerms);
    documentFrequencySinglePass(tokenized, qTerms);

    const beforeMs = time(() => documentFrequencyFilter(tokenized, qTerms));
    const afterMs = time(() => documentFrequencySinglePass(tokenized, qTerms));
    const speedup = beforeMs / afterMs;
    console.log(
      `BM25_DF beforeMs=${beforeMs.toFixed(1)} afterMs=${afterMs.toFixed(1)} speedup=${speedup.toFixed(2)}`,
    );

    expect(afterMs).toBeLessThan(beforeMs);
  });
});
