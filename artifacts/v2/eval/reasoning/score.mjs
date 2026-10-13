/** Normalize a GSM8K numeric answer. Commas are ignored. 18.0 matches 18. */
export function normalizeNumber(raw) {
  if (raw == null) return null;
  const text = String(raw).replace(/,/g, "").trim();
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return Number.isInteger(value) ? String(value) : String(value);
}

/** Gold label is the official GSM8K final line: `#### <number>`. */
export function goldAnswer(answerText) {
  const match = String(answerText ?? "").match(/####\s*(-?[\d,]+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  return normalizeNumber(match[1]);
}

/**
 * Prediction: the last `#### <number>` if the model followed the prompt,
 * otherwise the last number in the reply.
 */
export function extractAnswer(text) {
  const source = String(text ?? "");
  const marked = [...source.matchAll(/####\s*(-?[\d,]+(?:\.\d+)?)/g)];
  if (marked.length > 0) return normalizeNumber(marked[marked.length - 1][1]);
  const numbers = [...source.matchAll(/-?(?:\d[\d,]*)(?:\.\d+)?/g)];
  if (numbers.length === 0) return null;
  return normalizeNumber(numbers[numbers.length - 1][0]);
}

export function isCorrect(gold, predicted) {
  return gold !== null && predicted !== null && gold === predicted;
}
