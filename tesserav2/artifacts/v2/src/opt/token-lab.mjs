/**
 * OPT token lab. Local text passes that shrink what a bot sends to a model.
 * No model calls. Each pass is measured in docs/v2/OPTIMIZE-26 by bench.mjs.
 */
import { createHash } from "node:crypto";
import { countTokens } from "../token/meter.mjs";
import { compressPrompt, LEAD_MODEL, SMALL_MODEL } from "../token/router.mjs";

/** OPT-01: drop exact repeated non-blank lines, keep first copy and order. */
export function dedupeLines(text) {
  const seen = new Set();
  return String(text).split("\n").filter((line) => {
    const key = line.trim();
    if (key === "") return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join("\n");
}

const FILLER = [
  /\b(please|kindly)\s+/gi,
  /\bI would like you to\s+/gi,
  /\bcould you\s+/gi,
  /\bin order to\b/gi,
  /\bit is important to note that\s+/gi,
  /\bas an AI( language model)?,?\s*/gi,
  /\bbasically\s+/gi,
  /\bjust\s+/gi,
];
/** OPT-02: cut polite filler that carries no instruction. */
export function cutFiller(text) {
  let out = String(text);
  for (const pattern of FILLER) out = out.replace(pattern, (m) => (/in order to/i.test(m) ? "to" : ""));
  return out.replace(/[ \t]{2,}/g, " ");
}

/** OPT-03: minify any JSON payload; non-JSON passes through. */
export function compactJson(text) {
  try { return JSON.stringify(JSON.parse(text)); } catch { return String(text); }
}

/** OPT-04: replace long repeated tokens (paths, ids, SHAs) with short refs plus one legend line. */
export function refLegend(text, { minLength = 16, minCount = 2 } = {}) {
  const counts = new Map();
  for (const word of String(text).match(/[\w./:#@-]{16,}/g) ?? []) counts.set(word, (counts.get(word) ?? 0) + 1);
  const picks = [...counts].filter(([w, n]) => w.length >= minLength && n >= minCount)
    .sort((a, b) => b[0].length * b[1] - a[0].length * a[1]);
  let out = String(text);
  const legend = [];
  picks.forEach(([word], i) => {
    const ref = `§${i}`;
    if (!out.includes(word)) return;
    out = out.split(word).join(ref);
    legend.push(`${ref}=${word}`);
  });
  return legend.length ? `${legend.join(" ")}\n${out}` : out;
}
export function expandLegend(text) {
  const [head, ...rest] = String(text).split("\n");
  if (!/^§\d+=/.test(head)) return text;
  let body = rest.join("\n");
  const pairs = head.split(" ").map((p) => p.split(/=(.*)/s));
  for (const [ref, word] of pairs.sort((a, b) => b[0].length - a[0].length)) body = body.split(ref).join(word);
  return body;
}

/** OPT-05/06: response cache. normalize=false is exact match; true folds case and whitespace. */
export function createPromptCache({ normalize = true } = {}) {
  const store = new Map();
  let hits = 0, misses = 0;
  const keyOf = (p) => createHash("sha256").update(normalize ? compressPrompt(p).toLowerCase() : String(p)).digest("hex");
  return {
    async get(prompt, compute) {
      const key = keyOf(prompt);
      if (store.has(key)) { hits++; return store.get(key); }
      misses++;
      const value = await compute(prompt);
      store.set(key, value);
      return value;
    },
    stats: () => ({ hits, misses }),
  };
}

/** OPT-07: hold a context to a token budget, keeping head and tail. */
export function fitBudget(text, budget) {
  const s = String(text);
  if (countTokens(s) <= budget) return s;
  const marker = "\n…\n";
  const chars = Math.max(0, budget * 4 - marker.length);
  const head = Math.ceil(chars * 0.6);
  return s.slice(0, head) + marker + s.slice(s.length - (chars - head));
}

/** OPT-08: send short or classify tasks to the small model. Cost units: small 1, lead 10 per 1k tokens. */
export function routeBySize(task, { smallMax = 200 } = {}) {
  if (task.kind === "classify") return SMALL_MODEL;
  return countTokens(task.prompt) <= smallMax && task.kind !== "plan" ? SMALL_MODEL : LEAD_MODEL;
}
export function computeUnits(model, tokens) {
  return (model === SMALL_MODEL ? 1 : 10) * tokens / 1000;
}

/** OPT-09: on a repeat call send only the summary diff, not previous+diff. */
export function createDiffCache() {
  const summaries = new Map();
  return {
    context(key, fullText, summary) {
      const previous = summaries.get(key);
      summaries.set(key, summary);
      if (previous === undefined) return { hit: false, tokens: countTokens(fullText) };
      if (summary === previous) return { hit: true, tokens: 0 };
      const diff = summary.startsWith(previous) ? summary.slice(previous.length) : summary;
      return { hit: true, tokens: countTokens(diff) };
    },
  };
}

/** OPT-10: clip a long tool result to head lines plus a count of what was cut. */
export function clipToolResult(text, { maxLines = 40 } = {}) {
  const lines = String(text).split("\n");
  if (lines.length <= maxLines) return String(text);
  return [...lines.slice(0, maxLines), `[${lines.length - maxLines} more lines clipped]`].join("\n");
}

/** OPT-11: chain of passes used by the token lab. Lossless ones first. */
export function packContext(text, { budget = Infinity } = {}) {
  const packed = refLegend(compressPrompt(cutFiller(dedupeLines(compactJson(text)))).replace(/ \n/g, "\n"));
  return Number.isFinite(budget) ? fitBudget(packed, budget) : packed;
}
