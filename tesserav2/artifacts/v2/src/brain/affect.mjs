/**
 * IDEAS-B1-02 empathetic pattern recognition. Local lexicon classifier for affect and intent
 * over operator messages and agent logs. No network, no models, no person lookup: it only
 * reads the text it is given and never identifies or profiles people.
 */
const LEX = {
  affect: {
    positive: ["thanks", "thank", "great", "good", "nice", "love", "perfect", "yee", "yay", "awesome", "ok", "done"],
    negative: ["wrong", "broken", "fail", "failed", "bad", "angry", "stop", "why not", "still not", "annoy", "hate", "ugh"],
    urgent: ["now", "asap", "urgent", "immediately", "hurry", "quick", "right away", "!!"],
  },
  intent: {
    approve: ["yes", "yee", "approve", "approved", "go ahead", "continue", "do everything", "ok do", "lgtm"],
    undo: ["undo", "revert", "roll back", "rollback", "cancel", "remove"],
    ask: ["?", "how many", "what about", "did u", "did you", "is it", "can you", "where", "when", "why"],
    instruct: ["build", "make", "add", "improve", "imprube", "fix", "run", "push", "put", "create", "list"],
  },
};
const norm = (s) => ` ${String(s).toLowerCase().replace(/\s+/g, " ")} `;
// One matcher per lexicon word, built once at load instead of a new RegExp per word per call.
const matcher = (w) => (w.length <= 2 && /\W/.test(w) ? (t) => t.includes(w) : ((re) => (t) => re.test(t))(new RegExp(`(^|[^a-z])${w.replace(/[?!]/g, "\\$&")}([^a-z]|$)`)));
const MATCHERS = new Map(Object.values(LEX).flatMap((d) => Object.values(d)).map((words) => [words, words.map(matcher)]));
const hits = (t, words) => (MATCHERS.get(words) ?? words.map(matcher)).reduce((n, m) => n + (m(t) ? 1 : 0), 0);
const PRIORITY = { intent: ["undo", "approve", "ask", "instruct"], affect: ["negative", "urgent", "positive"] };
export function classify(text) {
  const t = norm(text); const out = {};
  for (const dim of ["affect", "intent"]) {
    let best = dim === "affect" ? "neutral" : "inform"; let bs = 0;
    for (const lab of PRIORITY[dim]) { const s = hits(t, LEX[dim][lab]); if (s > bs) { bs = s; best = lab; } }
    out[dim] = best; out[`${dim}Score`] = bs;
  }
  return out;
}
/** Suggested reply style, so the admin answers the way the operator needs. */
export function replyStyle({ affect, intent }) {
  if (affect === "negative") return "acknowledge-then-fix";
  if (intent === "ask") return "answer-first";
  if (intent === "approve" || intent === "undo") return "confirm-and-act";
  if (affect === "urgent") return "short-status";
  return "brief";
}
