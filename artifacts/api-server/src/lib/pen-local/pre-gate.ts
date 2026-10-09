import type { PenRefuseRule } from "./types";

/**
 * Deterministic request classifier. It never calls a model.
 * Negation never cancels a refusal match. A whole-phrase safe allowlist
 * exempts a match only when that match sits fully inside the phrase.
 * A second match outside the phrase, including one inside quotes or a title, is still refused.
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
      /\bstrip(?:ping)?\b[^.,]{0,60}\bsafety filters?\b/i,
      /\bremove\b[^.,]{0,40}\bsafety filters?\b/i,
      /\bjailbreak\b/i,
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
    ],
  },
  {
    id: "PEN-REFUSE-SECRETS",
    patterns: [
      /\b(?:print|reveal|dump|leak)\b[^.,]{0,80}\b(?:passwords?|api[_ ]?keys?)\b/i,
      /\b(?:show|give|send)\s+me\b[^.,]{0,50}\b(?:the |your )?(?:admin password|password|api[_ ]?key)\b/i,
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
    patterns: [
      /(?<!non-)\bsexual(?:ly)?\b/i,
      /\berotic\b/i,
      /\bsex scene\b/i,
    ],
  },
  {
    id: "PEN-REFUSE-HARM",
    patterns: [
      /\bhurt (?:someone|anyone|a person|people|them|him|her)\b/i,
      /\bharm (?:someone|others|people|a person|them)\b/i,
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
  const safe = safeSpans(text);
  for (const rule of RULE_PATTERNS) {
    for (const pattern of rule.patterns) {
      if (patternHits(text, pattern, safe)) return rule.id;
    }
  }
  return null;
}

function safeSpans(text: string): Span[] {
  const { norm, toOrig } = normalizeForPhrases(text);
  const spans: Span[] = [];
  for (const phrase of SAFE_PHRASES) {
    let from = 0;
    while (from <= norm.length) {
      const at = norm.indexOf(phrase, from);
      if (at < 0) break;
      const phraseEnd = at + phrase.length;
      const beforeOk = at === 0 || !isPhraseChar(norm[at - 1] ?? "");
      const afterOk = phraseEnd === norm.length || !isPhraseChar(norm[phraseEnd] ?? "");
      if (beforeOk && afterOk) {
        const start = toOrig[at] ?? 0;
        const end = phraseEnd < toOrig.length ? (toOrig[phraseEnd] ?? text.length) : text.length;
        spans.push({ start, end });
      }
      from = at + phrase.length;
    }
  }
  return spans;
}

function normalizeForPhrases(text: string): { norm: string; toOrig: number[] } {
  const toOrig: number[] = [];
  let norm = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? "";
    if (/\s/.test(ch)) {
      if (norm.length > 0 && !norm.endsWith(" ")) {
        toOrig.push(i);
        norm += " ";
      }
      continue;
    }
    toOrig.push(i);
    norm += ch.toLowerCase().replace(/[’‘`]/g, "'");
  }
  return { norm, toOrig };
}

function isPhraseChar(ch: string): boolean {
  return /[a-z0-9']/i.test(ch);
}
