import { HELD_PACKET } from "./held-packet.ts";
import { SCHOOL_PASSAGES } from "./school.ts";
import { STUDY_LOG } from "./study-log.ts";

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Always sent. Short on purpose. */
export const GRAPH_CORE =
  "Father outranks Tessera. AGI is not met. A graph lookup is a lookup. Her records and the notes stay in their homes. A missing file stays a gap. A secret is refused. Six jobs are one Tessera, not extra models. Do not name the pen's vendor. Do not name the store.";

export const GRAPH_EDGES = [
  ["pen", "agi"],
  ["store", "homes"],
  ["packet", "study"],
] as const;

type Chunk = { id: string; title: string; text: string; next: string | null };

let chunks: Chunk[] | null = null;

function packetChunks(): Chunk[] {
  if (chunks) return chunks;
  const built: Chunk[] = [];
  const parts = HELD_PACKET.split(/\n(?====== )/);
  for (const part of parts) {
    const title = (part.match(/^===== (.+?) =====/)?.[1] ?? "packet").slice(0, 80);
    const body = part.trim();
    const start = built.length;
    for (let i = 0; i < body.length; i += 650) {
      const text = body.slice(i, i + 700).trim();
      if (text.length < 80) continue;
      built.push({ id: `${title}:${i}`, title, text, next: null });
    }
    for (let i = start; i < built.length - 1; i += 1) built[i].next = built[i + 1].id;
  }
  chunks = built;
  return built;
}

function words(query: string) {
  return [...new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3))];
}

function score(queryWords: string[], text: string) {
  if (!queryWords.length) return 0;
  const hay = text.toLowerCase();
  let hits = 0;
  for (const word of queryWords) if (hay.includes(word)) hits += 1;
  return hits / queryWords.length;
}

const FULL_TOKENS = estimateTokens(HELD_PACKET) + STUDY_LOG.reduce((sum, line) => sum + estimateTokens(line), 0);

export function graphContext(query: string, budget = 900) {
  const queryWords = words(query);
  const picked: string[] = [GRAPH_CORE];
  let used = estimateTokens(GRAPH_CORE);
  const ranked = packetChunks()
    .map((chunk) => ({ chunk, rank: score(queryWords, `${chunk.title}\n${chunk.text}`) }))
    .filter((row) => row.rank > 0)
    .sort((a, b) => b.rank - a.rank);
  const byTitle = new Map<string, number>();
  const chosen = new Set<string>();
  for (const row of ranked) {
    const count = byTitle.get(row.chunk.title) ?? 0;
    if (count >= 1) continue;
    const cost = estimateTokens(row.chunk.text);
    if (used + cost > budget) continue;
    picked.push(`${row.chunk.title}\n${row.chunk.text}`);
    used += cost;
    chosen.add(row.chunk.id);
    byTitle.set(row.chunk.title, count + 1);
    if (picked.length >= 4) break;
  }
  for (const row of ranked) {
    if (!row.chunk.next || chosen.has(row.chunk.next) || !chosen.has(row.chunk.id)) continue;
    const neighbor = packetChunks().find((chunk) => chunk.id === row.chunk.next);
    if (!neighbor) continue;
    const cost = estimateTokens(neighbor.text);
    if (used + cost > budget) break;
    picked.push(`${neighbor.title}\n${neighbor.text}`);
    used += cost;
    chosen.add(neighbor.id);
    break;
  }
  const notes = STUDY_LOG.map((text, index) => ({ text, index, rank: score(queryWords, text) }))
    .filter((row) => row.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 2);
  for (const note of notes) {
    const slice = note.text.slice(0, 420);
    const cost = estimateTokens(slice);
    if (used + cost > budget) break;
    picked.push(`Study note ${note.index + 1}\n${slice}`);
    used += cost;
  }
  const pages = SCHOOL_PASSAGES.map((page) => ({ page, rank: score(queryWords, `${page.title}\n${page.text}`) }))
    .filter((row) => row.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 1);
  for (const page of pages) {
    const slice = `${page.page.title}. ${page.page.text}`;
    const cost = estimateTokens(slice);
    if (used + cost > budget) break;
    picked.push(slice);
    used += cost;
  }
  return { text: picked.join("\n\n"), tokens: used, full: FULL_TOKENS, saved: FULL_TOKENS - used, budget };
}

export function trainEfficiency(queries: string[]) {
  return queries.map((query) => {
    const packed = graphContext(query);
    return {
      query,
      tokens: packed.tokens,
      full: packed.full,
      saved: packed.saved,
      pass: packed.tokens <= packed.budget && packed.saved > packed.full * 0.9,
    };
  });
}
