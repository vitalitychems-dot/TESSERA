/**
 * Deterministic selectors backed by FNV-1a (hashStringFNV in reality-audit.ts).
 * Replace non-physical Math.random() sites: identical input => identical output.
 * Born-rule qubit collapse and collision-avoidance ID suffixes stay truly random
 * by design and must NOT use these helpers.
 */
import { hashStringFNV } from "./reality-audit";

/** Uniform-ish value in [0, 1) derived from the seed. */
export function seededUnit(seed: string): number {
  return hashStringFNV(seed) / 4294967296;
}

/** Integer in [0, n) derived from the seed. Returns 0 when n <= 0. */
export function seededIndex(seed: string, n: number): number {
  if (n <= 0) return 0;
  return hashStringFNV(seed) % n;
}

/** Pick one element deterministically. Throws on an empty array. */
export function seededPick<T>(seed: string, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error("seededPick: empty array");
  return arr[seededIndex(seed, arr.length)];
}

/** Integer in [base, base + range). */
export function seededInt(seed: string, base: number, range: number): number {
  return base + seededIndex(seed, range);
}

/** Up to k distinct indices in [0, n), deterministic for the seed. */
export function seededDistinctIndices(seed: string, n: number, k: number): number[] {
  const out: number[] = [];
  const want = Math.min(Math.max(k, 0), Math.max(n, 0));
  let salt = 0;
  while (out.length < want) {
    const idx = seededIndex(`${seed}#${salt++}`, n);
    if (!out.includes(idx)) out.push(idx);
  }
  return out;
}

/** Time bucket (UTC hour) used as a seed for input-less generators. */
export function hourBucket(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 13);
}
