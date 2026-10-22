import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { synapse, loadGraph, hebbian, decay, coMentionEpisodes } from "../src/brain/synapse.mjs";
import { createRanker } from "../src/brain/context.mjs";

/** Old createRanker formulas, before out-weight and inv-log caching. */
const tk = (s) => String(s ?? "").split(/[^a-z0-9]+/).filter((w) => w.length > 2);
function adjacency(g) {
  const a = new Map(); const p = (x, y, w) => { if (!a.has(x)) a.set(x, []); a.get(x).push([y, w]); };
  for (const [k, w] of g.edges) { const [x, y] = k.split("\u0000"); p(x, y, w); p(y, x, w); }
  return a;
}
function referenceRanker(g, { idfW = 1, typeW = 1, pprIters = 10, pprW = 1, synW = 2 } = {}) {
  const A = adjacency(g); const N = [...g.nodes.keys()]; const T = new Map(); const df = new Map();
  for (const n of N) { const s = new Set(tk(g.nodes.get(n).text)); T.set(n, s); for (const w of s) df.set(w, (df.get(w) ?? 0) + 1); }
  const idf = (w) => Math.log(N.length / (df.get(w) ?? 1));
  const tp = new Map(); const tt = new Map();
  for (const k of g.edges.keys()) { const [x, y] = k.split("\u0000"); for (const [a, b] of [[x, y], [y, x]]) { const ta = g.nodes.get(a).type; const K = `${ta}|${g.nodes.get(b).type}`; tp.set(K, (tp.get(K) ?? 0) + 1); tt.set(ta, (tt.get(ta) ?? 0) + 1); } }
  const ppr = (seed) => { let p = new Map([[seed, 1]]); for (let i = 0; i < pprIters; i++) { const q = new Map([[seed, 0.15]]); for (const [n, v] of p) { const L = A.get(n) ?? []; const tot = L.reduce((s, [, w]) => s + w, 0) || 1; for (const [m, w] of L) q.set(m, (q.get(m) ?? 0) + (0.85 * v * w) / tot); } p = q; } return p; };
  return function rank(seed, k = 5) {
    const nb = new Map(A.get(seed) ?? []); const S = T.get(seed) ?? new Set(); const st = g.nodes.get(seed)?.type;
    let stot = 0; for (const w of S) stot += idf(w); const P = pprW ? ppr(seed) : new Map(); const out = [];
    for (const n of N) {
      if (n === seed || nb.has(n)) continue; let s = 0;
      for (const [m] of A.get(n) ?? []) if (nb.has(m)) s += 1 / Math.log(1 + (A.get(m) ?? []).length);
      s += synW * synapse(g, seed, n);
      let i = 0; for (const w of T.get(n)) if (S.has(w)) i += idf(w); s += idfW * (i / (stot || 1));
      s += pprW * 10 * (P.get(n) ?? 0);
      s *= 1 + typeW * ((tp.get(`${st}|${g.nodes.get(n).type}`) ?? 0) / (tt.get(st) || 1));
      if (s > 0) out.push([n, s]);
    }
    return out.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, k).map(([n]) => n);
  };
}

function benchGraph(jsonl) {
  const g = loadGraph(jsonl);
  for (const episode of coMentionEpisodes(g)) hebbian(g, episode);
  decay(g, { factor: 0.95, floor: 0.05 });
  return g;
}

const pct = (samples, p) => {
  const s = [...samples].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

function timeRanks(rank, seeds, runs) {
  const samples = new Array(runs);
  for (let i = 0; i < runs; i++) {
    const t = process.hrtime.bigint();
    const names = rank(seeds[i % seeds.length], 5);
    samples[i] = Number(process.hrtime.bigint() - t) / 1e6;
    if (names.length > 5) throw new Error("rank returned more than k");
  }
  return samples;
}

test("cached ranker top-5 matches the old formulas on the memory graph", () => {
  const jsonl = readFileSync(new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url), "utf8");
  const g = benchGraph(jsonl);
  const seeds = [...g.nodes.keys()];
  assert.ok(seeds.length >= 50, `expected at least 50 seeds, got ${seeds.length}`);
  const oldRank = referenceRanker(g);
  const newRank = createRanker(g);
  let mismatches = 0;
  for (const seed of seeds) {
    const before = oldRank(seed, 5);
    const after = newRank(seed, 5);
    if (JSON.stringify(before) !== JSON.stringify(after)) mismatches++;
    assert.deepEqual(after, before, `top-5 mismatch for ${seed}`);
  }
  assert.equal(mismatches, 0);

  const warm = seeds.slice(0, 40);
  for (let i = 0; i < 20; i++) { oldRank(warm[i % warm.length], 5); newRank(warm[i % warm.length], 5); }
  const rounds = [];
  for (let r = 0; r < 3; r++) {
    const beforeSamples = timeRanks(oldRank, warm, 200);
    const afterSamples = timeRanks(newRank, warm, 200);
    rounds.push({
      beforeMs: pct(beforeSamples, 0.5),
      afterMs: pct(afterSamples, 0.5),
      beforeP95: pct(beforeSamples, 0.95),
      afterP95: pct(afterSamples, 0.95),
    });
  }
  const mid = (xs) => [...xs].sort((a, b) => a - b)[1];
  const beforeMs = +mid(rounds.map((r) => r.beforeMs)).toFixed(4);
  const afterMs = +mid(rounds.map((r) => r.afterMs)).toFixed(4);
  const beforeP95 = +mid(rounds.map((r) => r.beforeP95)).toFixed(4);
  const afterP95 = +mid(rounds.map((r) => r.afterP95)).toFixed(4);
  console.log(`RANKER_SPEED beforeMs=${beforeMs} afterMs=${afterMs} beforeP95=${beforeP95} afterP95=${afterP95} mismatches=${mismatches} seeds=${seeds.length}`);
  assert.ok(afterMs < 5, `cached ranker p50 ${afterMs}ms exceeded 5ms on the memory graph`);
});
