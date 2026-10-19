/**
 * IDEAS-B3-02 learned affect reader. Features: word unigrams with negation scope ("not_x"),
 * intensity (caps, !, intensifiers), punctuation/emoji, status cues, and the lexicon label.
 * Models: multinomial naive Bayes and L2 multinomial logistic regression (plain SGD), local only.
 */
import { classify } from "./affect.mjs";
const NEG = new Set(["not", "no", "never", "don't", "dont", "isn't", "wasn't", "can't", "cannot", "won't", "nothing", "without"]);
const INTENS = new Set(["very", "really", "still", "again", "all", "every", "fully", "major"]);
export function features(text) {
  const raw = String(text); const t = raw.toLowerCase().replace(/<[a-z]+>/g, " ");
  const words = t.match(/[a-z][a-z'-]*|\d+/g) ?? []; const f = [];
  let neg = 0;
  for (const w of words) { if (NEG.has(w)) { neg = 3; f.push("NEG"); continue; } f.push(neg > 0 ? `not_${w}` : w); if (neg > 0) neg--; if (INTENS.has(w)) f.push("INTENS"); if (/^\d+$/.test(w)) f.push("NUM"); }
  if (/!/.test(raw)) f.push("BANG"); if (/\?/.test(raw)) f.push("Q"); if (/\b[A-Z]{3,}\b/.test(raw)) f.push("CAPS");
  if (/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(raw)) f.push("EMOJI");
  if (/\b(\d+)\s+(pass|passed)\b|exit 0|\bsuccess|\bclean(ly)?\b|\bmerged\b|\bmatch(es)?\b/i.test(raw)) f.push("CUE_OK");
  if (/\bfail|error|degraded|outage|blocked|not set|gone|refus|rejected|cannot|unmerged\b/i.test(raw)) f.push("CUE_BAD");
  if (/\b(stop|deadline|asap|now|immediately|faster|speed)\b/i.test(raw)) f.push("CUE_URG");
  f.push(`LEX_${classify(raw).affect}`);
  return f;
}
// Feature lists memoised per text for the trainers and readers below (read-only there). Nested CV
// re-trains on the same lines many times; the exported features() still returns a fresh array.
const featCache = new Map(); const feats = (text) => { const k = String(text); let f = featCache.get(k); if (!f) { f = features(k); if (featCache.size > 50000) featCache.clear(); featCache.set(k, f); } return f; };
export function trainNB(data, labels, { alpha = 1 } = {}) {
  const cnt = new Map(labels.map((l) => [l, new Map()])); const tot = new Map(labels.map((l) => [l, 0])); const pri = new Map(labels.map((l) => [l, 0])); const V = new Set();
  for (const x of data) { pri.set(x.y, pri.get(x.y) + 1); for (const f of feats(x.text)) { V.add(f); cnt.get(x.y).set(f, (cnt.get(x.y).get(f) ?? 0) + 1); tot.set(x.y, tot.get(x.y) + 1); } }
  return (text) => { const fs = feats(text); return labels.map((l) => [l, Math.log((pri.get(l) + 1) / (data.length + labels.length)) + fs.reduce((s, f) => s + Math.log(((cnt.get(l).get(f) ?? 0) + alpha) / (tot.get(l) + alpha * V.size)), 0)]).sort((a, b) => b[1] - a[1])[0][0]; };
}
export function trainLR(data, labels, { epochs = 30, lr = 0.3, l2 = 1e-3, balance = true, seed = 3 } = {}) {
  // Weights as one row per feature (index = label position) and the training rows resolved once
  // per sample, so SGD does no per-label Map lookups. Same sums in the same order as before.
  const L = labels.length; const li = new Map(labels.map((l, k) => [l, k])); const W = new Map(); const B = new Array(L).fill(0);
  const freq = labels.map((l) => data.filter((x) => x.y === l).length || 1); const cwk = (k) => (balance ? data.length / (L * freq[k]) : 1);
  const row = (f) => { let r = W.get(f); if (!r) W.set(f, (r = new Array(L).fill(0))); return r; };
  const X = data.map((x) => { const f = feats(x.text); return { r: f.map(row), y: x.y, cy: cwk(li.get(x.y)) }; }); let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const z = new Array(L); const e = new Array(L);
  const probs = (rs) => { let m = -Infinity; for (let k = 0; k < L; k++) { let a = 0; for (let j = 0; j < rs.length; j++) a += rs[j] ? rs[j][k] : 0; z[k] = B[k] + a; if (z[k] > m) m = z[k]; } let S = 0; for (let k = 0; k < L; k++) { e[k] = Math.exp(z[k] - m); S += e[k]; } const p = new Array(L); for (let k = 0; k < L; k++) p[k] = e[k] / S; return p; };
  for (let ep = 0; ep < epochs; ep++) {
    const order = X.map((_, i) => i).sort(() => rnd() - 0.5); const eta = lr / (1 + ep * 0.1); const keep = 1 - eta * l2;
    for (const i of order) { const { r, y, cy } = X[i]; const p = probs(r); for (let k = 0; k < L; k++) { const g = ((labels[k] === y ? 1 : 0) - p[k]) * cy; B[k] = B[k] + eta * g; const d = eta * g; for (let j = 0; j < r.length; j++) r[j][k] = r[j][k] * keep + d; } }
  }
  return (text) => { const p = probs(feats(text).map((f) => W.get(f))); return labels[p.indexOf(Math.max(...p))]; };
}
/** Default reader: balanced LR trained on the 218 labelled mesh-log lines (lazy, local). */
let reader = null;
export async function readAffect(text) {
  if (!reader) { const { MESHLOG } = await import("./meshlog-labels.mjs"); const d = MESHLOG.map((x) => ({ text: x.text, y: x.affect })); reader = trainLR(d, [...new Set(d.map((x) => x.y))]); }
  return reader(text);
}
