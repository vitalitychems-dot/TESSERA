import { test } from "node:test";
import assert from "node:assert/strict";
import { features, trainLR, trainNB } from "../src/brain/affect-model.mjs";
import { MESHLOG } from "../src/brain/meshlog-labels.mjs";
import { HELDOUT } from "../src/brain/heldout.mjs";

/** R5-01 reference: the pre-change trainLR (per-label weight Maps, features per call). */
function trainLRRef(data, labels, { epochs = 30, lr = 0.3, l2 = 1e-3, balance = true, seed = 3 } = {}) {
  const W = new Map(labels.map((l) => [l, new Map()])); const B = new Map(labels.map((l) => [l, 0]));
  const freq = new Map(labels.map((l) => [l, data.filter((x) => x.y === l).length || 1])); const cw = (l) => (balance ? data.length / (labels.length * freq.get(l)) : 1);
  const X = data.map((x) => ({ f: features(x.text), y: x.y })); let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const probs = (fs) => { const z = labels.map((l) => B.get(l) + fs.reduce((a, f) => a + (W.get(l).get(f) ?? 0), 0)); const m = Math.max(...z); const e = z.map((v) => Math.exp(v - m)); const S = e.reduce((a, b) => a + b, 0); return e.map((v) => v / S); };
  for (let ep = 0; ep < epochs; ep++) {
    const order = X.map((_, i) => i).sort(() => rnd() - 0.5); const eta = lr / (1 + ep * 0.1);
    for (const i of order) { const { f, y } = X[i]; const p = probs(f); labels.forEach((l, k) => { const g = ((l === y ? 1 : 0) - p[k]) * cw(y); B.set(l, B.get(l) + eta * g); const w = W.get(l); for (const ft of f) w.set(ft, (w.get(ft) ?? 0) * (1 - eta * l2) + eta * g); }); }
  }
  return (text) => { const p = probs(features(text)); return labels[p.indexOf(Math.max(...p))]; };
}

const all = MESHLOG.map((x) => ({ text: x.text, y: x.affect })); const L = [...new Set(all.map((x) => x.y))];
const probe = [...MESHLOG, ...HELDOUT].map((x) => x.text).concat(["", "This is NOT working again!!", "ok merged 🎉", "stop now"]);

test("R5-01: row-weight trainLR predicts every real line exactly as the per-label Map version", () => {
  for (const opt of [{}, { balance: false }, { epochs: 3, seed: 11 }]) {
    const tr = all.filter((_, i) => i % 5 !== 1); const a = trainLRRef(tr, L, opt), b = trainLR(tr, L, opt);
    for (const t of probe) assert.equal(b(t), a(t), t);
  }
});

test("R5-01: memoised features stay internal; features() still returns a fresh array", () => {
  const t = "This is NOT working again!!"; const f1 = features(t); f1.push("MUTATED");
  assert.ok(!features(t).includes("MUTATED"));
  const nb = trainNB(all, L), lr = trainLR(all, L);
  assert.equal(nb(t), trainNB(all, L)(t)); assert.equal(lr(t), trainLR(all, L)(t));
});
