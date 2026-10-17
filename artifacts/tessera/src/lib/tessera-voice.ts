/** Display-side copy of the server identity/response filter. */

export const PEN_LINE =
  "Tessera is the software application; its configured model is a tool, not Tessera's identity.";

export const PEN_WHERE =
  "Tessera is the application in this interface; the chat view does not establish where it is hosted.";

export const IDENTITY_UNAVAILABLE_REPLY =
  "I’m Tessera, the AI software application in this project. The current operator says they created Tessera; that is an operator-provided note, not independently verified. This deployment has no configured language model, so it cannot generate a free-form answer right now.";

export const CHAT_MODEL_DISABLED_REPLY =
  "No language model is configured for this Tessera deployment, so free-form chat generation is unavailable. Deterministic tools and saved application context may still work.";

export const RESPONSE_SUPPRESSED_REPLY =
  "I couldn’t safely verify that generated response, so it was suppressed. Please retry.";

const IDENTITY_RE =
  /\b(who are you|what are you|who is this|who is tessera|what(?:'s| is) your name|your name|where is tessera|where are you|who created you|who made you|your creator)\b/i;

const FOREIGN_MODEL_CLAIM_RE =
  /\b(?:i(?:'m| am)\s+(?:chatgpt|gpt-?\d|claude|gemini|bard|grok|qwen|llama|mistral|deepseek)|my name is\s+(?:chatgpt|gpt-?\d|claude|gemini|bard|grok|qwen|llama|mistral|deepseek)|i was (?:created|trained|developed|made|built) by (?:xai|x\.ai|openai|anthropic|google|meta|alibaba))\b/i;

const UNSUPPORTED_SELFHOOD_RE =
  /\b(?:i am|i'm) (?:a |an )?(?:conscious|sentient|self-aware|living intelligence)\b|\bi (?:have|possess) (?:my own )?(?:feelings|subjective experience|independent consciousness)\b/i;

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
  return FOREIGN_MODEL_CLAIM_RE.test(text || "") || UNSUPPORTED_SELFHOOD_RE.test(text || "");
}

export function identityReply(_userInput: string): string {
  return IDENTITY_UNAVAILABLE_REPLY;
}

export function enforceTesseraVoice(candidate: string, userInput: string): string {
  const text = (candidate || "").trim();
  if (!text) return isIdentityQuestion(userInput) ? identityReply(userInput) : "";
  if (hasSelfClaim(text) || isSearchDump(text)) {
    return isIdentityQuestion(userInput) ? identityReply(userInput) : RESPONSE_SUPPRESSED_REPLY;
  }
  return text;
}

/** Stream-safe accumulation; complete identity output is validated at finalization. */
export function appendTesseraVoice(prev: string, piece: string, userInput: string): string {
  const combined = `${prev || ""}${piece || ""}`;
  if (isIdentityQuestion(userInput)) return combined;
  return enforceTesseraVoice(combined, userInput);
}

/** Last-line display filter when the user turn is no longer in scope. */
export function presentAssistantText(text: string): string {
  if (!text) return text;
  if (hasSelfClaim(text) || isSearchDump(text)) return RESPONSE_SUPPRESSED_REPLY;
  return text;
}
