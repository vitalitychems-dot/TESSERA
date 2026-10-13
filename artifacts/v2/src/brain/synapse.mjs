/**
 * IDEAS-B1-01 brain/synapse layer. Weighted memory graph over MCP-memory JSONL
 * (entities + relations), Hebbian strengthening on co-activation, exponential decay,
 * spreading-activation recall, and a connectome-style module/hub map (label propagation).
 * Pure functions; no network, no I/O except what the caller passes in.
 */
export function loadGraph(jsonl) {
  const nodes = new Map(); const edges = new Map();
  for (const line of String(jsonl).split("\n")) {
    if (!line.trim()) continue; let r; try { r = JSON.parse(line); } catch { continue; }
    if (r.type === "entity") nodes.set(r.name, { type: r.entityType, obs: r.observations?.length ?? 0, text: `${r.name} ${(r.observations ?? []).join(" ")}`.toLowerCase() });
    else if (r.type === "relation" && r.from && r.to) {
      for (const n of [r.from, r.to]) if (!nodes.has(n)) nodes.set(n, { type: "unknown", obs: 0, text: n.toLowerCase() });
      link(edges, r.from, r.to, 1);
    }
  }
  return { nodes, edges, syn: new Map() };
}
const key = (a, b) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
function link(edges, a, b, w) { if (a === b) return; const k = key(a, b); edges.set(k, (edges.get(k) ?? 0) + w); }
export const weight = (g, a, b) => g.edges.get(key(a, b)) ?? 0;
export const synapse = (g, a, b) => g.syn.get(key(a, b)) ?? 0;
export function neighbors(g, n) {
  const out = [];
  for (const [k, w] of g.edges) { const [a, b] = k.split("\u0000"); if (a === n) out.push([b, w]); else if (b === n) out.push([a, w]); }
  return out;
}
/** Hebbian: every pair active together gains rate*(1-w/cap) on its synapse (kept apart from
 * the structural relation edges so recorded facts are never overwritten). */
export function hebbian(g, active, { rate = 0.5, cap = 10 } = {}) {
  const a = [...new Set(active)];
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
    if (a[i] === a[j]) continue; const w = synapse(g, a[i], a[j]); g.syn.set(key(a[i], a[j]), w + rate * (1 - w / cap));
  }
  return g;
}
/** Co-activation episodes: each entity fires with every other entity its observations mention. */
export function coMentionEpisodes(g, { minLen = 4 } = {}) {
  const names = [...g.nodes.keys()].filter((n) => n.length >= minLen);
  const eps = [];
  for (const [n, v] of g.nodes) { const hit = names.filter((m) => m !== n && v.text?.includes(m.toLowerCase())); if (hit.length) eps.push([n, ...hit]); }
  return eps;
}
/** Decay all synapses by factor; prune below floor (synaptic pruning). Returns pruned count. */
export function decay(g, { factor = 0.9, floor = 0.05 } = {}) {
  let pruned = 0;
  for (const [k, w] of g.syn) { const nw = w * factor; if (nw < floor) { g.syn.delete(k); pruned++; } else g.syn.set(k, nw); }
  return pruned;
}
const EMPTY_TOKENS = new Set();
const tokenCache = new WeakMap();
/** Observation tokens for a node. Same split as before; reused while `node.text` is unchanged. */
function tokenSet(node) {
  if (!node) return EMPTY_TOKENS;
  const text = node.text ?? "";
  const hit = tokenCache.get(node);
  if (hit && hit.text === text) return hit.set;
  const set = new Set(String(text).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  tokenCache.set(node, { text, set });
  return set;
}
const adjCache = new WeakMap();
/** Relation adjacency, reused while the edge map, its size, and its weight sum are unchanged.
 * Synapses are read live and are not part of this cache. */
function cachedEntry(g) {
  let sum = 0;
  for (const w of g.edges.values()) sum += w;
  const hit = adjCache.get(g);
  if (hit && hit.edges === g.edges && hit.size === g.edges.size && hit.sum === sum) return hit;
  const entry = { edges: g.edges, size: g.edges.size, sum, adj: adjacency(g), invLog: null };
  adjCache.set(g, entry);
  return entry;
}
function cachedAdjacency(g) {
  return cachedEntry(g).adj;
}
/** Adamic-Adar 1/log(1+degree) per node, built once per cached adjacency (same formula). */
function cachedInvLog(entry) {
  if (entry.invLog) return entry.invLog;
  const invLog = new Map();
  for (const [n, list] of entry.adj) invLog.set(n, 1 / Math.log(1 + list.length));
  entry.invLog = invLog;
  return invLog;
}
/** Link recall: rank non-neighbours of seed by Adamic-Adar over relations + synapse strength
 * + observation-token overlap. Returns top-k names. Use with no synapses for the baseline. */
export function predict(g, seed, k = 5, { synW = 2, textW = 1 } = {}) {
  const entry = cachedEntry(g);
  const adj = entry.adj;
  const nb = new Map(adj.get(seed) ?? []);
  const invLog = cachedInvLog(entry);
  const T = tokenSet(g.nodes.get(seed));
  const out = [];
  for (const n of g.nodes.keys()) {
    if (n === seed || nb.has(n)) continue;
    let s = 0;
    for (const [m] of adj.get(n) ?? []) if (nb.has(m)) s += invLog.get(m);
    s += synW * synapse(g, seed, n);
    if (textW) {
      const U = tokenSet(g.nodes.get(n));
      let i = 0;
      for (const w of T) if (U.has(w)) i++;
      s += textW * (i / ((T.size + U.size - i) || 1));
    }
    if (s > 0) out.push([n, s]);
  }
  return out.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, k).map(([n]) => n);
}
/** Spreading activation from seed, 2 hops, top-k (excluding seed). */
export function recall(g, seed, k = 5, { hops = 2, damp = 0.5 } = {}) {
  const adj = cachedAdjacency(g); const act = new Map([[seed, 1]]); let front = new Map([[seed, 1]]);
  for (let h = 0; h < hops; h++) {
    const next = new Map();
    for (const [n, a] of front) {
      const nb = adj.get(n) ?? []; const tot = nb.reduce((s, [, w]) => s + w, 0) || 1;
      for (const [m, w] of nb) { const v = a * damp * (w / tot) * nb.length ** 0; next.set(m, (next.get(m) ?? 0) + v); }
    }
    for (const [n, v] of next) act.set(n, (act.get(n) ?? 0) + v); front = next;
  }
  act.delete(seed);
  return [...act].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, k).map(([n]) => n);
}
function adjacency(g) {
  const adj = new Map(); const push = (a, b, w) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push([b, w]); };
  for (const [k, w] of g.edges) { const [a, b] = k.split("\u0000"); push(a, b, w); push(b, a, w); }
  return adj;
}
/** Connectome map: weighted label propagation modules + hubs (top weighted degree). */
export function connectome(g, { iters = 10, hubs = 5 } = {}) {
  const adj = adjacency(g); const label = new Map([...g.nodes.keys()].map((n) => [n, n]));
  const order = [...g.nodes.keys()].sort();
  for (let t = 0; t < iters; t++) {
    let changed = 0;
    for (const n of order) {
      const score = new Map();
      for (const [m, w] of adj.get(n) ?? []) score.set(label.get(m), (score.get(label.get(m)) ?? 0) + w);
      if (!score.size) continue;
      const best = [...score].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
      if (best !== label.get(n)) { label.set(n, best); changed++; }
    }
    if (!changed) break;
  }
  const deg = order.map((n) => [n, (adj.get(n) ?? []).reduce((s, [, w]) => s + w, 0)]).sort((a, b) => b[1] - a[1]);
  return { modules: new Set(label.values()).size, label, hubs: deg.slice(0, hubs).map(([n]) => n) };
}
