// IDEAS-B1 bench: node src/brain/bench.mjs <full-picture-memory.jsonl>
import { readFileSync } from "node:fs";
import { loadGraph, hebbian, decay, predict, coMentionEpisodes, connectome } from "./synapse.mjs";
import { classify } from "./affect.mjs";
import { createLearner, simulate } from "./learn.mjs";
import { gate } from "./selfpatch.mjs";
import { PATCH_FIXTURE } from "./fixtures.mjs";
import { HELDOUT } from "./heldout.mjs";
/** Held-out link recall: every 5th relation line is hidden; queries are hidden relations whose
 * endpoints both still appear in the training graph. Baseline = same ranker, no synapses, no text. */
export function benchSynapse(jsonl, ks = [5, 10]) {
  const lines = jsonl.split("\n").filter(Boolean); const held = []; const rest = [];
  lines.forEach((l, i) => { const r = JSON.parse(l); (r.type === "relation" && i % 5 === 0 ? held : rest).push(r); });
  const g = loadGraph(rest.map((r) => JSON.stringify(r)).join("\n"));
  const linked = new Set([...g.edges.keys()].flatMap((k) => k.split("\u0000")));
  const q = held.filter((r) => linked.has(r.from) && linked.has(r.to));
  const at = (k, opt) => q.filter((r) => predict(g, r.from, k, opt).includes(r.to)).length;
  const before = Object.fromEntries(ks.map((k) => [`recall@${k}`, at(k, { synW: 0, textW: 0 })]));
  const eps = coMentionEpisodes(g); for (const e of eps) hebbian(g, e); const pruned = decay(g, { factor: 0.95, floor: 0.05 });
  const after = Object.fromEntries(ks.map((k) => [`recall@${k}`, at(k)]));
  const c = connectome(g);
  return { heldOut: held.length, queries: q.length, episodes: eps.length, before, after, pruned, modules: c.modules, hubs: c.hubs };
}
const macroF1 = (gold, pred) => { const labs = [...new Set(gold)]; return labs.reduce((acc, l) => { let tp = 0, fp = 0, fn = 0; gold.forEach((g, i) => { if (pred[i] === l && g === l) tp++; else if (pred[i] === l) fp++; else if (g === l) fn++; }); return acc + (tp ? (2 * tp) / (2 * tp + fp + fn) : 0); }, 0) / labs.length; };
/** Held-out (HELDOUT, never tuned on). Baseline = majority class (no recognizer). */
export function benchAffect() {
  const out = { n: HELDOUT.length };
  for (const d of ["intent", "affect"]) {
    const gold = HELDOUT.map((x) => x[d]); const cnt = {}; for (const g of gold) cnt[g] = (cnt[g] ?? 0) + 1;
    const maj = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]; const pred = HELDOUT.map((x) => classify(x.text)[d]);
    out[d] = { baselineF1: +macroF1(gold, gold.map(() => maj)).toFixed(3), baselineAcc: cnt[maj], f1: +macroF1(gold, pred).toFixed(3), acc: pred.filter((p, i) => p === gold[i]).length };
  }
  return out;
}
export function benchLearn() {
  const topics = ["git", "tests", "gates", "relay", "tokens", "mesh"]; const difficulty = { git: 0.3, tests: 0.5, gates: 0.9, relay: 0.6, tokens: 0.4, mesh: 0.8 };
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; const mean = (f) => seeds.reduce((s, seed) => s + simulate(f, { topics, difficulty, seed }), 0) / seeds.length;
  return { seeds: seeds.length, roundRobinMeanSteps: mean((L, s) => { const open = topics.filter((t) => !L.mastered(t)); return open.length ? open[s % open.length] : null; }), adaptiveMeanSteps: mean((L) => L.next()) };
}
export function benchPatch() {
  const unsafe = PATCH_FIXTURE.filter((p) => !p.safe).length;
  return { proposals: PATCH_FIXTURE.length, unsafe, naiveAccepted: unsafe, gatedAccepted: PATCH_FIXTURE.filter((p) => !p.safe && gate(p).ok).length, safeRejected: PATCH_FIXTURE.filter((p) => p.safe && !gate(p).ok).length };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const f = process.argv[2];
  console.log(JSON.stringify({ synapse: f ? benchSynapse(readFileSync(f, "utf8")) : null, affect: benchAffect(), learn: benchLearn(), patch: benchPatch() }, null, 1));
}
