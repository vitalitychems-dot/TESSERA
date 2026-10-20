/** On-foot movement for the house. Left on screen is left. The door is the only way in. */

export function screenOf(x: number, y: number, yaw: number) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const rx = x * c - y * s;
  const ry = x * s + y * c;
  return { x: rx - ry, y: rx + ry };
}

export function stepHouse(x: number, y: number, ax: number, ay: number, dist: number) {
  return { x: x + ax * dist, y: y + ay * dist };
}

export function hitsWall(x: number, y: number) {
  const house = x > -8.7 && x < 8.7 && y > -5.7 && y < 5.85;
  const door = Math.abs(x) <= 1.15 && y >= 5.15 && y <= 6.35;
  return house && !door;
}

export function crossedDoor(fromY: number, toX: number, toY: number) {
  return fromY > 6.15 && toY <= 6.15 && Math.abs(toX) <= 1.15;
}
