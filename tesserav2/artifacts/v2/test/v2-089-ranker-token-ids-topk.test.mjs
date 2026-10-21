import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { synapse, loadGraph, hebbian, decay, coMentionEpisodes } from "../src/brain/synapse.mjs";
import { createRanker, observeInteraction } from "../src/brain/context.mjs";

/** createRanker as it was before R9 (R8-02 CSR version: Set-based token overlap, full sort, per-candidate synapse lookup), kept as the reference. */
const tk = (s) => String(s ?? "").split(/[^a-z0-9]+/).filter((w) => w.length > 2);
function adjacency(g) {
  const a = new Map(); const p = (x, y, w) => { if (!a.has(x)) a.set(x, []); a.get(x).push([y, w]); };
  for (const [k, w] of g.edges) { const [x, y] = k.split("\u0000"); p(x, y, w); p(y, x, w); }
  return a;
}
function referenceRanker(g, { idfW = 1, typeW = 1, pprIters = 10, pprW = 1, synW = 2 } = {}) {
  const A = adjacency(g);
  // Precompute out-weight totals and inv-log degrees once (same formulas as before).
  const outTot = new Map();
  const invLog = new Map();
  for (const [n, L] of A) {
    outTot.set(n, L.reduce((s, [, w]) => s + w, 0) || 1);
    invLog.set(n, 1 / Math.log(1 + L.length));
  }
  const N = [...g.nodes.keys()]; const T = new Map(); const df = new Map();
  for (const n of N) { const s = new Set(tk(g.nodes.get(n).text)); T.set(n, s); for (const w of s) df.set(w, (df.get(w) ?? 0) + 1); }
  const tp = new Map(); const tt = new Map();
  for (const k of g.edges.keys()) { const [x, y] = k.split("\u0000"); for (const [a, b] of [[x, y], [y, x]]) { const ta = g.nodes.get(a).type; const K = `${ta}|${g.nodes.get(b).type}`; tp.set(K, (tp.get(K) ?? 0) + 1); tt.set(ta, (tt.get(ta) ?? 0) + 1); } }
  // PPR on integer indices (CSR adjacency). Replays the Map version exactly: the same
  // accumulation order (seed first, then first-touch order) and the same `(0.85 * v * w) / tot`.
  const ids = [...A.keys()]; const ix = new Map(ids.map((n, i) => [n, i])); const M = ids.length;
  const off = new Int32Array(M + 1); const nbr = []; const wt = []; const totA = new Float64Array(M); const invLogA = new Float64Array(M);
  for (let i = 0; i < M; i++) { const L = A.get(ids[i]); for (const [m, w] of L) { nbr.push(ix.get(m)); wt.push(w); } off[i + 1] = nbr.length; totA[i] = outTot.get(ids[i]); invLogA[i] = invLog.get(ids[i]); }
  const nbrA = Int32Array.from(nbr); const wtA = Float64Array.from(wt);
  let pv = new Float64Array(M), qv = new Float64Array(M), pOrd = new Int32Array(M), qOrd = new Int32Array(M);
  const mark = new Int32Array(M); let gen = 0; let pLen = 0; let pSeed = -1;
  /** Runs PPR from seed index s; results are pv[j] where mark[j] === gen (else 0). */
  const ppr = (s) => {
    gen++; pv[s] = 1; mark[s] = gen; pOrd[0] = s; pLen = 1;
    for (let i = 0; i < pprIters; i++) {
      gen++; qv[s] = 0.15; mark[s] = gen; qOrd[0] = s; let qLen = 1;
      for (let a = 0; a < pLen; a++) {
        const n = pOrd[a]; const v = pv[n]; const tot = totA[n];
        for (let e = off[n], end = off[n + 1]; e < end; e++) {
          const m = nbrA[e];
          if (mark[m] !== gen) { mark[m] = gen; qv[m] = 0; qOrd[qLen++] = m; }
          qv[m] = qv[m] + (0.85 * v * wtA[e]) / tot;
        }
      }
      let t = pv; pv = qv; qv = t; const o = pOrd; pOrd = qOrd; qOrd = o; pLen = qLen;
    }
    pSeed = s;
  };
  const NI = Int32Array.from(N, (n) => ix.get(n) ?? -1);
  // Per-token idf once (same Math.log(N.length / df) as before), type-prior factor once per target type per call,
  // Adamic-Adar over CSR indices with a neighbour mark (same summation order). Synapses are still read live.
  const idfV = new Map(); for (const [w, c] of df) idfV.set(w, Math.log(N.length / c));
  const idf0 = Math.log(N.length / 1);
  const nbMark = new Int32Array(M); let nbGen = 0;
  return function rank(seed, k = 5) {
    const SL = A.get(seed); const nb = new Map(SL ?? []); const S = T.get(seed) ?? new Set(); const st = g.nodes.get(seed)?.type;
    let stot = 0; for (const w of S) stot += idfV.get(w) ?? idf0;
    const si = ix.get(seed); const usePpr = pprW && si !== undefined; if (usePpr) ppr(si);
    nbGen++; if (si !== undefined) for (let e = off[si], end = off[si + 1]; e < end; e++) nbMark[nbrA[e]] = nbGen;
    const ttS = tt.get(st) || 1; const fac = new Map(); const out = [];
    for (let c = 0; c < N.length; c++) {
      const n = N[c]; const j = NI[c];
      if (n === seed || (j >= 0 ? nbMark[j] === nbGen : nb.has(n))) continue; let s = 0;
      if (j >= 0) for (let e = off[j], end = off[j + 1]; e < end; e++) { const m = nbrA[e]; if (nbMark[m] === nbGen) s += invLogA[m]; }
      s += synW * synapse(g, seed, n);
      let i = 0; for (const w of T.get(n)) if (S.has(w)) i += idfV.get(w) ?? idf0; s += idfW * (i / (stot || 1));
      s += pprW * 10 * (usePpr && j >= 0 && mark[j] === gen ? pv[j] : 0);
      const ty = g.nodes.get(n).type; let f = fac.get(ty);
      if (f === undefined) { f = 1 + typeW * ((tp.get(`${st}|${ty}`) ?? 0) / ttS); fac.set(ty, f); }
      s *= f;
      if (s > 0) out.push([n, s]);
    }
    return out.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, k).map(([n]) => n);
  };
}

const jsonl = readFileSync(new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url), "utf8");
const build = (rs) => { const g = loadGraph(rs.map((r) => JSON.stringify(r)).join("\n")); for (const e of coMentionEpisodes(g)) hebbian(g, e); decay(g, { factor: 0.95, floor: 0.05 }); return g; };
function graphs() {
  const all = jsonl.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const rest = all.filter((r, i) => !(r.type === "relation" && i % 5 === 0));
  const ents = rest.filter((r) => r.type !== "relation"); const rels = rest.filter((r) => r.type === "relation"); const h = Math.floor(rels.length / 2);
  const online = build([...ents, ...rels.slice(0, h)]); for (const r of rels.slice(h)) observeInteraction(online, r.from, r.to);
  return { full: build(all), online };
}

test("R9 ranker (token ids, top-k selection, synapse scan) gives the same rankings as the R8 ranker", () => {
  let lists = 0; const syn = {};
  for (const [name, g] of Object.entries(graphs())) {
    syn[name] = g.syn.size <= g.nodes.size; // full: scan path; online: per-candidate path
    const seeds = [...g.nodes.keys(), "not-a-node"];
    for (const opts of [{}, { pprW: 0 }, { pprIters: 0 }, { pprIters: 3, typeW: 0, synW: 0.5 }, { idfW: 0 }]) {
      const ref = referenceRanker(g, opts); const now = createRanker(g, opts);
      for (const seed of seeds) for (const k of [1, 5, 64, 65, g.nodes.size, 2.5, 0]) {
        assert.deepEqual(now(seed, k), ref(seed, k), `${name} ${JSON.stringify(opts)} ${seed} k=${k}`);
        lists++;
      }
    }
  }
  assert.deepEqual(syn, { full: true, online: false }, "both synapse paths exercised");
  assert.ok(lists > 10000, `checked ${lists} rankings`);
});

test("R9 ranker still reads synapses live, on both sides of the scan threshold", () => {
  const { full: g } = graphs(); const ref = referenceRanker(g); const now = createRanker(g);
  const seeds = [...g.nodes.keys()];
  hebbian(g, seeds.slice(0, 12)); assert.ok(g.syn.size <= g.nodes.size);
  for (const seed of seeds.slice(0, 40)) assert.deepEqual(now(seed, 10), ref(seed, 10), seed);
  hebbian(g, seeds.slice(12, 40)); assert.ok(g.syn.size > g.nodes.size);
  for (const seed of seeds.slice(0, 40)) assert.deepEqual(now(seed, 10), ref(seed, 10), seed);
});
