import { readFileSync } from "node:fs";
import { dataPath } from "./data-path.ts";

export type BatchRow = {
  repo: string;
  github: string;
  moved: boolean;
  kb: number;
  lang: string;
  description: string;
  held: boolean;
};

export function batch3(): BatchRow[] {
  return JSON.parse(readFileSync(dataPath("school", "batch-3.json"), "utf8")) as BatchRow[];
}

/** Distances read from qiao/PathFinding.js src/core/Heuristic.js. */
export function manhattan(dx: number, dy: number) {
  return dx + dy;
}

export function euclidean(dx: number, dy: number) {
  return Math.sqrt(dx * dx + dy * dy);
}

export function chebyshev(dx: number, dy: number) {
  return Math.max(dx, dy);
}

export function octile(dx: number, dy: number) {
  const bend = Math.SQRT2 - 1;
  return dx < dy ? bend * dx + dy : bend * dy + dx;
}

/** Clamp and positive modulus. Read from spacejack/carphysics2d public/js/GMath.js. */
export function clampNumber(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export function positiveMod(n: number, m: number) {
  return ((n % m) + m) % m;
}

/** Step is 1 at zero and above, otherwise 0. Read from pkuxmq/OTTT-SNN modules/surrogate.py heaviside. */
export function heaviside(x: number) {
  return x >= 0 ? 1 : 0;
}
