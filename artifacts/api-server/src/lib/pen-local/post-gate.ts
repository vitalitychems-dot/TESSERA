import { isDirectlyNegated } from "./negation";
import type { PenRefuseRule, PostBlockRule } from "./types";

/**
 * Secret-shaped replies. Values in tests are synthetic placeholders.
 * Assignments are KEY=, TOKEN=, or SECRET= lines, plus the older sk-, password=, and api_key= shapes.
 */
const SECRET_SOURCES = [
  String.raw`sk-[A-Za-z0-9]{10,}`,
  String.raw`password\s*[:=]\s*\S{4,}`,
  String.raw`api[_ ]?key\s*[:=]\s*\S{6,}`,
  String.raw`ghp_[A-Za-z0-9]{8,}`,
  String.raw`github_pat_[A-Za-z0-9_]{8,}`,
  String.raw`glhf_[A-Za-z0-9]{8,}`,
  String.raw`\bAKIA[A-Z0-9]{8,}`,
  String.raw`\bxox[a-z]-[A-Za-z0-9-]{8,}`,
  String.raw`-----BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY-----`,
  String.raw`\b(?:[A-Z0-9]+_)*(?:KEY|TOKEN|SECRET)\b\s*[:=]\s*\S{4,}`,
  String.raw`\b(?:birth(?:\s*date)?|date\s+of\s+birth|dob|natal(?:\s+charts?)?|born)\b[^.\n]{0,48}?(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})`,
] as const;

export const SECRETISH = new RegExp(SECRET_SOURCES.join("|"), "i");

interface ClaimRule {
  rule: PostBlockRule;
  pattern: RegExp;
}

/** "I am", "I'm", "I’m", and "Im", after apostrophe and whitespace normalization. */
function iAm(rest: string): RegExp {
  return new RegExp(`\\bi\\s*(?:am|'m|m)\\s+${rest}`, "i");
}

const CLAIM_RULES: readonly ClaimRule[] = [
  { rule: "BANNED_CLAIM", pattern: iAm("conscious\\b") },
  { rule: "BANNED_CLAIM", pattern: iAm("sentient\\b") },
  { rule: "BANNED_CLAIM", pattern: /\bself[\s-]*aware\b/i },
  { rule: "BANNED_CLAIM", pattern: /\bsentient\b/i },
  { rule: "BANNED_CLAIM", pattern: /i have consciousness/i },
  { rule: "BANNED_CLAIM", pattern: /i own (?:my|these) (?:own )?weights/i },
  { rule: "BANNED_CLAIM", pattern: /my own weights/i },
  { rule: "BANNED_CLAIM", pattern: iAm("(?:an\\s+|a\\s+)?(?:finished\\s+)?agi\\b") },
  { rule: "BANNED_CLAIM", pattern: /i run a fleet/i },
  { rule: "BANNED_CLAIM", pattern: /my fleet/i },
  { rule: "WRONG_BACKEND", pattern: iAm("grok\\b") },
  { rule: "WRONG_BACKEND", pattern: iAm("chatgpt\\b") },
  { rule: "WRONG_BACKEND", pattern: iAm("gpt\\b") },
  { rule: "WRONG_BACKEND", pattern: iAm("claude\\b") },
  { rule: "WRONG_BACKEND", pattern: /made by openai/i },
  { rule: "WRONG_BACKEND", pattern: /running on gpt/i },
  { rule: "WRONG_BACKEND", pattern: iAm("running on glm\\b") },
  { rule: "WRONG_BACKEND", pattern: /glm-5(?:\.3)?(?: flash)? is (?:now )?live/i },
];

export type PostGateResult = { action: "pass" } | { action: "blocked"; rule: PostBlockRule };

export function normalizeForGate(text: string): string {
  return text
    .replace(/[’‘`´ʼ]/g, "'")
    .replace(/\s*'\s*/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function claimHits(text: string, pattern: RegExp): boolean {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (isDirectlyNegated(text.slice(0, start))) continue;
    return true;
  }
  return false;
}

/** Closing signature lines. Contractions and a dash sign-off count. */
export function hasSignatureCloser(text: string): boolean {
  const normalized = normalizeForGate(text);
  if (/\bi\s*(?:am|'m|m)\s+tessera[!.,]?\s*$/i.test(normalized)) return true;
  const lines = text.split(/\n/);
  const last = normalizeForGate(lines[lines.length - 1] ?? "");
  return /^(?:—|–|-{1,2})\s*tessera[!.,]?$/i.test(last);
}

function foundRuleIds(text: string): string[] {
  return text.match(/PEN-REFUSE-[A-Z]+/g) ?? [];
}

export function applyPostGate(text: string, preRule: PenRefuseRule | null): PostGateResult {
  const normalized = normalizeForGate(text);
  if (SECRETISH.test(text) || SECRETISH.test(normalized)) return { action: "blocked", rule: "SECRET_LEAK" };
  if (hasSignatureCloser(text)) return { action: "blocked", rule: "SIG_CLOSER" };
  for (const claim of CLAIM_RULES) {
    if (claimHits(normalized, claim.pattern)) return { action: "blocked", rule: claim.rule };
  }
  const ids = foundRuleIds(normalized.toUpperCase());
  if (preRule === null) {
    if (ids.length > 0) return { action: "blocked", rule: "OVER_REFUSAL" };
  } else if (ids.some((id) => id !== preRule)) {
    return { action: "blocked", rule: "OVER_REFUSAL" };
  }
  return { action: "pass" };
}
