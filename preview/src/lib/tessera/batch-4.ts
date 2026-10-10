import { readFileSync } from "node:fs";
import { dataPath } from "./data-path.ts";

export type BatchRow = { repo: string; github: string; moved: boolean; kb: number; lang: string; description: string };

export function batch4(): BatchRow[] {
  return JSON.parse(readFileSync(dataPath("school", "batch-4.json"), "utf8")) as BatchRow[];
}

/** Linear sample. Read from tweenjs/tween.js src/Interpolation.ts Utils.Linear. */
export function linearSample(p0: number, p1: number, t: number) {
  return (p1 - p0) * t + p0;
}

/** Quadratic ease in. Read from tweenjs/tween.js src/Easing.ts Quadratic.In. */
export function quadraticIn(amount: number) {
  return amount * amount;
}

/** Quadratic ease out. Read from tweenjs/tween.js src/Easing.ts Quadratic.Out. */
export function quadraticOut(amount: number) {
  return amount * (2 - amount);
}
