// IDEAS-B2 bench: node src/brain/bench2.mjs [test-log]
import { readFileSync } from "node:fs";
import { MESHLOG } from "./meshlog-labels.mjs";
import { HELDOUT } from "./heldout.mjs";
import { createRecognizer, SCHEDULES } from "./learn.mjs";
import { classify } from "./affect.mjs";
import { loadTemplate } from "./templates.mjs";
import { scanTestLog, propose, summarize } from "./selfscan.mjs";
export const macroF1 = (g, p) => { const L = [...new Set(g)]; return L.reduce((a, l) => { let tp = 0, fp = 0, fn = 0; g.forEach((x, i) => { if (p[i] === l && x === l) tp++; else if (p[i] === l) fp++; else if (x === l) fn++; }); return a + (tp ? (2 * tp) / (2 * tp + fp + fn) : 0); }, 0) / L.length; };
const r3 = (x) => Math.round(x * 1000) / 1000;
/** Empathy set: lexicon on the 218 real mesh-log lines (never tuned on). */
export function benchMeshlog() {
  const out = { n: MESHLOG.length };
  for (const d of ["intent", "affect"]) { const g = MESHLOG.map((x) => x[d]); const p = MESHLOG.map((x) => classify(x.text)[d]); out[d] = { f1: r3(macroF1(g, p)), acc: r3(p.filter((y, i) => y === g[i]).length / g.length) }; }
  return out;
}
/** Learning loop: schedule picked by 5-fold CV on dev (80%); scored once on the fresh hidden 20%. */
export function benchLearning() {
  const all = [...MESHLOG, ...HELDOUT]; const hidden = all.filter((_, i) => i % 5 === 1); const dev = all.filter((_, i) => i % 5 !== 1);
  const run = (s, dim, tr, te, labels) => { const R = createRecognizer(dim, labels); SCHEDULES[s](R, tr, dim); const g = te.map((x) => x[dim]); const p = te.map((x) => (s === "none" ? classify(x.text)[dim] : R.predict(x.text))); return { f1: r3(macroF1(g, p)), acc: r3(p.filter((y, i) => y === g[i]).length / g.length) }; };
  const out = { dev: dev.length, hidden: hidden.length };
  for (const dim of ["intent", "affect"]) {
    const labels = [...new Set(all.map((x) => x[dim]))]; const cv = {};
    for (const s of Object.keys(SCHEDULES)) { let acc = 0; for (let k = 0; k < 5; k++) acc += run(s, dim, dev.filter((_, i) => i % 5 !== k), dev.filter((_, i) => i % 5 === k), labels).acc / 5; cv[s] = r3(acc); }
    const pick = Object.entries(cv).filter(([s]) => s !== "none").sort((a, b) => b[1] - a[1])[0][0];
    out[dim] = { cvAcc: cv, picked: pick, before: run("none", dim, dev, hidden, labels), after: run(pick, dim, dev, hidden, labels) };
  }
  return out;
}
/** Anatomy: share of human parcels at real centroids, and distance vs tract strength (Spearman). */
export function benchAnatomy() {
  const t = loadTemplate("human"); const ids = [...new Set(t.edges.flatMap((e) => [e.from, e.to]))];
  const placed = ids.filter((id) => t.coords[id]).length;
  const pts = t.edges.map((e) => [Math.hypot(...[0, 1, 2].map((q) => t.coords[e.from][q] - t.coords[e.to][q])), e.syn]);
  const rank = (a) => { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = []; o.forEach(([, i], k) => (r[i] = k)); return r; };
  const a = rank(pts.map((p) => p[0])), b = rank(pts.map((p) => p[1])); const n = a.length; const d2 = a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
  return { parcels: ids.length, placedAtCentroid: placed, spearmanDistVsStrength: r3(1 - (6 * d2) / (n * (n * n - 1))) };
}
export function benchSelfScan(log) { const P = propose(scanTestLog(log)); return { ...summarize(P), titles: P.map((p) => p.title) }; }
if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify({ meshlog: benchMeshlog(), learning: benchLearning(), anatomy: benchAnatomy(), selfscan: process.argv[2] ? benchSelfScan(readFileSync(process.argv[2], "utf8")) : null }, null, 1));
