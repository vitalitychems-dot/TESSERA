import { hashStringFNV } from "./reality-audit";

export const FEASIBILITY_BASE = 70;
export const FEASIBILITY_SPAN = 25;
export const NOVELTY_BASE = 65;
export const NOVELTY_SPAN = 30;
export const BUILD_STEP_BASE = 8;
export const BUILD_STEP_SPAN = 14;
export const BUILD_START_BASE = 10;
export const BUILD_START_SPAN = 20;
export const REGRESSION_MODULUS = 12;
export const ABSTAIN_BASE = 1;
export const ABSTAIN_SPAN = 3;
export const REGRESSION_RESUME_PROGRESS = 90;

const SLUG_MAX_LENGTH = 40;

export function slugifyTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, SLUG_MAX_LENGTH);
}

/** Same title always yields the same seeded scores; no DB-size or clock terms. */
export function seedFeasibility(title: string): number {
  return FEASIBILITY_BASE + (hashStringFNV(title) % FEASIBILITY_SPAN);
}

export function seedNovelty(title: string): number {
  return NOVELTY_BASE + ((hashStringFNV(title) >>> 4) % NOVELTY_SPAN);
}

/** Stable across restarts and replays, so onConflictDoNothing actually dedupes. */
export function deterministicInventionId(prefix: "sys" | "auto", title: string): string {
  return `${prefix}-${slugifyTitle(title)}-${hashStringFNV(title).toString(36)}`;
}

export function abstainIncrement(title: string, tick: number): number {
  return ABSTAIN_BASE + ((hashStringFNV(title) + tick) % ABSTAIN_SPAN);
}

export function buildStartProgress(title: string): number {
  return BUILD_START_BASE + (hashStringFNV(title) % BUILD_START_SPAN);
}

export function buildStep(title: string, tick: number): number {
  return BUILD_STEP_BASE + ((hashStringFNV(title) + tick) % BUILD_STEP_SPAN);
}

export function testRegressed(title: string, tick: number): boolean {
  return (hashStringFNV(title) + tick) % REGRESSION_MODULUS === 0;
}

export function pickFreshCandidate<T extends { title: string }>(fresh: readonly T[], tick: number): T | undefined {
  if (fresh.length === 0) return undefined;
  const sorted = [...fresh].sort((a, b) => hashStringFNV(a.title) - hashStringFNV(b.title));
  return sorted[tick % sorted.length];
}
