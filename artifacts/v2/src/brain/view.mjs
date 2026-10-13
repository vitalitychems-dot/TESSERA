/**
 * IDEAS-B1-05 Brain view model. Real memory graph + synapse layer -> 3D force layout and a
 * learning-event stream for the studio /brain page. No synthetic nodes: every node is a
 * memory entity or relation endpoint, every edge a recorded relation or learned synapse.
 */
import { loadGraph, hebbian, coMentionEpisodes, synapse } from "./synapse.mjs";
import { connectome } from "./synapse.mjs";
const K = (a, b) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
function rng(seed = 7) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
/** Deterministic 3D force layout (repulsion via grid buckets + spring edges + centering). */
export function layout3d(ids, links, { iters = 120, seed = 7 } = {}) {
  const r = rng(seed); const n = ids.length; const idx = new Map(ids.map((id, i) => [id, i]));
  const P = ids.map(() => [r() * 20 - 10, r() * 20 - 10, r() * 20 - 10]);
  const L = links.map(([a, b, w]) => [idx.get(a), idx.get(b), w]).filter(([a, b]) => a != null && b != null);
  for (let t = 0; t < iters; t++) {
    const F = P.map(() => [0, 0, 0]); const cool = 1 - t / iters;
    const cell = 4; const grid = new Map();
    P.forEach((p, i) => { const k = p.map((v) => Math.floor(v / cell)).join(","); (grid.get(k) ?? grid.set(k, []).get(k)).push(i); });
    P.forEach((p, i) => {
      const c = p.map((v) => Math.floor(v / cell));
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const j of grid.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`) ?? []) {
          if (j <= i) continue; const d = [0, 1, 2].map((q) => p[q] - P[j][q]); const d2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 + 0.01;
          const f = 2 / d2; for (let q = 0; q < 3; q++) { F[i][q] += d[q] * f; F[j][q] -= d[q] * f; }
        }
      }
    });
    for (const [a, b, w] of L) { const d = [0, 1, 2].map((q) => P[b][q] - P[a][q]); const len = Math.hypot(...d) || 1; const f = 0.05 * Math.min(w, 4) * (len - 2) / len; for (let q = 0; q < 3; q++) { F[a][q] += d[q] * f; F[b][q] -= d[q] * f; } }
    P.forEach((p, i) => { for (let q = 0; q < 3; q++) p[q] += Math.max(-1, Math.min(1, (F[i][q] - p[q] * 0.01) * cool)); });
  }
  return P.map((p) => p.map((v) => Math.round(v * 100) / 100));
}
/** Build the view: nodes (type, module), relation edges, top synapse edges by weight. */
export function buildBrain(jsonl, { maxSynapses = 2500, layoutIters = 120 } = {}) {
  const g = loadGraph(jsonl);
  const episodes = coMentionEpisodes(g);
  const learned = loadGraph(jsonl); for (const e of episodes) hebbian(learned, e);
  const syn = [...learned.syn].sort((a, b) => b[1] - a[1]).slice(0, maxSynapses).map(([k, w]) => [...k.split("\u0000"), Math.round(w * 1000) / 1000]);
  const rel = [...g.edges].map(([k, w]) => [...k.split("\u0000"), w]);
  const ids = [...g.nodes.keys()];
  const pos = layout3d(ids, [...rel, ...syn], { iters: layoutIters });
  const c = connectome(learned);
  const nodes = ids.map((id, i) => ({ id, type: g.nodes.get(id).type, module: c.label.get(id), p: pos[i] }));
  return { nodes, relations: rel, synapses: syn, episodes, hubs: c.hubs, modules: c.modules };
}
/** Live learning: replay real co-activation episodes as Hebbian updates; each step returns fired edges with new weights. */
export function createBrainLoop(jsonl) {
  const g = loadGraph(jsonl); const eps = coMentionEpisodes(g); let i = 0;
  return {
    episodes: eps.length,
    step(n = 1) {
      const fired = [];
      for (let s = 0; s < n && i < eps.length; s++, i++) {
        const e = eps[i]; hebbian(g, e);
        for (const m of e.slice(1)) fired.push([e[0], m, Math.round(synapse(g, e[0], m) * 1000) / 1000]);
      }
      return { done: i >= eps.length, at: i, fired };
    },
  };
}
export { K as synKey };
