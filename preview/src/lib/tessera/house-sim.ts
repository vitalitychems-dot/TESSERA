/** They live on a circle. A step is a turn. A room appears when two of them meet. */

export const HOUSEHOLD = [
  { name: "Tessera", turn: 0 },
  { name: "Rick", turn: 0.55 },
  { name: "Archivist", turn: 1.1 },
  { name: "Warden", turn: 2.2 },
  { name: "Witness", turn: 2.8 },
] as const;

export function stepHouse(tick: number) {
  return HOUSEHOLD.map((person) => {
    const phase = person.turn + tick * 0.35;
    return { name: person.name, x: Math.cos(phase), y: Math.sin(phase) };
  });
}

export function roomsAt(tick: number) {
  const people = stepHouse(tick);
  const rooms: string[] = [];
  for (let i = 0; i < people.length; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) {
      const dx = people[i].x - people[j].x;
      const dy = people[i].y - people[j].y;
      if (Math.hypot(dx, dy) < 0.85) rooms.push(`${people[i].name} and ${people[j].name}`);
    }
  }
  return rooms;
}
