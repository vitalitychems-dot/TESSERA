import { createServerFn } from "@tanstack/react-start";
import { dataPath } from "./data-path.ts";
import { FLOWS } from "./memory-web.ts";
import { SCHOOL_PASSAGES } from "./school.ts";

export type RecallRow = { s: string; t: string };

const STOP = new Set(["that", "this", "with", "from", "have", "your", "what", "when", "where", "about", "tessera", "remember", "everything"]);

function fold(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function recallTokens(text: string) {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 5 && !STOP.has(token));
}

function tokenScore(token: string, hay: string, words: string[]) {
  if (hay.includes(token)) return token.length >= 6 ? 2 : 1;
  if (token.endsWith("ed") && token.length >= 6) {
    const stem = token.slice(0, -2);
    if (stem.length >= 4 && words.some((word) => word.startsWith(stem) && word.length > stem.length)) return 1;
  }
  return 0;
}

export function pickRecall(query: string, rows: RecallRow[], flows: string[]) {
  const tokens = recallTokens(query);
  if (!tokens.length) return null;
  const asked = fold(query).replace(/\s+/g, " ").trim();
  let best: RecallRow | null = null;
  let score = 0;
  for (const row of rows) {
    if (/vitalitychems|price list|peptide|stripe|checkout|\bseo\b/i.test(row.t)) continue;
    if (/\b(tsrt|bitcoin|ethereum|solana|nft|airdrop|sportsbook|tokenomics)\b|\bcoins?\b|\btokens?\b/i.test(row.t)) continue;
    const hay = fold(row.t);
    const words = hay.split(/[^a-z0-9]+/);
    let next = 0;
    for (const token of tokens) next += tokenScore(token, hay, words);
    if (asked.length >= 12 && hay.includes(asked)) {
      next += 8;
      const times = hay.split(asked).length - 1;
      if (times > 1) next += 4;
    }
    if (next > score) {
      score = next;
      best = row;
    }
  }
  if (!best || score < 2) return null;
  let flow = "";
  let flowScore = 0;
  for (const line of flows) {
    const hay = line.toLowerCase();
    const next = tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
    if (next > flowScore) {
      flowScore = next;
      flow = line;
    }
  }
  return { text: best.t, source: best.s, flow: flowScore > 0 ? flow : "" };
}

export const recallCorpus = createServerFn({ method: "POST" })
  .validator((input: { q: string }) => input)
  .handler(async ({ data }) => {
    const { readFile } = await import("node:fs/promises");
    let rows: RecallRow[] = [];
    let meta = { files: 0, lines: 0 };
    try {
      rows = (await readFile(dataPath("school", "recall-index.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as RecallRow);
      rows = rows.concat(SCHOOL_PASSAGES.map((passage) => ({ s: `school/${passage.id}`, t: passage.text })));
      meta = JSON.parse(await readFile(dataPath("school", "recall-meta.json"), "utf8")) as { files: number; lines: number };
    } catch {
      return { text: "", source: "", flow: "", files: 0, lines: 0 };
    }
    let strings: string[] = FLOWS.map((flow) => `${flow.intake}. ${flow.rule} ${flow.home}`);
    try {
      strings = strings.concat((await readFile(dataPath("school", "connections.txt"), "utf8")).split("\n").filter(Boolean));
    } catch {
      /* the flow file can be absent */
    }
    const hit = pickRecall(data.q, rows, strings);
    if (!hit) return { text: "", source: "", flow: "", files: meta.files, lines: meta.lines };
    return { ...hit, files: meta.files, lines: meta.lines };
  });
