/** Public questions. "Who are you" stays in the room and does not search. */

const SELF = /\b(who are you|what are you|your name)\b/i;
const FACT = /\b(who|what|where|when)\b/i;

export function asksPublicFact(text: string) {
  const q = text.trim();
  if (!q || SELF.test(q)) return false;
  const question = q.includes("?") || /^(who|what|where|when)\b/i.test(q);
  if (!question) return false;
  return FACT.test(q);
}

export function answerWithSource(answer: string, source: string) {
  const body = answer.replace(/\s+$/g, "");
  const url = source.trim();
  if (!url) return body;
  if (body.includes(url)) return body;
  return `${body}\n\nSource: ${url}`;
}

export function sourceFromSearchText(text: string) {
  const match = text.match(/https?:\/\/\S+/);
  return match ? match[0].replace(/[),.;]+$/g, "") : "";
}

/** Outside pens are not called. A match means the desk pen stays down. */
export function refusedOutsidePen(url: string) {
  return /openai\.com|api\.openai|x\.ai|\bgrok\b|generativelanguage\.googleapis|anthropic\.com/i.test(url);
}
