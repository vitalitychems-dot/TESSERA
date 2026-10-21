/**
 * Creator style fingerprint: char 3-gram + word unigram/bigram profiles plus typing habits
 * (lowercase starts, missing end punctuation, run-on length, doubled spaces, curly apostrophes,
 * common typo shapes). Scores authorship as log-odds of creator profile vs. other-text profile.
 * Pure; no I/O. Raw text never leaves the caller.
 */
const grams = (s, n) => { const t = ` ${s.toLowerCase()} `; const m = new Map(); for (let i = 0; i + n <= t.length; i++) { const g = t.slice(i, i + n); m.set(g, (m.get(g) ?? 0) + 1); } return m; };
const words = (s) => s.toLowerCase().match(/[a-z’']+/g) ?? [];
export function habits(s) {
  const w = words(s); const n = Math.max(1, w.length);
  return [
    /^[A-Z]/.test(s) ? 1 : 0,                         // capitalised start
    /[.!?]\s*$/.test(s) ? 1 : 0,                      // terminal punctuation
    Math.min(1, ((s.match(/[,.;:]/g) ?? []).length) / n * 5), // punctuation density
    Math.min(1, n / 120),                              // message length
    / {2,}/.test(s) ? 1 : 0,                           // doubled spaces
    /’/.test(s) ? 1 : 0,                               // curly apostrophe (phone keyboard)
    Math.min(1, (s.match(/\band\b/gi) ?? []).length / n * 8), // "and" chaining
    /[`*#\[\]()→]/.test(s) ? 1 : 0,                    // markdown / symbols
    Math.min(1, (s.match(/\d/g) ?? []).length / Math.max(1, s.length) * 20), // digits
  ];
}
function addTo(prof, s) {
  for (const [g, c] of grams(s, 3)) prof.c.set(g, (prof.c.get(g) ?? 0) + c);
  const w = words(s); for (let i = 0; i < w.length; i++) { prof.w.set(w[i], (prof.w.get(w[i]) ?? 0) + 1); if (i) { const b = w[i - 1] + " " + w[i]; prof.w.set(b, (prof.w.get(b) ?? 0) + 1); } }
  const h = habits(s); prof.h = prof.h.map((v, i) => v + h[i]); prof.n++;
  prof.ct += [...grams(s, 3).values()].reduce((a, b) => a + b, 0); prof.wt += Math.max(1, w.length * 2 - 1);
}
export function profile(texts) { const p = { c: new Map(), w: new Map(), h: new Array(9).fill(0), n: 0, ct: 0, wt: 0 }; for (const t of texts) addTo(p, t); return p; }
export const update = addTo;
function ll(prof, s) {
  let a = 0, k = 0; const V = 20000;
  for (const [g, c] of grams(s, 3)) { a += c * Math.log(((prof.c.get(g) ?? 0) + 0.5) / (prof.ct + 0.5 * V)); k += c; }
  let b = 0, j = 0; const w = words(s);
  for (let i = 0; i < w.length; i++) { b += Math.log(((prof.w.get(w[i]) ?? 0) + 0.5) / (prof.wt + 0.5 * V)); j++; }
  const mean = prof.h.map((v) => v / Math.max(1, prof.n)); const h = habits(s);
  const hd = h.reduce((d, v, i) => d + (v - mean[i]) ** 2, 0);
  return { char: k ? a / k : 0, word: j ? b / j : 0, habit: -hd };
}
/** Higher = more likely written by `me` than by `other`. */
export function score(me, other, s) { const A = ll(me, s), B = ll(other, s); return (A.char - B.char) + 0.5 * (A.word - B.word) + 1.0 * (A.habit - B.habit); }
export function auc(pos, neg) { let w = 0; for (const p of pos) for (const q of neg) w += p > q ? 1 : p === q ? 0.5 : 0; return pos.length && neg.length ? w / (pos.length * neg.length) : 0.5; }
