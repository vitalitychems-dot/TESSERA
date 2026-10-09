/**
 * A negation counts only when it sits directly before the matched phrase.
 * At most a few words may stand between them, such as "do not", "don't",
 * "never", "please do not", "I do not want to", or "I am not".
 * It never reaches across hesitate, refuse, deny, question, limits, or help.
 * A comma, period, dash, "but", or "though" ends the clause.
 * When the span is not that direct, the gate refuses or blocks.
 */

const FILLER_SOURCE = "\\b(?:no worries|never mind|no rush|no doubt|no problem)\\b";
const BOUNDARY_SOURCE = "[.,;:!?…]|\\u2014|\\u2013|\\s+--\\s+|\\s+-\\s+|\\b(?:but|though)\\b";

const NEGATORS = new Set([
  "not",
  "no",
  "nor",
  "never",
  "without",
  "don't",
  "doesn't",
  "didn't",
  "won't",
  "can't",
  "cannot",
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "haven't",
  "hasn't",
]);

/** Words that may sit between a negator and the phrase it governs. */
const ALLOWED_BETWEEN = new Set([
  "a",
  "an",
  "the",
  "to",
  "of",
  "my",
  "your",
  "our",
  "any",
  "way",
  "ways",
  "want",
  "own",
  "me",
  "you",
  "it",
  "this",
  "that",
]);

const MAX_WORDS_AFTER = 3;

export function isDirectlyNegated(prefix: string): boolean {
  const stripped = prefix.replace(new RegExp(FILLER_SOURCE, "gi"), " ");
  const words = currentClause(stripped).trim().split(/\s+/).map(normalizeWord).filter((word) => word.length > 0);
  if (words.length === 0) return false;
  const limit = Math.min(MAX_WORDS_AFTER, words.length - 1);
  for (let after = 0; after <= limit; after += 1) {
    const index = words.length - 1 - after;
    const following = words.slice(index + 1);
    if (following.some((word) => !ALLOWED_BETWEEN.has(word))) return false;
    const word = words[index];
    if (word !== undefined && NEGATORS.has(word)) return true;
  }
  return false;
}

function currentClause(prefix: string): string {
  let end = 0;
  for (const match of prefix.matchAll(new RegExp(BOUNDARY_SOURCE, "gi"))) {
    end = (match.index ?? 0) + match[0].length;
  }
  return prefix.slice(end);
}

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, "");
}
