import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecognizer, SCHEDULES } from "../src/brain/learn.mjs";
import { classify } from "../src/brain/affect.mjs";
import { MESHLOG } from "../src/brain/meshlog-labels.mjs";
import { HELDOUT } from "../src/brain/heldout.mjs";

/** R4-24 reference: the pre-change recognizer with "label|feature" string keys. */
function referenceRecognizer(dim, labels) {
  const tok = (s) => String(s).toLowerCase().replace(/<[a-z]+>/g, " ").match(/[a-z][a-z'-]+/g) ?? [];
  const feats = (s) => { const t = tok(s); const f = [...t, `lex:${classify(s)[dim]}`]; for (let i = 0; i + 1 < t.length; i++) f.push(`${t[i]}_${t[i + 1]}`); return f; };
  const W = new Map(); const U = new Map(); let c = 1;
  const w = (l, f) => W.get(`${l}|${f}`) ?? 0;
  const score = (fs, l, avg) => fs.reduce((s, f) => s + (avg ? w(l, f) - (U.get(`${l}|${f}`) ?? 0) / c : w(l, f)), 0) + (fs.includes(`lex:${l}`) ? 0.5 : 0);
  const predict = (text, avg = true) => { const fs = feats(text); return labels.map((l) => [l, score(fs, l, avg)]).sort((a, b) => b[1] - a[1])[0][0]; };
  return {
    predict,
    learn(text, gold, weight = 1) {
      const fs = feats(text); const p = predict(text, false); c++;
      if (p === gold) return true;
      for (const f of fs) for (const [l, d] of [[gold, weight], [p, -weight]]) { const k = `${l}|${f}`; W.set(k, (W.get(k) ?? 0) + d); U.set(k, (U.get(k) ?? 0) + c * d); }
      return false;
    },
  };
}

test("R4-24: row-weighted recognizer predicts exactly like the string-keyed one on all real lines", () => {
  const all = [...MESHLOG, ...HELDOUT];
  for (const dim of ["intent", "affect"]) {
    const labels = [...new Set(all.map((x) => x[dim]))];
    for (const s of ["single", "replay", "spaced"]) {
      const a = createRecognizer(dim, labels); const b = referenceRecognizer(dim, labels);
      SCHEDULES[s](a, all, dim); SCHEDULES[s](b, all, dim);
      for (const x of all) { assert.equal(a.predict(x.text), b.predict(x.text)); assert.equal(a.predict(x.text, false), b.predict(x.text, false)); }
    }
  }
});
