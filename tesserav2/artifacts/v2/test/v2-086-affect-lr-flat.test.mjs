import { test } from "node:test";
import assert from "node:assert/strict";
import { features, trainLR } from "../src/brain/affect-model.mjs";
import { MESHLOG } from "../src/brain/meshlog-labels.mjs";
import { HELDOUT } from "../src/brain/heldout.mjs";

/** R6-02 reference: the R5-01 trainLR (one plain-array weight row per feature, closure kernels), returning probabilities. */
function trainLRRows(data, labels, { epochs = 30, lr = 0.3, l2 = 1e-3, balance = true, seed = 3 } = {}) {
  const L = labels.length; const li = new Map(labels.map((l, k) => [l, k])); const W = new Map(); const B = new Array(L).fill(0);
  const freq = labels.map((l) => data.filter((x) => x.y === l).length || 1); const cwk = (k) => (balance ? data.length / (L * freq[k]) : 1);
  const row = (f) => { let r = W.get(f); if (!r) W.set(f, (r = new Array(L).fill(0))); return r; };
  const X = data.map((x) => { const f = features(x.text); return { r: f.map(row), y: x.y, cy: cwk(li.get(x.y)) }; }); let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const z = new Array(L); const e = new Array(L);
  const probs = (rs) => { let m = -Infinity; for (let k = 0; k < L; k++) { let a = 0; for (let j = 0; j < rs.length; j++) a += rs[j] ? rs[j][k] : 0; z[k] = B[k] + a; if (z[k] > m) m = z[k]; } let S = 0; for (let k = 0; k < L; k++) { e[k] = Math.exp(z[k] - m); S += e[k]; } const p = new Array(L); for (let k = 0; k < L; k++) p[k] = e[k] / S; return p; };
  for (let ep = 0; ep < epochs; ep++) {
    const order = X.map((_, i) => i).sort(() => rnd() - 0.5); const eta = lr / (1 + ep * 0.1); const keep = 1 - eta * l2;
    for (const i of order) { const { r, y, cy } = X[i]; const p = probs(r); for (let k = 0; k < L; k++) { const g = ((labels[k] === y ? 1 : 0) - p[k]) * cy; B[k] = B[k] + eta * g; const d = eta * g; for (let j = 0; j < r.length; j++) r[j][k] = r[j][k] * keep + d; } }
  }
  return (text) => { const p = probs(features(text).map((f) => W.get(f))); return labels[p.indexOf(Math.max(...p))]; };
}

const all = MESHLOG.map((x) => ({ text: x.text, y: x.affect })); const L = [...new Set(all.map((x) => x.y))];
let probe = [...MESHLOG, ...HELDOUT].map((x) => x.text).concat(["", "This is NOT working again!!", "ok merged 🎉", "stop now", "zzqx unseenword"]);
// Longer than the 64-slot read buffer, so the buffer grows mid-run.
probe.push(MESHLOG.slice(0, 12).map((x) => x.text).join(" "), MESHLOG.slice(40, 70).map((x) => x.text).join(" "));

test("R6-02: flat-weight trainLR predicts every real line exactly as the R5-01 row version", () => {
  for (const opt of [{}, { balance: false }, { epochs: 3, seed: 11 }, { lr: 0.1, l2: 1e-2 }]) {
    const tr = all.filter((_, i) => i % 5 !== 2); const a = trainLRRows(tr, L, opt), b = trainLR(tr, L, opt);
    for (const t of probe) assert.equal(b(t), a(t), t);
  }
});

test("R6-02: models trained side by side keep separate weights", () => {
  const a = trainLR(all.filter((_, i) => i % 2 === 0), L), b = trainLR(all.filter((_, i) => i % 2 === 1), L);
  const ra = trainLRRows(all.filter((_, i) => i % 2 === 0), L), rb = trainLRRows(all.filter((_, i) => i % 2 === 1), L);
  for (const t of probe) { assert.equal(a(t), ra(t), t); assert.equal(b(t), rb(t), t); }
});
