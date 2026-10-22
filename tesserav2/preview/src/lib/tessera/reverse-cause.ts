/** Time order decides the cause. A later event does not create an earlier one. */

export function reverseCause(
  events: { name: string; at: number }[],
  claimedCause: string,
  claimedEffect: string,
) {
  const cause = events.find((event) => event.name === claimedCause);
  const effect = events.find((event) => event.name === claimedEffect);
  if (!cause || !effect) return { known: false as const, reversed: false as const, created: false as const };
  const reversed = cause.at > effect.at;
  return {
    known: true as const,
    reversed,
    created: false as const,
    earlier: reversed ? claimedEffect : claimedCause,
  };
}
