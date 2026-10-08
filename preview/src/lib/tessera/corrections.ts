import { readFile } from "node:fs/promises";
import { dataPath } from "./data-path.ts";
import { answerFromCorrections, learnFromMistake } from "./recursive-train.ts";

export type Correction = { q: string; said: string; fact: string };

export function memoryFrom(rows: Correction[]) {
  return rows.reduce((memory, row) => learnFromMistake(memory, row.q, row.said, row.fact), [] as string[]);
}

export function keptAnswer(question: string, rows: Correction[]) {
  return answerFromCorrections(memoryFrom(rows), question);
}

export async function readCorrections() {
  try {
    const raw = await readFile(dataPath("school", "corrections.jsonl"), "utf8");
    const rows: Correction[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as Correction;
      if (row.q && row.said && row.fact) rows.push(row);
    }
    return rows;
  } catch {
    return [];
  }
}
