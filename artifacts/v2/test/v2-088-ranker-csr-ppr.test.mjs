import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { synapse, loadGraph, hebbian, decay, coMentionEpisodes } from "../src/brain/synapse.mjs";
import { createRanker, observeInteraction } from "../src/brain/context.mjs";

/** createRanker as it was before R8 (Map-based PPR, idf() per token, type prior per node), kept as the reference. */
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
  const idf = (w) => Math.log(N.length / (df.get(w) ?? 1));
  const tp = new Map(); const tt = new Map();
  for (const k of g.edges.keys()) { const [x, y] = k.split("\u0000"); for (const [a, b] of [[x, y], [y, x]]) { const ta = g.nodes.get(a).type; const K = `${ta}|${g.nodes.get(b).type}`; tp.set(K, (tp.get(K) ?? 0) + 1); tt.set(ta, (tt.get(ta) ?? 0) + 1); } }
  const ppr = (seed) => {
    let p = new Map([[seed, 1]]);
    for (let i = 0; i < pprIters; i++) {
      const q = new Map([[seed, 0.15]]);
      for (const [n, v] of p) {
        const L = A.get(n) ?? [];
        const tot = outTot.get(n) ?? 1;
        for (const [m, w] of L) q.set(m, (q.get(m) ?? 0) + (0.85 * v * w) / tot);
      }
      p = q;
    }
    return p;
  };
  return function rank(seed, k = 5) {
    const nb = new Map(A.get(seed) ?? []); const S = T.get(seed) ?? new Set(); const st = g.nodes.get(seed)?.type;
    let stot = 0; for (const w of S) stot += idf(w); const P = pprW ? ppr(seed) : new Map(); const out = [];
    for (const n of N) {
      if (n === seed || nb.has(n)) continue; let s = 0;
      for (const [m] of A.get(n) ?? []) if (nb.has(m)) s += invLog.get(m);
      s += synW * synapse(g, seed, n);
      let i = 0; for (const w of T.get(n)) if (S.has(w)) i += idf(w); s += idfW * (i / (stot || 1));
      s += pprW * 10 * (P.get(n) ?? 0);
      s *= 1 + typeW * ((tp.get(`${st}|${g.nodes.get(n).type}`) ?? 0) / (tt.get(st) || 1));
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

test("CSR ranker gives the same full ranking as the old Map ranker (real memory graph, several option sets)", () => {
  let lists = 0;
  for (const [name, g] of Object.entries(graphs())) {
    const seeds = [...g.nodes.keys(), "not-a-node"];
    for (const opts of [{}, { pprW: 0 }, { pprIters: 0 }, { pprIters: 3, typeW: 0, synW: 0.5 }, { idfW: 0 }]) {
      const ref = referenceRanker(g, opts); const now = createRanker(g, opts);
      for (const seed of seeds) for (const k of [5, g.nodes.size]) {
        assert.deepEqual(now(seed, k), ref(seed, k), `${name} ${JSON.stringify(opts)} ${seed} k=${k}`);
        lists++;
      }
    }
  }
  assert.ok(lists > 3000, `checked ${lists} rankings`);
});

test("CSR ranker sees synapses written after it was built (they are read live)", () => {
  const { full: g } = graphs(); const ref = referenceRanker(g); const now = createRanker(g);
  const seeds = [...g.nodes.keys()].slice(0, 30);
  hebbian(g, seeds.slice(0, 12)); hebbian(g, seeds.slice(0, 12));
  for (const seed of seeds) assert.deepEqual(now(seed, 10), ref(seed, 10), seed);
});
