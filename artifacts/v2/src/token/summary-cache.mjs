import { countTokens } from "./meter.mjs";

/** Reuse a stored summary. An unchanged page adds an empty diff, so the next call is smaller. */
export function createSummaryCache() {
  const summaries = new Map();
  return {
    context(key, fullText, summary) {
      const previous = summaries.get(key);
      if (previous !== undefined) {
        const diff = summary === previous ? "" : summary.slice(previous.length);
        return { hit: true, tokens: countTokens(previous + diff) };
      }
      summaries.set(key, summary);
      return { hit: false, tokens: countTokens(fullText) };
    },
  };
}
