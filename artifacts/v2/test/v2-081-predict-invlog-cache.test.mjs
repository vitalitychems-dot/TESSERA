import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGraph, hebbian, decay, predict, synapse, coMentionEpisodes } from "../src/brain/synapse.mjs";

/** R4-22 reference: predict with adjacency and inv-log degrees rebuilt on every call. */
function predictFresh(g, seed, k = 5, { synW = 2, textW = 1 } = {}) {
  const adj = new Map(); const push = (a, b, w) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push([b, w]); };
  for (const [ek, w] of g.edges) { const [a, b] = ek.split("\u0000"); push(a, b, w); push(b, a, w); }
  const nb = new Map(adj.get(seed) ?? []); const invLog = new Map();
  for (const [n, list] of adj) invLog.set(n, 1 / Math.log(1 + list.length));
  const toks = (n) => new Set(String(g.nodes.get(n)?.text ?? "").split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const T = toks(seed); const out = [];
  for (const n of g.nodes.keys()) {
    if (n === seed || nb.has(n)) continue; let s = 0;
    for (const [m] of adj.get(n) ?? []) if (nb.has(m)) s += invLog.get(m);
    s += synW * synapse(g, seed, n);
    if (textW) { const U = toks(n); let i = 0; for (const w of T) if (U.has(w)) i++; s += textW * (i / ((T.size + U.size - i) || 1)); }
    if (s > 0) out.push([n, s]);
  }
  return out.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, k).map(([n]) => n);
}

test("R4-22: predict with cached inv-log degrees matches a fresh rebuild, before and after an edge change", () => {
  const g = loadGraph(readFileSync(new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url), "utf8"));
  for (const e of coMentionEpisodes(g)) hebbian(g, e);
  decay(g, { factor: 0.95, floor: 0.05 });
  const seeds = [...g.nodes.keys()];
  for (const s of seeds) assert.deepEqual(predict(g, s, 5), predictFresh(g, s, 5), s);
  g.edges.set(`${seeds[0]}\u0000${seeds[1]}`, 3);
  for (const s of seeds) assert.deepEqual(predict(g, s, 5), predictFresh(g, s, 5), `after edit ${s}`);
});
