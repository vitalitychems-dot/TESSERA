// node src/bench-pack.mjs <memory.jsonl>: tokens/query and recall on the 87 outer held-out relations.
import { readFileSync } from "node:fs";
import { loadGraph, hebbian, coMentionEpisodes, decay } from "../../v2/src/brain/synapse.mjs";
import { createRanker } from "../../v2/src/brain/context.mjs";
import { tokens, entityText, idfTable, packV2, packV3, fitBudget } from "./pack.mjs";
export function run(jsonl, { K = 30 } = {}) {
  const lines = jsonl.split("\n").filter(Boolean); const held = [], rest = [];
  lines.forEach((l, i) => { const r = JSON.parse(l); (r.type === "relation" && i % 5 === 0 ? held : rest).push(l); });
  const raw = rest.map((l) => JSON.parse(l)); const g = loadGraph(rest.join("\n")); for (const e of coMentionEpisodes(g)) hebbian(g, e); decay(g, { factor: 0.95, floor: 0.05 });
  const L = new Set([...g.edges.keys()].flatMap((k) => k.split("\u0000"))); const q = held.map((l) => JSON.parse(l)).filter((r) => L.has(r.from) && L.has(r.to));
  const R = createRanker(g); const E = entityText(raw); const idf = idfTable(E);
  const V = { v2: (ids) => packV2(E, ids), dedupe: (ids) => packV3(E, ids, { prune: false, pack: false }), pack: (ids) => packV3(E, ids, { dedupe: false, prune: false }),
    prune: (ids) => packV3(E, ids, { dedupe: false, pack: false, idf }), sink16: (ids) => packV3(E, ids, { dedupe: false, prune: false, pack: false, sink: 16 }),
    all: (ids) => packV3(E, ids, { idf }), all_sink16: (ids) => packV3(E, ids, { idf, sink: 16 }) };
  const ranked = q.map((r) => ({ r, ids: R(r.from, K) })); const out = {};
  const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1]; const mean = (a) => +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(1);
  const t2 = ranked.map(({ ids }) => tokens(V.v2(ids.slice(0, 5)))); const budget = med(t2);
  for (const [name, f] of Object.entries(V)) {
    const tk = ranked.map(({ ids }) => tokens(f(ids.slice(0, 5)))); const hit5 = ranked.filter(({ r, ids }) => { const s = f(ids.slice(0, 5)); return ids.slice(0, 5).includes(r.to) && s.includes(r.to); }).length;
    const fit = ranked.map(({ r, ids }) => { const used = fitBudget(f, ids, budget); return { n: used.length, hit: used.includes(r.to) }; });
    out[name] = { tokensPerQuery_top5: { mean: mean(tk), median: med(tk) }, recall_top5: hit5, atEqualBudget: { budgetTokens: budget, itemsMean: mean(fit.map((x) => x.n)), recall: fit.filter((x) => x.hit).length } };
  }
  return { queries: q.length, tokenizer: "regex word/punct count (approximate, no BPE)", variants: out };
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(run(readFileSync(process.argv[2], "utf8")), null, 1));
