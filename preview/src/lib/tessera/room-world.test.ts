import assert from "node:assert/strict";
import test from "node:test";
import { ROOM_THINGS, moveCamera, roomLayout } from "./room-world.ts";

test("each room has a computer and the camera can move closer", () => {
  const room = roomLayout("Rick", 1);
  assert.equal(room.things.some((thing) => thing.thing === "computer"), true);
  assert.equal(room.things.length, ROOM_THINGS.length);
  const closer = moveCamera({ x: 0, y: 0, zoom: 1 }, 12, 0, 1.2);
  assert.equal(closer.x, 12);
  assert.ok(closer.zoom > 1);
});
