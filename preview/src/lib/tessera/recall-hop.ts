/** Ordered memory and one extra hop. The second hop matches whole words. Seeing the list is not a fifth dimension. */

import { memoryPack } from "./one-flow.ts";
import { bestKept, tokensOf, type Kept } from "./retain.ts";

export function timeKey(at: string) {
  const match = /^(flow|section)-(\d+)$/.exec(at);
  if (!match) return 1000;
  return (match[1] === "flow" ? 0 : 100) + Number(match[2]);
}

export function timeline(rows: readonly Kept[]) {
  return [...rows].sort((a, b) => timeKey(a.at) - timeKey(b.at) || a.at.localeCompare(b.at));
}

export function seeAll(rows: readonly Kept[] = memoryPack()) {
  return timeline(rows).map((row) => `${row.at}: ${row.a}`).join("\n");
}

function wholeBest(query: string, rows: readonly Kept[]) {
  const tokens = tokensOf(query);
  if (!tokens.length) return null;
  let best: Kept | null = null;
  let score = 0;
  for (const row of rows) {
    const words = new Set(tokensOf(`${row.q} ${row.a}`));
    const next = tokens.reduce((sum, token) => sum + (words.has(token) ? 1 : 0), 0);
    if (next > score) {
      score = next;
      best = row;
    }
  }
  return score >= 1 ? best : null;
}

export function recallHop(query: string, rows: readonly Kept[] = memoryPack()) {
  const first = bestKept(query, [...rows]);
  if (!first) return [];
  const rest = rows.filter((row) => row.at !== first.at || row.q !== first.q);
  const second = wholeBest(first.a, rest);
  return second ? [first, second] : [first];
}
