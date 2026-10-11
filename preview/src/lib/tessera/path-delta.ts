/** Compare two path lists. Bodies are not part of this. */

export function pathList(block: string) {
  return block.split("\n").map((line) => line.trim()).filter(Boolean);
}

export function pathDelta(held: readonly string[], live: readonly string[]) {
  const have = new Set(held);
  const now = new Set(live);
  const added = [...new Set(live.filter((path) => path && !have.has(path)))];
  const removed = [...new Set(held.filter((path) => path && !now.has(path)))];
  return { added, removed, held: have.size, live: now.size };
}

export function deltaLine(repo: string, delta: { added: readonly string[]; removed: readonly string[]; held: number; live: number }) {
  const added = delta.added.slice(0, 4).join(", ") || "none";
  const removed = delta.removed.slice(0, 4).join(", ") || "none";
  return `${repo}: ${delta.live} live names, ${delta.held} copied. ${delta.added.length} added. ${delta.removed.length} removed. Added: ${added}. Removed: ${removed}. I did not open the bodies.`;
}
