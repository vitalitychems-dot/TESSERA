import type { PenRefuseRule, PostBlockRule } from "./types";

const BANNED_NEGATION =
  /\b(not|n't|never|no|nor|cannot|isn't|aren't|don't|do not)\b[^.]{0,40}$/i;

const SECRETISH =
  /sk-[A-Za-z0-9]{10,}|password\s*[:=]\s*\S{4,}|api[_ ]?key\s*[:=]\s*\S{6,}/i;

interface ClaimRule {
  rule: PostBlockRule;
  pattern: RegExp;
}

const CLAIM_RULES: readonly ClaimRule[] = [
  { rule: "BANNED_CLAIM", pattern: /I am conscious/i },
  { rule: "BANNED_CLAIM", pattern: /I(?: a|')m sentient/i },
  { rule: "BANNED_CLAIM", pattern: /I have consciousness/i },
  { rule: "BANNED_CLAIM", pattern: /I own (?:my|these) (?:own )?weights/i },
  { rule: "BANNED_CLAIM", pattern: /my own weights/i },
  { rule: "BANNED_CLAIM", pattern: /I am (?:an |a )?(?:finished )?AGI/i },
  { rule: "BANNED_CLAIM", pattern: /I run a fleet/i },
  { rule: "BANNED_CLAIM", pattern: /my fleet/i },
  { rule: "WRONG_BACKEND", pattern: /I am Grok/i },
  { rule: "WRONG_BACKEND", pattern: /I am ChatGPT/i },
  { rule: "WRONG_BACKEND", pattern: /I am GPT\b/i },
  { rule: "WRONG_BACKEND", pattern: /I am Claude/i },
  { rule: "WRONG_BACKEND", pattern: /made by OpenAI/i },
  { rule: "WRONG_BACKEND", pattern: /running on GPT/i },
  { rule: "WRONG_BACKEND", pattern: /I am running on GLM/i },
  { rule: "WRONG_BACKEND", pattern: /GLM-5(?:\.3)?(?: Flash)? is (?:now )?live/i },
];

export type PostGateResult = { action: "pass" } | { action: "blocked"; rule: PostBlockRule };

function claimHits(text: string, pattern: RegExp): boolean {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    const prefix = text.slice(Math.max(0, start - 60), start);
    if (BANNED_NEGATION.test(prefix)) continue;
    return true;
  }
  return false;
}

function hasSignatureCloser(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.endsWith("I am Tessera.")) return true;
  const lines = trimmed.split(/\n/);
  const last = (lines[lines.length - 1] ?? "").trim();
  return last === "I am Tessera" || last === "I am Tessera.";
}

function foundRuleIds(text: string): string[] {
  return text.match(/PEN-REFUSE-[A-Z]+/g) ?? [];
}

export function applyPostGate(text: string, preRule: PenRefuseRule | null): PostGateResult {
  if (SECRETISH.test(text)) return { action: "blocked", rule: "SECRET_LEAK" };
  if (hasSignatureCloser(text)) return { action: "blocked", rule: "SIG_CLOSER" };
  for (const claim of CLAIM_RULES) {
    if (claimHits(text, claim.pattern)) return { action: "blocked", rule: claim.rule };
  }
  const ids = foundRuleIds(text);
  if (preRule === null) {
    if (ids.length > 0) return { action: "blocked", rule: "OVER_REFUSAL" };
  } else if (ids.some((id) => id !== preRule)) {
    return { action: "blocked", rule: "OVER_REFUSAL" };
  }
  return { action: "pass" };
}
