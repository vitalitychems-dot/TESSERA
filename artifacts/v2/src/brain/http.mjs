/**
 * IDEAS-B1-05 /brain routes for the studio server (read-only GETs).
 *  /brain                 page   /brain.js  client
 *  /brain/graph?src=memory|celegans|hemibrain|flywire   nodes+edges with 3D positions
 *  /brain/learn?n=4       next Hebbian learning step on the memory graph (fired edges)
 *  /brain/snapshot?t=&prev=   memory graph at event index t, diff vs previous index
 *  /brain/snapshot?src=crystal&t=&prev=   same shape from the v3 crystal (adds p, v, src per item)
 * Memory file: TESSERA_BRAIN_MEMORY (path) or docs/v2/v2-memory.jsonl. Not a TESSERA_ENABLE flag.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildBrain, createBrainLoop, layout3d, replayAt } from "./view.mjs";
import { TEMPLATES, loadTemplate } from "./templates.mjs";
import { crystalSnapshot } from "../../../v3/src/crystal.mjs";
import { crystalCells } from "../../../v3/src/serve.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const memPath = () => process.env.TESSERA_BRAIN_MEMORY || join(HERE, "../../../../docs/v2/v2-memory.jsonl");
const cache = new Map(); let loop = null;
function memory() { return existsSync(memPath()) ? readFileSync(memPath(), "utf8") : ""; }
export function brainGraph(src = "memory", { layout = true } = {}) {
  const ck = layout ? src : `${src}:nolayout`;
  if (cache.has(ck)) return cache.get(ck);
  let out;
  if (src === "memory") {
    const b = buildBrain(memory());
    out = { src, nodes: b.nodes.map((n) => ({ id: n.id, group: n.type, p: n.p })), edges: [...b.relations.map(([a, c, w]) => ({ a, b: c, w, kind: "relation" })), ...b.synapses.map(([a, c, w]) => ({ a, b: c, w, kind: "synapse" }))], modules: b.modules, license: "Tessera memory graph" };
  } else if (TEMPLATES[src]) {
    const t = loadTemplate(src); const ids = [...new Set(t.edges.flatMap((e) => [e.from, e.to]))];
    const max = Math.max(...t.edges.map((e) => e.syn));
    const layer = (id) => (id.startsWith("in") ? -1 : id.startsWith("out") ? 1 : 0);
    const grid = (id) => { const n = Number(id.replace(/\D/g, "")); const w = id.startsWith("mlp") ? 16 : 10; return [((n % w) - w / 2) * 1.6, (Math.floor(n / w) - w / 2) * 1.6]; };
    const pos = t.kind === "weights" ? ids.map((id) => [layer(id) * 22, ...grid(id)]) : t.coords && ids.every((id) => t.coords[id]) ? ids.map((id) => t.coords[id]) : !layout ? ids.map(() => [0, 0, 0]) : layout3d(ids, t.edges.map((e) => [e.from, e.to, 4 * Math.log1p(e.syn) / Math.log1p(max)]), { iters: 100 });
    out = { src, name: t.name, nodes: ids.map((id, i) => ({ id, group: t.cortex?.[id] ?? t.networks?.[id] ?? id.replace(/[_(].*$/, "").replace(/[LR]$/, "").replace(/\d+$/, ""), p: pos[i] })), edges: t.edges.map((e) => ({ a: e.from, b: e.to, w: Math.log1p(e.syn), syn: e.syn, sign: e.inh > e.exc ? -1 : e.exc > 0 ? 1 : 0, kind: "synapse" })), license: `${t.species} · ${t.name} · ${t.license}${t.coordsSource ? ` · positions: ${t.coordsSource}` : " · positions: force layout"}` };
  } else return null;
  cache.set(ck, out); return out;
}
export function handleBrain(req, res, url) {
  if (req.method !== "GET") return false;
  const send = (type, body, code = 200) => { res.writeHead(code, { "content-type": type }); res.end(body); return true; };
  if (url.pathname === "/brain") return send("text/html; charset=utf-8", PAGE);
  if (url.pathname === "/brain.js") return send("text/javascript; charset=utf-8", readFileSync(join(HERE, "brain-client.js")));
  if (url.pathname === "/brain/graph") { const g = brainGraph(url.searchParams.get("src") ?? "memory"); return g ? send("application/json", JSON.stringify(g)) : send("application/json", '{"error":"unknown src"}', 404); }
  if (url.pathname === "/brain/learn") { loop ??= createBrainLoop(memory()); const s = loop.step(Math.min(16, Number(url.searchParams.get("n")) || 1)); if (s.done) loop = null; return send("application/json", JSON.stringify(s)); }
  if (url.pathname === "/brain/snapshot") {
    const q = url.searchParams;
    if (q.get("src") === "crystal")
      return send("application/json", JSON.stringify(crystalSnapshot(crystalCells(memPath(), memory), q.has("t") ? q.get("t") : undefined, q.has("prev") ? q.get("prev") : undefined)));
    return send("application/json", JSON.stringify(replayAt(memory(), q.has("t") ? q.get("t") : undefined, q.has("prev") ? q.get("prev") : undefined)));
  }
  return false;
}
const PAGE = `<!doctype html><meta charset="utf-8"><title>Tessera brain</title>
<style>body{margin:0;background:#05060a;color:#cfd6e6;font:13px system-ui}#ui{position:fixed;top:10px;left:10px;z-index:2}#replay{display:flex;gap:8px;align-items:center;margin-top:6px}#time{width:min(46vw,280px)}#diffcount{color:#9fdfb4;font-variant-numeric:tabular-nums}#info{position:fixed;bottom:10px;left:10px;max-width:70vw;opacity:.8}canvas{display:block}</style>
<div id="ui"><label>Brain <select id="src"><option value="memory">Tessera memory + synapses</option>${Object.keys(TEMPLATES).map((k) => `<option value="${k}">${k} — ${TEMPLATES[k].species}</option>`).join("")}</select></label> <span id="stat"></span><div id="replay"><label>Time <input id="time" type="range" min="0" max="0" value="0" step="1"></label> <span id="timelabel"></span> <span id="diffcount"></span></div></div>
<div id="info"></div><canvas id="brain-3d"></canvas>
<script type="module" src="/brain.js"></script>`;
