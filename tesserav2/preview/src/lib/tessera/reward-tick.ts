/** One reward on a timer. The next gain is smaller. This does not store a skill. */

export function tickReward(value: number) {
  const next = value + 0.1 * (1 - value);
  return { value: next, gain: next - value };
}
