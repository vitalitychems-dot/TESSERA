// IDEAS-B3 bench: affect reader, nested 5x5 CV on the 218 mesh-log lines (every line scored once
// as held-out; model picked on inner folds by macro-F1, a criterion fixed in advance).
import { MESHLOG } from "./meshlog-labels.mjs";
import { classify } from "./affect.mjs";
import { trainNB, trainLR } from "./affect-model.mjs";
import { macroF1 } from "./bench2.mjs";
export const AFFECT_MODELS = { nb: (d, L) => trainNB(d, L), lr: (d, L) => trainLR(d, L), lrUnbal: (d, L) => trainLR(d, L, { balance: false }) };
export function benchAffectModel() {
  const all = MESHLOG.map((x) => ({ text: x.text, y: x.affect })); const L = [...new Set(all.map((x) => x.y))];
  const ev = (fn, te) => { const g = te.map((x) => x.y), p = te.map((x) => fn(x.text)); return [macroF1(g, p), p.filter((y, i) => y === g[i]).length / g.length]; };
  const rows = [];
  for (let o = 0; o < 5; o++) {
    const te = all.filter((_, i) => i % 5 === o), tr = all.filter((_, i) => i % 5 !== o);
    const pick = Object.entries(AFFECT_MODELS).map(([k, m]) => { let F = 0; for (let f = 0; f < 5; f++) F += ev(m(tr.filter((_, i) => i % 5 !== f), L), tr.filter((_, i) => i % 5 === f))[0] / 5; return [k, F]; }).sort((a, b) => b[1] - a[1])[0][0];
    rows.push({ pick, before: ev((t) => classify(t).affect, te), after: ev(AFFECT_MODELS[pick](tr, L), te) });
  }
  const avg = (k, j) => Math.round((rows.reduce((s, r) => s + r[k][j], 0) / rows.length) * 1000) / 1000;
  return { n: all.length, picks: rows.map((r) => r.pick), before: { f1: avg("before", 0), acc: avg("before", 1) }, after: { f1: avg("after", 0), acc: avg("after", 1) } };
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(benchAffectModel()));
