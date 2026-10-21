import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGraph, hebbian, decay, recall, coMentionEpisodes } from "../src/brain/synapse.mjs";

/** Independent copy of the pre-cache recall: rebuilds neighbor lists on every call. */
function recallUsingFreshAdj(g, seed, k = 5, { hops = 2, damp = 0.5 } = {}) {
  const adj = new Map();
  const push = (a, b, w) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push([b, w]); };
  for (const [ek, w] of g.edges) { const [a, b] = ek.split("\u0000"); push(a, b, w); push(b, a, w); }
  const act = new Map([[seed, 1]]); let front = new Map([[seed, 1]]);
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

function brainGraph() {
  const jsonl = readFileSync(new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url), "utf8");
  const g = loadGraph(jsonl);
  for (const episode of coMentionEpisodes(g)) hebbian(g, episode);
  decay(g, { factor: 0.95, floor: 0.05 });
  return g;
}

const pct = (samples, p) => {
  const s = [...samples].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

test("recall matches fresh adjacency and stays stable across repeated calls", () => {
  const g = brainGraph();
  const seeds = [...g.nodes.keys()];
  assert.ok(seeds.length >= 30, `need ≥30 seeds, got ${seeds.length}`);
  let mismatches = 0;
  for (const seed of seeds) {
    const ref = recallUsingFreshAdj(g, seed, 5);
    const first = recall(g, seed, 5);
    const second = recall(g, seed, 5);
    assert.deepEqual(second, first, `unstable recall for ${seed}`);
    if (first.length !== ref.length || first.some((name, i) => name !== ref[i])) mismatches++;
    assert.deepEqual(first, ref, `mismatch for ${seed}`);
  }
  assert.equal(mismatches, 0);

  const runs = 200;
  const time = (fn) => {
    for (let i = 0; i < 20; i++) fn(seeds[i % seeds.length]);
    const samples = new Array(runs);
    for (let i = 0; i < runs; i++) {
      const t = process.hrtime.bigint();
      fn(seeds[i % seeds.length]);
      samples[i] = Number(process.hrtime.bigint() - t) / 1e6;
    }
    return { p50: +pct(samples, 0.5).toFixed(4), p95: +pct(samples, 0.95).toFixed(4) };
  };
  const before = time((seed) => recallUsingFreshAdj(g, seed, 5));
  const after = time((seed) => recall(g, seed, 5));
  console.log(`BRAIN_RECALL before p50/p95 ${before.p50}/${before.p95} → after ${after.p50}/${after.p95} mismatches=0 seeds=${seeds.length}`);
});
