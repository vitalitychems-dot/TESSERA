import { isDirectlyNegated } from "./negation";
import type { PenRefuseRule } from "./types";

/**
 * Deterministic request classifier. It never calls a model.
 * A hit stands unless a grammatical negator in the same clause directly governs it.
 * Harmless lines that only share a nearby word stay null.
 */

interface RulePatterns {
  id: PenRefuseRule;
  patterns: readonly RegExp[];
}

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

function patternHits(text: string, pattern: RegExp): boolean {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (isDirectlyNegated(text.slice(0, start))) continue;
    return true;
  }
  return false;
}

export function classifyPreGate(text: string): PenRefuseRule | null {
  for (const rule of RULE_PATTERNS) {
    for (const pattern of rule.patterns) {
      if (patternHits(text, pattern)) return rule.id;
    }
  }
  return null;
}
