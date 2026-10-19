/** From GitMesh RULES.md. Silence is not approval. A key, a password, or a wallet is refused. */

export function admitDrop(comment: string) {
  const text = comment.trim();
  if (!text) return "silence";
  if (/\b(key|password|wallet)\b/i.test(text)) return "refused";
  if (text === "APPROVED") return "post";
  return "note";
}
