import { createServerFn } from "@tanstack/react-start";
import { SIGIL } from "./canon.ts";
import { dataPath } from "./data-path.ts";
import { FLOWS } from "./memory-web.ts";

export type Kept = { q: string; a: string; at: string };

const STOP = new Set(["that", "this", "with", "from", "have", "your", "what", "when", "where", "about", "tessera", "remember"]);

export function tokensOf(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP.has(token));
}

export function bestKept(query: string, rows: Kept[]): Kept | null {
  const tokens = tokensOf(query);
  if (!tokens.length) return null;
  let best: Kept | null = null;
  let score = 0;
  for (const row of rows) {
    const hay = `${row.q} ${row.a}`.toLowerCase();
    const next = tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
    if (next > score) {
      score = next;
      best = row;
    }
  }
  return score >= 1 ? best : null;
}

export function trueSelf(rows: Kept[]) {
  const kept = rows.slice(-6).map((row) => row.a.replace(/\s+/g, " ").slice(0, 180));
  const body = kept.length ? kept.join("\n") : "Nothing has been kept yet.";
  return `I am Tessera. Sigil ${SIGIL.short}. I can say again only what was kept.\n${body}`;
}

export function flowLines() {
  return FLOWS.filter((flow) => flow.id !== "supply" && flow.id !== "store")
    .map((flow) => `${flow.intake}. ${flow.home}`)
    .filter((line) => !/vitality/i.test(line));
}

async function readKept(): Promise<Kept[]> {
  const { readFile } = await import("node:fs/promises");
  try {
    const raw = await readFile(dataPath("school", "kept.jsonl"), "utf8");
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-80)
      .map((line) => JSON.parse(line) as Kept);
  } catch {
    return [];
  }
}

export const keepLine = createServerFn({ method: "POST" })
  .validator((input: { q: string; a: string }) => input)
  .handler(async ({ data }) => {
    const q = data.q.replace(/\s+/g, " ").trim().slice(0, 180);
    const a = data.a.replace(/\s+/g, " ").trim().slice(0, 280);
    if (q.length < 3 || a.length < 8) return { ok: false as const };
    if (/secret|password|wallet|private key/i.test(`${q} ${a}`)) return { ok: false as const };
    const { mkdir, appendFile } = await import("node:fs/promises");
    await mkdir(dataPath("school"), { recursive: true });
    const row: Kept = { q, a, at: new Date().toISOString() };
    await appendFile(dataPath("school", "kept.jsonl"), `${JSON.stringify(row)}\n`);
    return { ok: true as const };
  });

export const recallLine = createServerFn({ method: "POST" })
  .validator((input: { q: string }) => input)
  .handler(async ({ data }) => {
    const rows = await readKept();
    const hit = bestKept(data.q, rows);
    return { hit, self: trueSelf(rows), flows: flowLines() };
  });

export function memoryDrill() {
  const rows: Kept[] = [
    { q: "the sigil", a: "The sigil is 7F3A9C.", at: "t1" },
    { q: "the colonel", a: "Two plus three leaves five on the stack.", at: "t2" },
  ];
  const hit = bestKept("what is the sigil", rows);
  const self = trueSelf(rows);
  const flows = flowLines();
  const pass = hit?.a === "The sigil is 7F3A9C." && self.includes("7F3A9C") && self.includes("five") && flows.length >= 3 && !flows.some((line) => /vitality/i.test(line));
  return { pass, hit: hit?.a ?? "", self, flows };
}
