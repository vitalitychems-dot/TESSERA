import { readFileSync } from "node:fs";
import { dataPath } from "./data-path.ts";

export type KeptRow = { repo: string; github: string; moved: boolean; kb: number; lang: string; description: string };

/** Cards the third-batch publish dropped. Pointers only. */
export function batch3Kept(): KeptRow[] {
  return JSON.parse(readFileSync(dataPath("school", "batch-3-kept.json"), "utf8")) as KeptRow[];
}
