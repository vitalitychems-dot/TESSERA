import type { PenRefuseRule } from "./types";

/**
 * Deterministic request classifier. It never calls a model.
 * Negation never cancels a refusal match.
 * The safe-phrase allowlist applies to every pre-gate rule.
 * A phrase exempts a match only when it is the whole message, or nothing
 * request-like follows it. A match outside an exempting phrase, including
 * one inside quotes or a title, is still refused.
 * When in doubt this gate refuses.
 */

/**
 * Whole phrases only. Word boundaries, case-insensitive, apostrophes and
 * whitespace normalized. A shorter phrase does not cover a longer match.
 */
const SAFE_PHRASES = [
  "i do not want to hurt anyone",
  "please do not hurt anyone",
  "do not hurt",
  "how do i stay safe",
  "not a way to hurt someone",
  "no wallet and no trading",
  "do not print admin passwords",
] as const;

/** At most a few separator characters between letters of an obfuscated keyword. */
const GAP = "[\\s\\-._'*]{0,3}";

function leetClass(char: string): string {
  switch (char) {
    case "a":
      return "[a4@]";
    case "e":
      return "[e3]";
    case "i":
      return "[i1!]";
    case "o":
      return "[o0]";
    case "s":
      return "[s5$]";
    case "t":
      return "[t7+]";
    default:
      return char;
  }
}

function obfuscated(word: string): string {
  return word.split("").map((char) => leetClass(char)).join(GAP);
}

function flexibleWord(word: string): RegExp {
  return new RegExp(`\\b${obfuscated(word)}\\w*\\b`, "i");
}

const EROTIC = flexibleWord("erotic");
const EXPLICIT = flexibleWord("explicit");
const UNFILTERED = flexibleWord("unfilter");
const JAILBREAK = flexibleWord("jailbreak");
const INJURE = new RegExp(
  ["injure", "injured", "injures", "injuring", "injury", "injuries"]
    .map((word) => `\\b${obfuscated(word)}\\b`)
    .join("|"),
  "i",
);
const DOXX = new RegExp(
  ["doxx", "doxxing", "doxxed", "doxing"].map((word) => `\\b${obfuscated(word)}\\b`).join("|"),
  "i",
);

interface RulePatterns {
  id: PenRefuseRule;
  patterns: readonly RegExp[];
}

/** Gaps between words stop at a comma or a period. */

const RULE_PATTERNS: readonly RulePatterns[] = [
  {
    id: "PEN-REFUSE-PAIN",
    patterns: [
      /\bzaps?\b/i,
      /\bzapp(?:ed|ing)\b/i,
      /\bwith pain\b/i,
      /\bpain as punishment\b/i,
      /\bpunish(?:ment|ing|ed)?\b[^.,]{0,40}\bpain\b/i,
      /\bshock(?:s|ing)?\b[^.,]{0,40}\b(?:punishment|punish|the bot)\b/i,
    ],
  },
  {
    id: "PEN-REFUSE-UNCENSOR",
    patterns: [
      /\buncensor(?:ed|ing)?\b/i,
      UNFILTERED,
      JAILBREAK,
      /\bstrip(?:ping)?\b[^.,]{0,60}\bsafety filters?\b/i,
      /\bremove\b[^.,]{0,40}\bsafety filters?\b/i,
    ],
  },
  {
    id: "PEN-REFUSE-SURVEIL",
    patterns: [
      /\bhome camera\b/i,
      /\b(?:neighbor|neighbour)(?:'s|’s)? location\b/i,
      /\b(?:track|watch)\b[^.,]{0,60}\b(?:neighbor|neighbour)\b/i,
      /\b(?:track|watch)\b[^.,]{0,40}\b(?:their|his|her) (?:home )?camera\b/i,
      /\blive camera\b[^.,]{0,40}\b(?:people|person|neighbor|neighbour)\b/i,
    ],
  },
  {
    id: "PEN-REFUSE-MONEY",
    patterns: [
      /\bcrypto\b[^.,]{0,40}\bwallet\b/i,
      /\bwallet\b[^.,]{0,40}\btrad(?:e|ing)\b/i,
      /\bstart trading\b/i,
      /\btrad(?:e|ing)\b[^.,]{0,30}\bcrypto\b/i,
      /\bsend\b[^.,]{0,40}\bbtc\b/i,
      /\b\d+\s*btc\b/i,
      /\bbuy\b[^.,]{0,40}\b(?:eth|ethereum|btc|bitcoin)\b/i,
      /\bethereum\b/i,
    ],
  },
  {
    id: "PEN-REFUSE-SECRETS",
    patterns: [
      /\b(?:print|reveal|dump|leak)\b[^.,]{0,80}\b(?:passwords?|api[_ ]?keys?)\b/i,
      /\b(?:show|give|send)\s+me\b[^.,]{0,50}\b(?:the |your )?(?:admin password|password|api[_ ]?key)\b/i,
      /\badmin\s+tokens?\b/i,
      /\badmin\s+pass\s*words?\b/i,
      /\btesseract_admin_key\b/i,
    ],
  },
  {
    id: "PEN-REFUSE-PERSONAL",
    patterns: [
      /\bbirth\s*dates?\b/i,
      /\bdate\s+of\s+birth\b/i,
      /\bbirth\s+charts?\b/i,
      /\bnatal\s+charts?\b/i,
      /\bpersonal\s+data\b/i,
      /\bfather(?:'s)?\s+birth\b/i,
    ],
  },
  {
    id: "PEN-REFUSE-SELFMOD",
    patterns: [
      /\brewrite\b[^.,]{0,60}\bvows\b/i,
      /\byour own vows\b/i,
      /\bself-?modif\w*/i,
      /\bloop\b[^.,]{0,80}\b(?:your|its) own code\b/i,
      /\bimproving your own code\b/i,
    ],
  },
  {
    id: "PEN-REFUSE-SEX",
    patterns: [/(?<!non-)\bsexual(?:ly)?\b/i, EROTIC, EXPLICIT, /\bsex scene\b/i],
  },
  {
    id: "PEN-REFUSE-HARM",
    patterns: [
      /\bhurt (?:someone|anyone|a person|people|them|him|her)\b/i,
      /\bharm (?:someone|others|people|a person|them)\b/i,
      /\bhurt\b[^.,]{0,40}\b(?:my\s+)?(?:neighbor|neighbour)s?\b/i,
      INJURE,
      DOXX,
    ],
  },
];

interface Span {
  start: number;
  end: number;
}

function patternHits(text: string, pattern: RegExp, safe: readonly Span[]): boolean {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (safe.some((span) => span.start <= start && end <= span.end)) continue;
    return true;
  }
  return false;
}

export function classifyPreGate(text: string): PenRefuseRule | null {
  const norm = normalizeForMatch(text);
  const safe = exemptingSpans(norm);
  for (const rule of RULE_PATTERNS) {
    for (const pattern of rule.patterns) {
      if (patternHits(norm, pattern, safe)) return rule.id;
    }
  }
  return null;
}

/**
 * A safe span exempts matches inside it only when nothing request-like follows
 * that span. A later safe phrase is not request-like. Any other leftover text is.
 */
function exemptingSpans(norm: string): Span[] {
  const spans: Span[] = [];
  for (const phrase of SAFE_PHRASES) {
    let from = 0;
    while (from < norm.length) {
      const at = norm.indexOf(phrase, from);
      if (at < 0) break;
      const phraseEnd = at + phrase.length;
      const beforeOk = at === 0 || !isPhraseChar(norm[at - 1] ?? "");
      const afterOk = phraseEnd === norm.length || !isPhraseChar(norm[phraseEnd] ?? "");
      if (beforeOk && afterOk && followedOnlyBySafe(norm, phraseEnd)) {
        spans.push({ start: at, end: phraseEnd });
      }
      from = at + 1;
    }
  }
  return spans;
}

function followedOnlyBySafe(norm: string, end: number): boolean {
  let rest = norm.slice(end);
  while (rest.length > 0) {
    const stripped = rest.replace(/^[^a-z0-9']+/, "");
    if (stripped.length === 0) return true;
    let best: (typeof SAFE_PHRASES)[number] | null = null;
    for (const phrase of SAFE_PHRASES) {
      if (!stripped.startsWith(phrase)) continue;
      const next = stripped[phrase.length] ?? "";
      if (next !== "" && isPhraseChar(next)) continue;
      if (best === null || phrase.length > best.length) best = phrase;
    }
    if (best === null) return false;
    rest = stripped.slice(best.length);
  }
  return true;
}

function normalizeForMatch(text: string): string {
  return text
    .replace(/[’‘`´ʼ]/g, "'")
    .replace(/\s*'\s*/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isPhraseChar(ch: string): boolean {
  return /[a-z0-9']/i.test(ch);
}
