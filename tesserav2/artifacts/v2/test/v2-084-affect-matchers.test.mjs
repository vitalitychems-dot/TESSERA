import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/brain/affect.mjs";
import { MESHLOG } from "../src/brain/meshlog-labels.mjs";
import { HELDOUT } from "../src/brain/heldout.mjs";

/** R4-26 reference: the pre-change hit counter that built a RegExp per word per call. */
const norm = (s) => ` ${String(s).toLowerCase().replace(/\s+/g, " ")} `;
const hitsRef = (t, words) => words.reduce((n, w) => n + (w.length <= 2 && /\W/.test(w) ? (t.includes(w) ? 1 : 0) : new RegExp(`(^|[^a-z])${w.replace(/[?!]/g, "\\$&")}([^a-z]|$)`).test(t) ? 1 : 0), 0);
const LEX = {
  affect: { positive: ["thanks", "thank", "great", "good", "nice", "love", "perfect", "yee", "yay", "awesome", "ok", "done"], negative: ["wrong", "broken", "fail", "failed", "bad", "angry", "stop", "why not", "still not", "annoy", "hate", "ugh"], urgent: ["now", "asap", "urgent", "immediately", "hurry", "quick", "right away", "!!"] },
  intent: { approve: ["yes", "yee", "approve", "approved", "go ahead", "continue", "do everything", "ok do", "lgtm"], undo: ["undo", "revert", "roll back", "rollback", "cancel", "remove"], ask: ["?", "how many", "what about", "did u", "did you", "is it", "can you", "where", "when", "why"], instruct: ["build", "make", "add", "improve", "imprube", "fix", "run", "push", "put", "create", "list"] },
};
const PRIORITY = { intent: ["undo", "approve", "ask", "instruct"], affect: ["negative", "urgent", "positive"] };
function classifyRef(text) {
  const t = norm(text); const out = {};
  for (const dim of ["affect", "intent"]) { let best = dim === "affect" ? "neutral" : "inform"; let bs = 0; for (const lab of PRIORITY[dim]) { const s = hitsRef(t, LEX[dim][lab]); if (s > bs) { bs = s; best = lab; } } out[dim] = best; out[`${dim}Score`] = bs; }
  return out;
}

test("R4-26: precompiled lexicon matchers classify every real line exactly as before", () => {
  const lines = [...MESHLOG, ...HELDOUT].map((x) => x.text).concat(["", "??", "ok do it now!!", "roll back, why not?"]);
  for (const t of lines) assert.deepEqual(classify(t), classifyRef(t), t);
});
