import { readFileSync } from "node:fs";
import { dataPath } from "./data-path.ts";

export type BatchRow = { repo: string; github: string; moved: boolean; kb: number; lang: string; description: string };

export function batch50(): BatchRow[] {
  return JSON.parse(readFileSync(dataPath("school", "batch-50.json"), "utf8")) as BatchRow[];
}

/** Sequence opts out on failure. Read from Calamari/BehaviorTree.js Sequence.js. */
export function sequence(results: boolean[]) {
  for (const ok of results) if (!ok) return false;
  return true;
}

/** Selector opts out on success. Read from Calamari/BehaviorTree.js Selector.js. */
export function selector(results: boolean[]) {
  for (const ok of results) if (ok) return true;
  return false;
}
