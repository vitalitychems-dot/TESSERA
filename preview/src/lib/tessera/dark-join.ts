/** Join seats that already carry the mark. There is no timer. This is not faster than light. */

export function assembleNow(seats: { name: string; mark: string }[], carried: string) {
  const mark = carried.trim();
  const joined = mark
    ? seats.filter((seat) => seat.name.trim() && seat.mark === mark).map((seat) => seat.name.trim())
    : [];
  return { joined, waited: 0, fasterThanLight: false as const };
}
