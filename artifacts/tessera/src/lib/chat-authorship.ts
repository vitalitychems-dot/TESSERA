export type ChatReplyAuthorship = {
  authorRole: "model-drafting" | "model-authored" | "local" | "local-fallback" | "application-result" | "unattributed";
  author: string;
  model: string | null;
  provenance?: "retrieved-evidence" | "unverified-model-knowledge" | null;
  reason?: string | null;
};

const AUTHOR_ROLES = [
  "model-drafting",
  "model-authored",
  "local",
  "local-fallback",
  "application-result",
  "unattributed",
] as const;

export function parseChatAuthorship(value: unknown): ChatReplyAuthorship | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (!AUTHOR_ROLES.includes(data.authorRole as typeof AUTHOR_ROLES[number])) return null;

  const author = typeof data.author === "string"
    ? data.author.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 48)
    : "";
  if (!author) return null;

  const model = typeof data.model === "string" && /^[A-Za-z0-9._:/-]{1,120}$/.test(data.model)
    ? data.model
    : null;
  const provenance = data.provenance === "retrieved-evidence" || data.provenance === "unverified-model-knowledge"
    ? data.provenance
    : null;

  return {
    authorRole: data.authorRole as ChatReplyAuthorship["authorRole"],
    author,
    model,
    provenance,
    reason: typeof data.reason === "string"
      ? data.reason.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 120)
      : null,
  };
}

/** Do not skip a legacy reply and accidentally borrow an earlier model's identity. */
export function lastReplyAuthorship(messages: readonly { role: string; authorship?: unknown }[]): ChatReplyAuthorship | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "assistant") return parseChatAuthorship(messages[index].authorship);
  }
  return null;
}
