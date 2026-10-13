/**
 * IDEAS-B1-03 recursive learning loop. Outcomes (test pass/fail per topic) update topic
 * weights (multiplicative weights); the curriculum picks the weakest unmastered topic next.
 * Optionally feeds outcomes into the synapse graph (Hebbian on topic+result co-activation).
 */
import { hebbian } from "./synapse.mjs";
export function createLearner(topics, { eta = 0.5, mastery = 0.85, graph = null } = {}) {
  const s = new Map(topics.map((t) => [t, { pass: 0, n: 0, w: 1 }]));
  const rate = (t) => { const x = s.get(t); return (x.pass + 1) / (x.n + 2); };
  return {
    rate, state: s,
    record(topic, passed) {
      const x = s.get(topic); x.n++; if (passed) x.pass++;
      x.w *= passed ? 1 - eta * 0.5 : 1 + eta; // failures pull attention, passes release it
      if (graph) hebbian(graph, [`topic:${topic}`, passed ? "outcome:pass" : "outcome:fail"]);
    },
    mastered: (t) => rate(t) >= mastery && s.get(t).n >= 3,
    next() {
      const open = [...s.keys()].filter((t) => !this.mastered(t));
      if (!open.length) return null;
      return open.sort((a, b) => s.get(b).w - s.get(a).w || rate(a) - rate(b) || (a < b ? -1 : 1))[0];
    },
  };
}
/** Deterministic simulator: topic difficulty d, practice raises skill. Returns steps to master all. */
export function simulate(pick, { topics, difficulty, maxSteps = 2000, seed = 7 } = {}) {
  let x = seed >>> 0; const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const skill = new Map(topics.map((t) => [t, 0])); const L = createLearner(topics);
  for (let step = 1; step <= maxSteps; step++) {
    const t = pick(L, step); if (t == null) return step - 1;
    const p = Math.min(0.98, skill.get(t) + 1 - difficulty[t]);
    const ok = rnd() < p; L.record(t, ok); skill.set(t, skill.get(t) + (ok ? 0.02 : 0.08));
  }
  return maxSteps;
}

/* ---- B2: outcome learning for the recognizer (error-driven, replayed, spaced) ---- */
import { classify } from "./affect.mjs";
const tok = (s) => String(s).toLowerCase().replace(/<[a-z]+>/g, " ").match(/[a-z][a-z'-]+/g) ?? [];
const lexCache = new Map(); const lex = (s) => { let c = lexCache.get(s); if (!c) { c = classify(s); if (lexCache.size > 50000) lexCache.clear(); lexCache.set(s, c); } return c; };
const feats = (s, dim) => { const t = tok(s); const f = [...t, `lex:${lex(s)[dim]}`]; for (let i = 0; i + 1 < t.length; i++) f.push(`${t[i]}_${t[i + 1]}`); return f; };
/** Averaged multiclass perceptron on top of the lexicon output. Prior = lexicon label. */
export function createRecognizer(dim, labels) {
  // Weights per feature as one row per label (index = position in labels), so scoring does
  // not build a "label|feature" string per label per feature. Same sums, same order.
  const L = labels.length; const li = new Map(labels.map((l, i) => [l, i]));
  const W = new Map(); const U = new Map(); let c = 1;
  const row = (M, f) => { let r = M.get(f); if (!r) M.set(f, (r = new Array(L).fill(0))); return r; };
  const predictFs = (fs, avg) => {
    // Tokens and bigrams never contain ":", so the one "lex:" feature is the lexicon prior.
    const lexF = fs.find((f) => f.startsWith("lex:"));
    const scores = labels.map((l) => [l, 0]);
    const wr = fs.map((f) => W.get(f)); const ur = avg ? fs.map((f) => U.get(f)) : null;
    for (let j = 0; j < L; j++) {
      let s = 0;
      for (let k = 0; k < fs.length; k++) { const wv = wr[k] ? wr[k][j] : 0; s += avg ? wv - (ur[k] ? ur[k][j] : 0) / c : wv; }
      scores[j][1] = s + (`lex:${labels[j]}` === lexF ? 0.5 : 0);
    }
    return scores.sort((a, b) => b[1] - a[1])[0][0];
  };
  const predict = (text, avg = true) => predictFs(feats(text, dim), avg);
  return {
    predict,
    /** outcome: gold label. Returns true if the prediction was right (no update). */
    learn(text, gold, weight = 1) {
      const fs = feats(text, dim); const p = predictFs(fs, false); c++;
      if (p === gold) return true;
      for (const f of fs) for (const [l, d] of [[gold, weight], [p, -weight]]) { const j = li.get(l); if (j === undefined) continue; row(W, f)[j] += d; row(U, f)[j] += c * d; }
      return false;
    },
  };
}
/** Training schedules over outcome feedback. */
export const SCHEDULES = {
  none: () => {},
  single: (R, data, dim) => { for (const x of data) R.learn(x.text, x[dim]); },
  /** error-prioritized replay: after each pass, replay misses (weighted by miss count). */
  replay: (R, data, dim, { passes = 6 } = {}) => {
    const miss = new Map();
    for (let p = 0; p < passes; p++) {
      const order = p === 0 ? data : [...data].sort((a, b) => (miss.get(b) ?? 0) - (miss.get(a) ?? 0));
      for (const x of order) if (!R.learn(x.text, x[dim], 1 + (miss.get(x) ?? 0) * 0.5)) miss.set(x, (miss.get(x) ?? 0) + 1);
    }
  },
  /** spaced repetition (Leitner): misses go to box 0 (seen every round), hits move up and are seen every 2^box rounds. */
  spaced: (R, data, dim, { rounds = 8 } = {}) => {
    const box = new Map(data.map((x) => [x, 0]));
    for (let r = 0; r < rounds; r++) for (const x of data) {
      if (r % 2 ** box.get(x) !== 0) continue;
      box.set(x, R.learn(x.text, x[dim]) ? Math.min(3, box.get(x) + 1) : 0);
    }
  },
};
