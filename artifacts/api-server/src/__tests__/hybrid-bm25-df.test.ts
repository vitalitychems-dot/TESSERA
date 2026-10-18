import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bm25Scores, type Bm25DfProbe } from "../lib/hybrid-retrieval";

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

function isArrayIndexProperty(prop: string | symbol): boolean {
  if (typeof prop !== "string" || prop.length === 0) return false;
  const index = Number(prop);
  return Number.isInteger(index) && index >= 0 && String(index) === prop;
}

/** Calls Array.includes and counts each index read, which is the filter scan. */
function includesCountingExams(tokens: string[], term: string, exams: { n: number }): boolean {
  const wrapped = new Proxy(tokens, {
    get(target, prop, receiver) {
      if (isArrayIndexProperty(prop)) exams.n += 1;
      return Reflect.get(target, prop, receiver);
    },
  });
  return wrapped.includes(term);
}

function documentFrequencyFilterCounted(
  tokenized: string[][],
  qTerms: string[],
): { df: Record<string, number>; tokenExams: number } {
  const df: Record<string, number> = {};
  const exams = { n: 0 };
  for (const t of qTerms) {
    let docsWithTerm = 0;
    for (const d of tokenized) {
      if (includesCountingExams(d, t, exams)) docsWithTerm += 1;
    }
    df[t] = docsWithTerm;
  }
  return { df, tokenExams: exams.n };
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

  it("single-pass df does less work than the filter pass on a repeated documentation corpus", () => {
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
    const tokenized = docs.map(tokenize);
    const bodyTokenCount = tokenize(body).length;
    const totalTokens = tokenized.reduce((sum, doc) => sum + doc.length, 0);
    expect(bodyTokenCount).toBeGreaterThan(0);
    expect(totalTokens).toBeGreaterThan(docs.length * bodyTokenCount);

    const probe: Bm25DfProbe = { tokenExams: { n: 0 }, df: {} };
    const filterStart = performance.now();
    const filterDf = documentFrequencyFilter(tokenized, qTerms);
    const filterMs = performance.now() - filterStart;
    const counted = documentFrequencyFilterCounted(tokenized, qTerms);
    expect(counted.df).toEqual(filterDf);

    const singleStart = performance.now();
    const probedScores = bm25Scores(tail, docs, 1.5, 0.75, probe);
    const singlePassMs = performance.now() - singleStart;
    expectScoresEqual(probedScores, bm25ScoresFilterDf(tail, docs));
    expectScoresEqual(bm25Scores(tail, docs), bm25ScoresFilterDf(tail, docs));
    expect(probe.df).toEqual(filterDf);
    for (const term of qTerms) {
      expect(probe.df?.[term]).toBe(docs.length);
    }

    const singlePassExams = probe.tokenExams?.n ?? 0;
    // The production pass reads each token once. The filter pass calls
    // Array.includes once per query term and therefore rereads the repeated
    // body that many times. terms-1 stays under that ratio: includes stops
    // at the tail term, so the last few tokens are not reread for every term.
    const minFactor = qTerms.length - 1;
    expect(singlePassExams).toBe(totalTokens);
    expect(counted.tokenExams).toBeGreaterThanOrEqual(docs.length * qTerms.length * bodyTokenCount);
    expect(counted.tokenExams).toBeGreaterThanOrEqual(singlePassExams * minFactor);

    const tokenFactor = counted.tokenExams / singlePassExams;
    // Times are a log only. filterDfMs is the includes pass; bm25ScoresMs is the
    // whole production helper, including tokenization, so they are not a ratio.
    console.log(
      `BM25_DF singlePassTokenExams=${singlePassExams} filterTokenExams=${counted.tokenExams} tokenFactor=${tokenFactor.toFixed(2)} filterDfMs=${filterMs.toFixed(1)} bm25ScoresMs=${singlePassMs.toFixed(1)}`,
    );
  });
});
