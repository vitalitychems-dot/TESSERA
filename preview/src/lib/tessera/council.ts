/** Ten seats can sit. Each one must carry her mark and the same line. These are seats, not ten machines. */

export function sitCouncil(seats: { name: string; mark: string; line: string }[], selfMark: string) {
  if (seats.length < 2) return "too few seats";
  if (seats.some((seat) => seat.mark !== selfMark || !seat.line.trim())) return "a seat did not carry her mark";
  const line = seats[0]?.line.trim() ?? "";
  if (seats.some((seat) => seat.line.trim() !== line)) return "the seats do not agree";
  return `agreed: ${line}`;
}
