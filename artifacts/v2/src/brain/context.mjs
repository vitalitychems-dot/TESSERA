/**
 * IDEAS-B4 context ranker. Same Adamic-Adar + synapse base as synapse.predict, plus
 * IDF-weighted observation overlap, a 10-step personalized PageRank term, and a
 * seed-type -> target-type prior learned from the graph's own edges. Variant chosen on an
 * inner split of the training relations before the outer 87-query held-out set was scored.
 */
import { synapse } from "./synapse.mjs";
const tk = (s) => String(s ?? "").split(/[^a-z0-9]+/).filter((w) => w.length > 2);
function adjacency(g) {
  const a = new Map(); const p = (x, y, w) => { if (!a.has(x)) a.set(x, []); a.get(x).push([y, w]); };
  for (const [k, w] of g.edges) { const [x, y] = k.split("\u0000"); p(x, y, w); p(y, x, w); }
  return a;
}
export function createRanker(g, { idfW = 1, typeW = 1, pprIters = 10, pprW = 1, synW = 2 } = {}) {
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
/** Real-time learning: record one interaction (a -> b) into the live graph: add/strengthen the
 * edge and fire Hebbian on a, b and every entity a's observations mention. */
import { hebbian } from "./synapse.mjs";
export function observeInteraction(g, a, b, { minLen = 4 } = {}) {
  for (const n of [a, b]) if (!g.nodes.has(n)) g.nodes.set(n, { type: "unknown", obs: 0, text: n.toLowerCase() });
  const k = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`; g.edges.set(k, (g.edges.get(k) ?? 0) + 1);
  const t = g.nodes.get(a).text; hebbian(g, [a, b, ...[...g.nodes.keys()].filter((m) => m.length >= minLen && m !== a && m !== b && t.includes(m.toLowerCase()))]);
}
