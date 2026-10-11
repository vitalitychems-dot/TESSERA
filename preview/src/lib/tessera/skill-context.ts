import { directSkill, type SkillName } from "./skill-use.ts";

/** The last ask is reused only for a short follow-up. A new sentence is not rewritten. */

export function isFollow(previous: string, next: string) {
  const q = next.trim();
  const prior = previous.trim();
  if (/^(again|same|do that again|repeat that)$/i.test(q)) return true;
  if (/^(and|also)\s+\S/i.test(q)) return true;
  return /^(sort|quote|search|read)$/i.test(q) && new RegExp(`^${q}\\b`, "i").test(prior);
}

export function followAsk(previous: string, next: string) {
  const q = next.trim();
  const prior = previous.trim();
  if (!isFollow(prior, q)) return q;
  if (/^(again|same|do that again|repeat that)$/i.test(q)) return prior;
  if (/^(sort|quote|search|read)$/i.test(q)) return prior;
  const extra = q.replace(/^(?:and|also)\s+/i, "").trim();
  const verb = prior.match(/^(sort|quote|search|read|convert|translate)\b/i)?.[1] ?? "";
  const rest = prior.replace(/^(?:sort|quote|search|read|convert|translate)\b[:\s]*/i, "").trim();
  if (verb.toLowerCase() === "sort") return `sort ${rest}${rest ? ", " : ""}${extra}`;
  return `${verb} ${rest} ${extra}`.trim();
}

export function answerInContext(previous: string, next: string): { skill: SkillName | null; answer: string; ask: string } | null {
  if (!isFollow(previous, next)) return null;
  if (!previous.trim()) return { skill: null, answer: "There is no last skill.", ask: next.trim() };
  if (/^(and|also)\s+\S/i.test(next.trim()) && !/^(sort|quote|search|read|convert|translate)\b/i.test(previous.trim())) {
    return { skill: null, answer: "There is no last skill.", ask: next.trim() };
  }
  const ask = followAsk(previous, next);
  const hit = directSkill(ask);
  if (!hit) return { skill: null, answer: "The last skill did not run on that.", ask };
  return { skill: hit.skill, answer: `${hit.answer}\nLast ask: ${previous.trim()}`, ask };
}
