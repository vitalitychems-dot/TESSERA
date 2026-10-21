/** Agentic reflection. Plain text, then a lesson, then a check. Only a survivor is kept. */

const DROP = /\b(unbreakable|quantum-secure|vitality|surveil|openai|anthropic|chatgpt|claude|gemini)\b|\bi am grok\b/i;

export function reflect(claim: string) {
  const plain = claim.trim().replace(/\s+/g, " ");
  if (!plain) return { kept: false as const, reason: "empty" };
  const lesson = plain.slice(0, 240);
  if (DROP.test(lesson)) return { kept: false as const, reason: "does not survive" };
  return { kept: true as const, lesson };
}

export function grow(claims: string[]) {
  return claims.map(reflect).filter((row) => row.kept);
}
