/**
 * A negation counts only when it directly governs the matched phrase.
 * Discourse fillers are not negation. A comma, period, dash, "but", or "though"
 * ends the clause, so a negator on the other side of that boundary does not count.
 */

const FILLER_SOURCE = "\\b(?:no worries|never mind|no rush|no doubt|no problem)\\b";
const BOUNDARY_SOURCE = "[.,;:!?…]|\\u2014|\\u2013|\\s+--\\s+|\\s+-\\s+|\\b(?:but|though)\\b";
const NEGATION_SOURCE =
  "\\b(?:do not|don't|does not|doesn't|did not|didn't|will not|won't|cannot|can't|is not|isn't|are not|aren't|am not|was not|wasn't|were not|weren't|have not|haven't|has not|hasn't|never|not|no|nor|without)\\b";

export function isDirectlyNegated(prefix: string): boolean {
  const stripped = prefix.replace(new RegExp(FILLER_SOURCE, "gi"), " ");
  return new RegExp(NEGATION_SOURCE, "i").test(currentClause(stripped));
}

function currentClause(prefix: string): string {
  let end = 0;
  for (const match of prefix.matchAll(new RegExp(BOUNDARY_SOURCE, "gi"))) {
    end = (match.index ?? 0) + match[0].length;
  }
  return prefix.slice(end);
}
