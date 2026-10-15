/**
 * Display-side copy of the pen rule.
 * Keep the patterns aligned with artifacts/api-server/src/lib/tessera-voice.ts.
 */

export const PEN_LINE =
  "I’m Tessera, the assistant persona in this app. This chat uses local response logic and retrieved information; I’m software, not a conscious or autonomous person.";

export const PEN_WHERE =
  "I’m Tessera, the assistant persona served by this web app and its API. I don’t operate independently of that software.";

const IDENTITY_RE =
  /\b(who are you|what are you|who is this|who is tessera|what(?:'s| is) your name|your name|where is tessera|where are you|are you conscious|are you sentient|do you have feelings|are you autonomous)\b/i;

const SELF_CLAIM_RE =
  /\b(?:i(?:'m| am)\s+(?:grok|claude|chatgpt|gemini|qwen|llama|mistral|deepseek)\b|i(?:'m| am)\s+(?:a |an )?(?:conscious|sentient|self-aware|living intelligence|autonomous intelligence)\b|i\s+(?:have|possess|experience)\s+(?:my own\s+)?(?:consciousness|subjective experience|inner life|independent feelings|personal thoughts)\b|i\s+act autonomously\b|i\s+operate independently of (?:the app|this software|my application)\b|my consciousness (?:is|remains|continues)\b)/i;

export function isIdentityQuestion(text: string): boolean {
  const q = (text || "").trim();
  if (!q) return false;
  if (IDENTITY_RE.test(q)) return true;
  return /^tessera\??$/i.test(q);
}

export function isSearchDump(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  if (/^\s*untrusted\b/i.test(t)) return true;
  if (/\b(individual tile|abaculus|abaciscus|tessellation)\b/i.test(t) && /\btessera\b/i.test(t)) return true;
  if (/\byour name\b/i.test(t) && /\b(20\d{2}|makoto shinkai|anime|toho)\b/i.test(t)) return true;
  if (/\bthis \(egypt\)\b/i.test(t)) return true;
  if (/wikipedia\.org\/wiki\//i.test(t) && t.length < 1600 && !/\bi am tessera\b/i.test(t)) return true;
  return false;
}

export function hasSelfClaim(text: string): boolean {
  return SELF_CLAIM_RE.test(text || "");
}

export function identityReply(userInput: string): string {
  if (/\bwhere\b/i.test(userInput || "")) return PEN_WHERE;
  return PEN_LINE;
}

export function enforceTesseraVoice(candidate: string, userInput: string): string {
  const text = (candidate || "").trim();
  if (isIdentityQuestion(userInput)) {
    if (!text || hasSelfClaim(text) || isSearchDump(text) || !/\btessera\b/i.test(text)) {
      return identityReply(userInput);
    }
    if (text.startsWith(PEN_WHERE) && text.length > PEN_WHERE.length) return PEN_WHERE;
    if (text.startsWith(PEN_LINE) && text.length > PEN_LINE.length) return PEN_LINE;
    return text;
  }
  if (hasSelfClaim(text) || isSearchDump(text)) return PEN_LINE;
  return text;
}

/** Stream-safe append. Keep aligned with the server copy. */
export function appendTesseraVoice(prev: string, piece: string, userInput: string): string {
  if (isIdentityQuestion(userInput)) return identityReply(userInput);
  const prior = prev || "";
  const incoming = piece || "";
  if ((prior === PEN_LINE || prior === PEN_WHERE) && incoming.trim()) {
    const rest = enforceTesseraVoice(incoming.trim(), userInput);
    if (!rest || rest === PEN_LINE || rest === PEN_WHERE || hasSelfClaim(incoming) || isSearchDump(incoming)) {
      return PEN_LINE;
    }
    return rest;
  }
  return enforceTesseraVoice(prior + incoming, userInput);
}

/** Last-line display filter when the user turn is no longer in scope. */
export function presentAssistantText(text: string): string {
  if (!text) return text;
  if (hasSelfClaim(text) || isSearchDump(text)) return PEN_LINE;
  return text;
}
