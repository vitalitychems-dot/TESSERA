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
  // Token ids: per node an Int32Array of token ids in the same order as T.get(n), and an idf table with the same values.
  const tokId = new Map(); for (const w of df.keys()) tokId.set(w, tokId.size);
  const idfT = new Float64Array(tokId.size); for (const [w, c] of df) idfT[tokId.get(w)] = Math.log(N.length / c);
  const TOK = N.map((n) => Int32Array.from(T.get(n), (w) => tokId.get(w)));
  const sMark = new Int32Array(tokId.size); let sGen = 0;
  const topS = new Float64Array(64); const topN = new Array(64);
  const better = (s1, n1, s2, n2) => s1 > s2 || (s1 === s2 && n1 < n2);
  return function rank(seed, k = 5) {
    const S = T.get(seed) ?? new Set(); const st = g.nodes.get(seed)?.type;
    let stot = 0; for (const w of S) stot += idfV.get(w) ?? idf0;
    sGen++; for (const w of S) sMark[tokId.get(w)] = sGen;
    const si = ix.get(seed); const usePpr = pprW && si !== undefined; if (usePpr) ppr(si);
    nbGen++; if (si !== undefined) for (let e = off[si], end = off[si + 1]; e < end; e++) nbMark[nbrA[e]] = nbGen;
    // A node with no index (j < 0) has no edges in the build-time adjacency, so it is never a neighbour of the seed.
    let sm = null;
    // Synapses are still read live: when there are few of them, scan g.syn once per call for the seed's partners
    // (same values, same keys); otherwise look each candidate up as before.
    if (g.syn.size <= N.length) {
      sm = new Map(); const pre = seed + "\u0000", suf = "\u0000" + seed;
      for (const [kk, w] of g.syn) {
        if (kk.startsWith(pre)) { const p = kk.slice(pre.length); if (seed < p) sm.set(p, w); }
        if (kk.endsWith(suf)) { const p = kk.slice(0, kk.length - suf.length); if (p < seed) sm.set(p, w); }
      }
    }
    // Top-k selection for small integer k: (score desc, name asc) is a strict total order, so the first k are the same.
    const sel = Number.isInteger(k) && k >= 1 && k <= 64; let len = 0;
    const ttS = tt.get(st) || 1; const fac = new Map(); const out = [];
    for (let c = 0; c < N.length; c++) {
      const n = N[c]; const j = NI[c];
      if (n === seed || (j >= 0 && nbMark[j] === nbGen)) continue; let s = 0;
      if (j >= 0) for (let e = off[j], end = off[j + 1]; e < end; e++) { const m = nbrA[e]; if (nbMark[m] === nbGen) s += invLogA[m]; }
      s += synW * (sm ? (sm.get(n) ?? 0) : synapse(g, seed, n));
      let i = 0; const ta = TOK[c]; for (let q = 0; q < ta.length; q++) { const t = ta[q]; if (sMark[t] === sGen) i += idfT[t]; } s += idfW * (i / (stot || 1));
      s += pprW * 10 * (usePpr && j >= 0 && mark[j] === gen ? pv[j] : 0);
      const ty = g.nodes.get(n).type; let f = fac.get(ty);
      if (f === undefined) { f = 1 + typeW * ((tp.get(`${st}|${ty}`) ?? 0) / ttS); fac.set(ty, f); }
      s *= f;
      if (s > 0) {
        if (sel) {
          let p;
          if (len < k) p = len++; else if (better(s, n, topS[k - 1], topN[k - 1])) p = k - 1; else continue;
          while (p > 0 && better(s, n, topS[p - 1], topN[p - 1])) { topS[p] = topS[p - 1]; topN[p] = topN[p - 1]; p--; }
          topS[p] = s; topN[p] = n;
        } else out.push([n, s]);
      }
    }
    if (sel) return topN.slice(0, len);
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
