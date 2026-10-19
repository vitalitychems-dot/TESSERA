/** One step from tess/client/src/lib/jitter.ts. The timer loop was not copied. */

export function sectionDelay(baseMs: number, unit: number, jitterPercent = 0.3) {
  const span = baseMs * jitterPercent;
  const jitter = unit * span * 2 - span;
  return Math.max(1000, Math.floor(baseMs + jitter));
}
