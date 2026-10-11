export type Ask = { q: string; at: number };

const DAY = 24 * 60 * 60 * 1000;

export function remember(asks: readonly Ask[], next: string, now: number, keep = 8, life = DAY) {
  const live = asks.filter((ask) => now - ask.at < life);
  const text = next.trim();
  if (!text) return live.slice(-keep);
  return [...live, { q: text, at: now }].slice(-keep);
}

export function recall(asks: readonly Ask[], which: "last" | "before", now: number, life = DAY) {
  const live = asks.filter((ask) => now - ask.at < life);
  if (!live.length) return "You have not asked yet.";
  if (which === "before") return live.length < 2 ? "There is no earlier ask." : live[live.length - 2]?.q ?? "";
  return live[live.length - 1]?.q ?? "";
}

export function loadAsks(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as { q?: unknown; at?: unknown };
      return typeof row.q === "string" && typeof row.at === "number" ? [{ q: row.q, at: row.at }] : [];
    });
  } catch {
    return [];
  }
}
