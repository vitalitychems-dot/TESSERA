import { readFileSync } from "node:fs";
import { dataPath } from "./data-path.ts";
export { leakyStep, resetMem, warmupLr } from "./sched.ts";

export type BatchRow = { repo: string; github: string; moved: boolean; kb: number; lang: string; description: string };

export function batch2(): BatchRow[] {
  return JSON.parse(readFileSync(dataPath("school", "batch-2.json"), "utf8")) as BatchRow[];
}

