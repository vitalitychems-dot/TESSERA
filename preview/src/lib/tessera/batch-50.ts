import { readFileSync } from "node:fs";
import { dataPath } from "./data-path.ts";
export { selector, sequence } from "./tree-steps.ts";

export type BatchRow = { repo: string; github: string; moved: boolean; kb: number; lang: string; description: string };

export function batch50(): BatchRow[] {
  return JSON.parse(readFileSync(dataPath("school", "batch-50.json"), "utf8")) as BatchRow[];
}

