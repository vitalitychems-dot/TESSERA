import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { embedText } from "../lib/vector-memory";

const DIM = 256;
const MIN_PARAS = 50;
const MIN_TOKENS = 24;
const SNIPPET_TOKENS = 8;
const PAIR_COUNT = 200;
const MAX_PARAS = 400;

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

/** Unsigned baseline: the previous embedText (always +1/n per token). */
function embedTextUnsigned(text: string): number[] {
  const tokens = tokenize(text);
  const vec = new Array(DIM).fill(0);
  if (tokens.length === 0) return vec;
  for (let i = 0; i < tokens.length; i++) {
    let h = 0;
    for (let j = 0; j < tokens[i].length; j++) h = ((h << 5) - h + tokens[i].charCodeAt(j)) | 0;
    const idx = Math.abs(h) % DIM;
    vec[idx] += 1 / tokens.length;
  }
  const mag = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0));
  if (mag > 0) for (let i = 0; i < vec.length; i++) vec[i] /= mag;
  return vec;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function termCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

/** Cosine of sparse term-count vectors (exact bag-of-words). */
function exactBagCosine(a: Map<string, number>, b: Map<string, number>): number {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  for (const value of a.values()) magA += value * value;
  for (const [term, value] of b) {
    magB += value * value;
    const other = a.get(term);
    if (other) dotProduct += other * value;
  }
  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function walkMarkdown(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(full, out);
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
  }
}

function paragraphsFromMarkdown(raw: string): string[] {
  const withoutFences = raw.replace(/```[\s\S]*?```/g, "\n");
  return withoutFences
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => tokenize(paragraph).length >= MIN_TOKENS);
}

function loadParagraphs(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../../..");
  const files: string[] = [];
  walkMarkdown(path.join(repoRoot, "docs"), files);
  files.sort();
  const paragraphs: string[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    for (const paragraph of paragraphsFromMarkdown(raw)) {
      const key = tokenize(paragraph).join(" ");
      if (seen.has(key)) continue;
      seen.add(key);
      paragraphs.push(paragraph);
      if (paragraphs.length >= MAX_PARAS) return paragraphs;
    }
  }
  return paragraphs;
}

function samplePairs(count: number, n: number, rng: () => number): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  const seen = new Set<string>();
  let attempts = 0;
  while (pairs.length < count && attempts < count * 50) {
    attempts += 1;
    const i = Math.floor(rng() * n);
    const j = Math.floor(rng() * n);
    if (i === j) continue;
    const key = i < j ? `${i}:${j}` : `${j}:${i}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([i, j]);
  }
  return pairs;
}

function meanAbsCosError(
  bags: Map<string, number>[],
  vectors: number[][],
  pairs: Array<[number, number]>,
): number {
  let total = 0;
  for (const [i, j] of pairs) {
    const hashed = dot(vectors[i], vectors[j]);
    const exact = exactBagCosine(bags[i], bags[j]);
    total += Math.abs(hashed - exact);
  }
  return total / pairs.length;
}

function top1HitRate(vectors: number[][], snippets: Array<{ query: number[]; source: number }>): number {
  let hits = 0;
  for (const snippet of snippets) {
    let best = -Infinity;
    let bestIdx = -1;
    for (let i = 0; i < vectors.length; i++) {
      const score = dot(snippet.query, vectors[i]);
      if (score > best) {
        best = score;
        bestIdx = i;
      }
    }
    if (bestIdx === snippet.source) hits += 1;
  }
  return hits / snippets.length;
}

const paragraphs = loadParagraphs();

describe("signed feature hashing in embedText", () => {
  it("returns a 256-d zero vector for empty text", () => {
    const vec = embedText("   ");
    expect(vec).toHaveLength(DIM);
    expect(vec.every((value) => value === 0)).toBe(true);
  });

  const ready = paragraphs.length >= MIN_PARAS;

  it.skipIf(!ready)(
    `measures cosine error and 8-word top-1 on ${paragraphs.length} docs paragraphs`,
    () => {
      expect(paragraphs.length).toBeGreaterThanOrEqual(MIN_PARAS);
      const rng = mulberry32(0x523303);
      const pairs = samplePairs(PAIR_COUNT, paragraphs.length, rng);
      expect(pairs.length).toBeGreaterThanOrEqual(100);

      const bags = paragraphs.map((paragraph) => termCounts(paragraph));
      const unsignedVecs = paragraphs.map((paragraph) => embedTextUnsigned(paragraph));
      const signedVecs = paragraphs.map((paragraph) => embedText(paragraph));

      const unsignedErr = meanAbsCosError(bags, unsignedVecs, pairs);
      const signedErr = meanAbsCosError(bags, signedVecs, pairs);

      const snippets = paragraphs.map((paragraph, source) => {
        const query = tokenize(paragraph).slice(0, SNIPPET_TOKENS).join(" ");
        return { source, unsigned: embedTextUnsigned(query), signed: embedText(query) };
      });
      const unsignedHit = top1HitRate(
        unsignedVecs,
        snippets.map((snippet) => ({ query: snippet.unsigned, source: snippet.source })),
      );
      const signedHit = top1HitRate(
        signedVecs,
        snippets.map((snippet) => ({ query: snippet.signed, source: snippet.source })),
      );

      console.log(
        [
          `embedText signed hashing: paragraphs=${paragraphs.length} pairs=${pairs.length}`,
          `mean|cos err| unsigned=${unsignedErr.toFixed(5)} signed=${signedErr.toFixed(5)}`,
          `top-1 hit unsigned=${unsignedHit.toFixed(4)} signed=${signedHit.toFixed(4)}`,
        ].join("\n"),
      );

      expect(signedErr).toBeLessThan(unsignedErr);
      expect(signedHit).toBeGreaterThanOrEqual(unsignedHit);
    },
  );

  it.skipIf(ready)("skips measurement when fewer than 50 docs paragraphs are available", () => {
    console.log(`embedText signed hashing: only ${paragraphs.length} paragraphs, skipping measurement`);
    expect(paragraphs.length).toBeLessThan(MIN_PARAS);
  });
});
