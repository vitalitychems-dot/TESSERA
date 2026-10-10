/** A 2D room. The camera looks at their things. It is not pointed at anyone outside. */

export const ROOM_THINGS = ["computer", "desk", "lamp", "book", "door", "chair", "window", "clock"] as const;

export function roomLayout(name: string, index: number) {
  const x = index * 240;
  return {
    name,
    x,
    computer: { x: x + 36, y: 48 },
    things: ROOM_THINGS.map((thing, place) => ({
      thing,
      x: x + 20 + (place % 4) * 52,
      y: 28 + Math.floor(place / 4) * 64,
    })),
  };
}

export function moveCamera(camera: { x: number; y: number; zoom: number }, dx: number, dy: number, zoomBy = 1) {
  const zoom = Math.min(2.5, Math.max(0.6, camera.zoom * zoomBy));
  return { x: camera.x + dx, y: camera.y + dy, zoom };
}
