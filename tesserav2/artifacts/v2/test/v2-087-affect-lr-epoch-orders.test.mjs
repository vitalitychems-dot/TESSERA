import { test } from "node:test";
import assert from "node:assert/strict";
import { features, trainLR } from "../src/brain/affect-model.mjs";
import { MESHLOG } from "../src/brain/meshlog-labels.mjs";
import { HELDOUT } from "../src/brain/heldout.mjs";

/** R7-02 reference: the R5-01 row trainLR with the shuffle inline (sort(() => rnd() - 0.5) every epoch). */
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
const probe = [...MESHLOG, ...HELDOUT].map((x) => x.text).concat(["", "This is NOT working again!!", "ok merged 🎉", "stop now", "zzqx unseenword"]);

test("R7-02: replayed epoch orders match the inline shuffle across interleaved sizes, seeds and epochs", () => {
  // Same keys come back after other keys, and more than 64 distinct keys pass through, so the cache is
  // both hit and cleared during the run.
  const cases = [];
  for (let s = 0; s < 70; s++) cases.push({ n: 40 + (s % 5), opt: { seed: s, epochs: 2 } });
  cases.push({ n: 174, opt: {} }, { n: 139, opt: { balance: false } }, { n: 174, opt: { epochs: 3, seed: 11 } }, { n: 174, opt: {} }, { n: 40, opt: { seed: 0, epochs: 2 } }, { n: 41, opt: { seed: 69, epochs: 2 } });
  for (const { n, opt } of cases) {
    const tr = all.slice(0, n); const a = trainLRRows(tr, L, opt), b = trainLR(tr, L, opt);
    for (const t of probe) assert.equal(b(t), a(t), `${n} ${JSON.stringify(opt)} ${t}`);
  }
});
