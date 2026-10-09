import { readFileSync } from "node:fs";
import { dataPath } from "./data-path.ts";

export type BatchRow = { repo: string; github: string; moved: boolean; kb: number; lang: string; description: string };

export function batch2(): BatchRow[] {
  return JSON.parse(readFileSync(dataPath("school", "batch-2.json"), "utf8")) as BatchRow[];
}

/** multiplier 1: base * epoch / total. Read from warmup_scheduler/scheduler.py. */
export function warmupLr(base: number, epoch: number, total: number, multiplier = 1) {
  if (multiplier < 1) return base;
  if (epoch > total) return base * multiplier;
  if (multiplier === 1) return base * (epoch / total);
  return base * ((multiplier - 1) * (epoch / total) + 1);
}

/** mem = clamp(beta) * mem + input. Read from snntorch leaky state function. */
export function leakyStep(mem: number, input: number, beta: number) {
  const kept = Math.min(1, Math.max(0, beta));
  return kept * mem + input;
}

/** Hard reset zeros the charge after a spike. Soft reset subtracts the threshold. Read from Brain-Cog-Lab/msg neuron.py. */
export function resetMem(mem: number, threshold: number, spiked: boolean, soft: boolean) {
  if (!spiked) return mem;
  return soft ? mem - threshold : 0;
}
