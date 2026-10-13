// v3 bench: node src/bench.mjs <memory.jsonl>  (outer held-out = every 5th line that is a relation, as bench4)
import { readFileSync, writeFileSync, statSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
import { loadGraph, hebbian, coMentionEpisodes, decay } from "../../v2/src/brain/synapse.mjs";
import { createRanker } from "../../v2/src/brain/context.mjs";
import { buildCrystal, serialize, parse, graphAt, positions, verify } from "./crystal.mjs";
const ms = (f) => { const t = process.hrtime.bigint(); const r = f(); return [r, Number(process.hrtime.bigint() - t) / 1e6]; };
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const split = (lines, pick) => { const held = [], rest = []; lines.forEach((l, i) => { const r = JSON.parse(l); (r.type === "relation" && pick(i) ? held : rest).push(l); }); return { held: held.map((l) => JSON.parse(l)), rest }; };
const learn = (g) => { for (const e of coMentionEpisodes(g)) hebbian(g, e); decay(g, { factor: 0.95, floor: 0.05 }); return g; };
const qs = (g, held) => held.filter((r) => g.nodes.has(r.from) && g.nodes.has(r.to) && [...g.edges.keys()].some(() => true));
function rankerWithPos(g, P, posW) {
  const R = createRanker(g); if (!posW) return R;
  return (seed, k) => { const base = R(seed, 50); const ps = P.get(seed); if (!ps) return base.slice(0, k);
    return base.map((n, i) => [n, 1 / (i + 1) + posW / (1 + Math.hypot(...(P.get(n) ?? [99, 99, 99]).map((v, j) => v - ps[j])))]).sort((a, b) => b[1] - a[1]).slice(0, k).map(([n]) => n); };
}
function recall(restLines, held, mode, posW = 0) {
  const g = mode === "v2" ? loadGraph(restLines.join("\n")) : graphAt(parse(serialize(buildCrystal(restLines.join("\n"), { layoutIters: posW ? 60 : 0 }))));
  const L = new Set([...g.edges.keys()].flatMap((k) => k.split("\u0000"))); const q = held.filter((r) => L.has(r.from) && L.has(r.to));
  const P = mode === "v2" ? new Map() : positions(buildCrystal(restLines.join("\n"), { layoutIters: posW ? 60 : 0 }));
  learn(g); const R = rankerWithPos(g, P, posW); return { queries: q.length, hits: q.filter((r) => R(r.from, 5).includes(r.to)).length };
}
export function run(jsonl) {
  const lines = jsonl.split("\n").filter(Boolean); const dir = mkdtempSync(join(tmpdir(), "v3-")); const fv2 = join(dir, "v2.jsonl"), fc = join(dir, "crystal.jsonl");
  writeFileSync(fv2, lines.join("\n") + "\n"); const [cells, buildMs] = ms(() => buildCrystal(jsonl)); writeFileSync(fc, serialize(cells));
  const l2 = [], l3 = []; for (let i = 0; i < 7; i++) { l2.push(ms(() => loadGraph(readFileSync(fv2, "utf8")))[1]); l3.push(ms(() => graphAt(parse(readFileSync(fc, "utf8"))))[1]); }
  const g2 = loadGraph(jsonl), g3 = graphAt(cells); const same = g2.nodes.size === g3.nodes.size && g2.edges.size === g3.edges.size && [...g2.edges].every(([k, w]) => g3.edges.get(k) === w);
  const outer = split(lines, (i) => i % 5 === 0); const inner = split(outer.rest, (i) => i % 5 === 1);
  const grid = [0, 0.5, 1, 2]; const innerScores = grid.map((w) => [w, recall(inner.rest, inner.held, "v3", w).hits]);
  const best = innerScores.reduce((a, b) => (b[1] > a[1] ? b : a));
  return {
    graphIdentical: same, integrityErrors: verify(cells), cells: cells.length, factCells: cells.filter((c) => c.h).length, repeatCells: cells.filter((c) => c.k === "v").length,
    diskBytes: { v2: statSync(fv2).size, v3: statSync(fc).size }, loadMsMedian: { v2: +med(l2).toFixed(2), v3: +med(l3).toFixed(2) }, buildMs: +buildMs.toFixed(1),
    recall5: { v2: recall(outer.rest, outer.held, "v2"), v3_sameRanker: recall(outer.rest, outer.held, "v3"), v3_posTerm: { innerGrid: innerScores, picked: best[0], outer: best[0] ? recall(outer.rest, outer.held, "v3", best[0]) : "same as sameRanker (w=0 picked)" } },
  };
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(run(readFileSync(process.argv[2], "utf8")), null, 1));
