#!/usr/bin/env node
// recall_at_k: recall@k of artifacts/api-server/src/lib/agi/hybrid-search.ts (REA-02) on a fixed
// synthetic fixture (fixtures/recall-fixture.json). Deterministic: embeddings are hashed character
// trigrams (no model, no network), so noise_band is 0. Also reports vector-only and keyword-only
// recall@k as context. Needs Node >= 22.18 (built-in TS type stripping) to load the .ts module;
// otherwise value = null with a note (fails closed).
// Usage: node recall_at_k.mjs [--repo DIR] [--k 5] [--runs 5]
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { arg, repeat, round4 } from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURE = join(HERE, "fixtures/recall-fixture.json");
export const MODULE = "artifacts/api-server/src/lib/agi/hybrid-search.ts";

export function embed(text, dim = 256) {
  const v = new Array(dim).fill(0), s = ` ${text.toLowerCase()} `;
  for (let i = 0; i + 3 <= s.length; i++) {
    let h = 2166136261;
    for (const c of s.slice(i, i + 3)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    v[(h >>> 0) % dim] += 1;
  }
  return v;
}
// Mean over queries of |relevant ∩ top-k| / |relevant|.
export function recallAtK(rank, fx, k = 5) {
  const docs = fx.docs.map((d) => ({ ...d, embedding: embed(d.content) }));
  let sum = 0;
  for (const q of fx.queries) {
    const top = new Set(rank(q.q, embed(q.q), docs, k).slice(0, k).map(String));
    sum += q.relevant.filter((id) => top.has(id)).length / q.relevant.length;
  }
  return round4(sum / fx.queries.length);
}
export async function measure(repo, k = 5, fx = JSON.parse(readFileSync(FIXTURE, "utf8"))) {
  const p = join(repo, MODULE);
  if (!existsSync(p)) return { why: `${MODULE} missing` };
  let m;
  try { m = await import(pathToFileURL(p).href); } catch (e) { return { why: `cannot load ${MODULE} (${e.code || e.message}); need Node >= 22.18` }; }
  const hybrid = (q, e, docs, lim) => m.hybridSearch(q, e, docs, lim).map((h) => h.id);
  const vector = (q, e, docs) => docs.map((d) => ({ id: d.id, s: m.cosine(e, d.embedding) })).sort((a, b) => b.s - a.s).map((x) => x.id);
  const keyword = (q, e, docs) => m.bm25Scores(q, docs).map((s, i) => ({ id: docs[i].id, s })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.id);
  return { hybrid: recallAtK(hybrid, fx, k), vector: recallAtK(vector, fx, k), keyword: recallAtK(keyword, fx, k), queries: fx.queries.length, docs: fx.docs.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = resolve(arg("--repo", join(HERE, "../.."))), k = +arg("--k", 5);
  let last = {};
  const r = await repeat(async () => { last = await measure(repo, k); return last.hybrid ?? null; }, +arg("--runs", 5));
  console.log(JSON.stringify({ name: `recall_at_${k}`, value: r.value, noise_band: r.noise_band, runs: r.runs,
    vector_only: last.vector ?? null, keyword_only: last.keyword ?? null, queries: last.queries ?? null, docs: last.docs ?? null,
    label: `hybrid-search recall@${k} on a synthetic fixture (retrieval sanity check, not real-memory recall)`, ...(last.why ? { note: last.why } : {}) }));
}
