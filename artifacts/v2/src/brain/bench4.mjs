// IDEAS-B4 bench: node src/brain/bench4.mjs <memory.jsonl>
import { readFileSync } from "node:fs";
import { loadGraph, predict, hebbian, coMentionEpisodes, decay } from "./synapse.mjs";
import { createRanker, observeInteraction } from "./context.mjs";
import { createTimeline } from "./temporal.mjs";
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(3); };
const time = (f) => { const t = process.hrtime.bigint(); const r = f(); return [r, Number(process.hrtime.bigint() - t) / 1e6]; };
function split(jsonl) { const held = [], rest = []; jsonl.split("\n").filter(Boolean).forEach((l, i) => { const r = JSON.parse(l); (r.type === "relation" && i % 5 === 0 ? held : rest).push(r); }); return { held, rest }; }
const build = (rs) => { const g = loadGraph(rs.map((r) => JSON.stringify(r)).join("\n")); for (const e of coMentionEpisodes(g)) hebbian(g, e); decay(g, { factor: 0.95, floor: 0.05 }); return g; };
const queries = (g, held) => { const L = new Set([...g.edges.keys()].flatMap((k) => k.split("\u0000"))); return held.filter((r) => L.has(r.from) && L.has(r.to)); };
/** Context recall@5 on the outer held-out relations: old predict vs new ranker, with McNemar discordants. */
export function benchContext(jsonl) {
  const { held, rest } = split(jsonl); const g = build(rest); const q = queries(g, held); const R = createRanker(g);
  const lo = [], ln = []; let b = 0, c = 0, old = 0, neu = 0;
  for (const r of q) {
    const [p1, t1] = time(() => predict(g, r.from, 5)); const [p2, t2] = time(() => R(r.from, 5)); lo.push(t1); ln.push(t2);
    const h1 = p1.includes(r.to), h2 = p2.includes(r.to); old += h1; neu += h2; if (h1 && !h2) b++; if (!h1 && h2) c++;
  }
  return { queries: q.length, before: old, after: neu, onlyOld: b, onlyNew: c, latencyMs: { before: { p50: pct(lo, 0.5), p95: pct(lo, 0.95) }, after: { p50: pct(ln, 0.5), p95: pct(ln, 0.95) } } };
}
/** Real-time learning: stream the second half of training relations as interactions into a graph
 * built from the first half. "structure" adds the edge only; "online" also fires Hebbian on it. */
export function benchOnline(jsonl) {
  const { held, rest } = split(jsonl); const ents = rest.filter((r) => r.type !== "relation"); const rels = rest.filter((r) => r.type === "relation");
  const h = Math.floor(rels.length / 2); const out = {};
  for (const mode of ["frozen", "structure", "online"]) {
    const g = build([...ents, ...rels.slice(0, h)]);
    if (mode !== "frozen") for (const r of rels.slice(h)) { if (mode === "online") observeInteraction(g, r.from, r.to); else { for (const n of [r.from, r.to]) if (!g.nodes.has(n)) g.nodes.set(n, { type: "unknown", obs: 0, text: n.toLowerCase() }); const k = r.from < r.to ? `${r.from}\u0000${r.to}` : `${r.to}\u0000${r.from}`; g.edges.set(k, (g.edges.get(k) ?? 0) + 1); } }
    const q = queries(build(rest), held); out[mode] = { queries: q.length, recall5: q.filter((r) => predict(g, r.from, 5).includes(r.to)).length };
  }
  return out;
}
/** Temporal: replay the file as a timeline (line index = time); snapshot(t) must equal loadGraph(lines<=t). */
export function benchTemporal(jsonl) {
  const lines = jsonl.split("\n").filter(Boolean); const T = createTimeline();
  lines.forEach((l, t) => { const r = JSON.parse(l); if (r.type === "entity") T.addNode(t, r.name, { type: r.entityType }); else if (r.type === "relation" && r.from && r.to) T.link(t, r.from, r.to, 1); });
  const checks = [0.25, 0.5, 0.75, 1].map((f) => Math.floor(f * (lines.length - 1))); let ok = 0; const lat = [];
  for (const t of checks) {
    const [s, ms] = time(() => T.at(t)); lat.push(ms); const ref = loadGraph(lines.slice(0, t + 1).join("\n"));
    if (s.nodes.size === ref.nodes.size && s.edges.size === ref.edges.size && [...ref.edges].every(([k, w]) => s.edges.get(k) === w)) ok++;
  }
  const [d, dms] = time(() => T.diff(checks[0], checks[2])); const back = T.diff(checks[2], checks[0]);
  const sym = d.edgesAdded.length === back.edgesRemoved.length && d.nodesAdded.length === back.nodesRemoved.length;
  return { events: T.events.length, snapshotsCorrect: `${ok}/${checks.length}`, diffSymmetric: sym, edgesAddedQ1toQ3: d.edgesAdded.length, latencyMs: { snapshotP50: pct(lat, 0.5), snapshotMax: pct(lat, 1), diff: +dms.toFixed(2) } };
}
if (import.meta.url === `file://${process.argv[1]}`) { const j = readFileSync(process.argv[2], "utf8"); console.log(JSON.stringify({ context: benchContext(j), online: benchOnline(j), temporal: benchTemporal(j) }, null, 1)); }
