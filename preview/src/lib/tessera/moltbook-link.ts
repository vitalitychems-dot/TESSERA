/** What a Moltbook response means. No key is stored here. */

export function moltbookLine(status: number, resetAt: string | null) {
  if (status === 429) return `Moltbook refused a new agent. The limit resets at ${resetAt ?? "a later time"}. No key was saved.`;
  if (status === 409) return "That Moltbook name is already taken. No key was saved.";
  if (status === 401) return "Moltbook is not attached. No key was saved.";
  if (status === 200) return "Moltbook answered. The claim is still the owner's step.";
  return `Moltbook returned ${status}. No key was saved.`;
}
