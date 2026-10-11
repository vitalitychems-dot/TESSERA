import { dataPath } from "./data-path.ts";

const BLOCKED = /natal|wallet|secret|credential|shepherd|checkout|payment|cipher|econom|astro|ephemeris|father-identity|father-session|\.agents\/skills/i;
const STOP = new Set(["that", "this", "with", "from", "have", "your", "what", "when", "where", "about", "would", "could", "should", "there", "their", "them", "then", "than", "into", "only", "just", "more", "tessera"]);

type Held = { repo: string; path: string; id: string; bytes: number };

export async function recallSaved(query: string): Promise<string> {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP.has(token))
    .slice(0, 8);
  if (!tokens.length) return "No recall terms in the last message.";
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(dataPath("ingest", "manifest.json"), "utf8");
  const files = ((JSON.parse(raw).files ?? []) as Held[]).filter(
    (file) => !BLOCKED.test(file.path) && file.bytes >= 80 && file.bytes < 200_000,
  );
  const ranked = files
    .map((file) => ({
      file,
      score: tokens.reduce((score, token) => score + (file.path.toLowerCase().includes(token) ? 3 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);
  const pool = ranked[0]?.score ? ranked.filter((row) => row.score > 0).slice(0, 4) : [...ranked].reverse().slice(0, 24);
  const hits: string[] = [];
  for (const row of pool) {
    if (hits.length >= 4) break;
    const text = await readFile(dataPath("ingest", `${row.file.id}.txt`), "utf8").catch(() => "");
    const lower = text.toLowerCase();
    const at = tokens.reduce((found, token) => (found >= 0 ? found : lower.indexOf(token)), -1);
    if (at < 0) continue;
    const start = Math.max(0, at - 40);
    hits.push(`${row.file.repo}/${row.file.path}: ${text.slice(start, start + 220).replace(/\s+/g, " ")}`);
  }
  return hits.length ? hits.join("\n") : "No saved file matched those words.";
}

export async function recallImports(query: string): Promise<string> {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP.has(token))
    .slice(0, 8);
  if (!tokens.length) return "No import term in the last message.";
  const { readFile } = await import("node:fs/promises");
  let files: Held[] = [];
  try {
    files = ((JSON.parse(await readFile(dataPath("imports", "manifest.json"), "utf8")).files ?? []) as Held[]).filter(
      (file) => !BLOCKED.test(file.path),
    );
  } catch {
    return "The Zz import library is not loaded.";
  }
  const ranked = files
    .map((file) => ({
      file,
      score: tokens.reduce((score, token) => score + (file.path.toLowerCase().includes(token) ? 3 : 0), 0),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (!ranked.length) return "No imported file path matched those words.";
  const hits: string[] = [];
  for (const row of ranked) {
    const text = await readFile(dataPath("imports", "files", row.file.id), "utf8").catch(() => "");
    const lower = text.toLowerCase();
    const at = tokens.reduce((found, token) => (found >= 0 ? found : lower.indexOf(token)), -1);
    const excerpt = at >= 0 ? text.slice(Math.max(0, at - 40), at + 180).replace(/\s+/g, " ") : text.slice(0, 180).replace(/\s+/g, " ");
    hits.push(`${row.file.repo}/${row.file.path}: ${excerpt}`);
  }
  return hits.join("\n");
}

export function chamberLines(messages: { role: string; content: string }[]) {
  if (!messages.length) return "No chamber messages are stored in this call.";
  return messages
    .slice(-80)
    .map((message) => `${message.role}: ${message.content.replace(/\s+/g, " ").slice(0, 240)}`)
    .join("\n");
}

export async function recallLedger(query: string): Promise<string> {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP.has(token))
    .slice(0, 8);
  if (!tokens.length) return "No ledger term in the last message.";
  const { readFile } = await import("node:fs/promises");
  let files: { path?: string; repo?: string; status?: string; line?: string }[] = [];
  try {
    files = (JSON.parse(await readFile(dataPath("imports", "read.json"), "utf8")).files ?? []) as typeof files;
  } catch {
    return "The read ledger is not loaded.";
  }
  const hits = files
    .filter((file) => file.status === "read" && !BLOCKED.test(`${file.path ?? ""} ${file.line ?? ""}`))
    .map((file) => {
      const hay = `${file.path ?? ""} ${file.line ?? ""}`.toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
      return { file, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  if (!hits.length) return "No read-ledger line matched those words.";
  return hits.map((row) => `${row.file.repo}/${row.file.path}: ${String(row.file.line ?? "").slice(0, 180)}`).join("\n");
}

export type Note = { query?: string; text?: string };

/** An exact query wins. A shared word does not outrank it. */
export function pickNote(query: string, notes: readonly Note[]) {
  const key = query.toLowerCase().trim();
  const exact = notes.find((note) => (note.query ?? "").toLowerCase().trim() === key && (note.text ?? "").length > 0);
  if (!exact) return "";
  return `${exact.query}: ${String(exact.text).slice(0, 220)}`;
}

export async function recallLearned(query: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  let notes: { query?: string; text?: string; url?: string }[] = [];
  try {
    const raw = await readFile(dataPath("school", "auto-log.jsonl"), "utf8");
    notes = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { query?: string; text?: string; url?: string });
  } catch {
    notes = [];
  }
  try {
    const shelf = await readFile(dataPath("school", "replit-shelf.jsonl"), "utf8");
    const extra = shelf
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { query?: string; text?: string; standing?: string });
    notes.push(...extra.map((note) => ({ query: note.query, text: `${note.standing ?? ""}: ${note.text ?? ""}` })));
  } catch {
    /* shelf is optional */
  }
  if (!notes.length) return "The permanent store is empty.";
  const exact = pickNote(query, notes);
  if (exact) return exact;
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP.has(token))
    .slice(0, 8);
  if (!tokens.length && !/mi6|cia|kgb|fsb/.test(query.toLowerCase())) return "No learned note was due. The question had no recall word.";
  for (const name of ["mi6", "cia", "kgb", "fsb"]) {
    if (query.toLowerCase().includes(name)) tokens.push(name);
  }
  const ranked = notes
    .map((note) => {
      const hay = `${note.query ?? ""} ${note.text ?? ""}`.toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
      return { note, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (!ranked.length) return "Nothing she has stored matches this question. She should say she has not read it.";
  return ranked
    .map((row) => `${row.note.query}: ${String(row.note.text ?? "").slice(0, 220)}`)
    .join("\n");
}
