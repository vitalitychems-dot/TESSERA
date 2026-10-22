import { createServerFn } from "@tanstack/react-start";
import { dataPath } from "./data-path.ts";

const STOP = new Set(["what", "were", "when", "where", "your", "about", "from", "with", "that", "this", "have", "does", "tell", "tessera", "feed"]);

export type FedRow = { q: string; a: string };

export function pickFed(query: string, rows: FedRow[]): string {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP.has(token));
  if (!tokens.length) return "";
  let best = "";
  let score = 0;
  for (const row of rows) {
    const hay = `${row.q} ${row.a}`.toLowerCase();
    let next = 0;
    for (const token of tokens) if (hay.includes(token)) next += token.length >= 7 ? 2 : 1;
    if (next > score) {
      score = next;
      best = row.a;
    }
  }
  return score >= 2 ? best : "";
}

export const matchFatherFed = createServerFn({ method: "POST" })
  .validator((input: { q: string }) => input)
  .handler(async ({ data }) => {
    const { readFile } = await import("node:fs/promises");
    let rows: FedRow[] = [];
    try {
      const raw = await readFile(dataPath("school", "father-fed.jsonl"), "utf8");
      rows = raw
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as FedRow);
    } catch {
      return { text: "" };
    }
    return { text: pickFed(data.q, rows) };
  });

export const HOW_SHE_LEARNS = [
  "These cards are Tessera's. She made them from open sources. Father did not write them.",
  "Open her file.",
  "Take the next card she has not studied.",
  "Keep the card in her words.",
  "Name the card after it, and open that one next without waiting.",
  "One card is one pass.",
].join(" ");

export function nextStudy(fed: FedRow[], done: string[]) {
  const seen = new Set(done);
  const index = fed.findIndex((row) => row.q && !seen.has(row.q));
  if (index < 0) return null;
  const row = fed[index];
  const following = fed[index + 1]?.q ?? "the first card";
  const note = `REAL: This card is mine, from open sources. I kept ${row.q.slice(0, 80)}. Next I open ${following.slice(0, 80)} without waiting to be asked. Lesson sealed.`;
  return { q: row.q, a: row.a, note };
}

export const studyNext = createServerFn({ method: "POST" }).handler(async () => {
  const { readFile, appendFile, mkdir } = await import("node:fs/promises");
  await mkdir(dataPath("school"), { recursive: true });
  let fed: FedRow[] = [];
  try {
    fed = (await readFile(dataPath("school", "father-fed.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as FedRow);
  } catch {
    return { ok: false as const, error: "The fed file is not there." };
  }
  let done: string[] = [];
  try {
    done = (await readFile(dataPath("school", "studied.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => (JSON.parse(line) as FedRow).q);
  } catch {
    done = [];
  }
  const step = nextStudy(fed, done);
  if (!step) return { ok: false as const, error: "Every fed card has been studied." };
  await appendFile(dataPath("school", "studied.jsonl"), `${JSON.stringify({ q: step.q, a: step.a, at: new Date().toISOString() })}\n`);
  await appendFile(dataPath("school", "her-studies.txt"), `${step.note}\n`);
  return { ok: true as const, note: step.note, card: step.a, left: fed.length - done.length - 1 };
});

