export const MAX_EVOLUTION_SPEAKERS = 8;
export const MAX_EVOLUTION_ROUNDS = 3;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

/** Body fields cannot expand the speaker × round fan-out past these caps. */
export function clampEvolutionFanout(opts: {
  mode?: string;
  smokeSpeakers?: number;
  rounds?: number;
}): { speakers: number; rounds: number } {
  const rounds = clampInt(opts.rounds, MAX_EVOLUTION_ROUNDS, 1, MAX_EVOLUTION_ROUNDS);
  const requested = clampInt(opts.smokeSpeakers, 7, 1, MAX_EVOLUTION_SPEAKERS);
  const speakers = opts.mode === "full" ? MAX_EVOLUTION_SPEAKERS : requested;
  return { speakers, rounds };
}
