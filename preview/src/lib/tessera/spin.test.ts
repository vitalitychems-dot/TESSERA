import assert from "node:assert/strict";
import test from "node:test";
import { roomsAt, stepHouse } from "./house-sim.ts";
import { born, interferePick, turn } from "./spin.ts";

test("a contradicted path cancels, and the house is a turn on this machine", () => {
  const even = born(turn([1, 0], Math.PI / 4));
  assert.ok(Math.abs(even.left - 0.5) < 1e-9);
  assert.ok(Math.abs(even.right - 0.5) < 1e-9);
  const picked = interferePick([
    { name: "count", paths: [0.8, -0.8] },
    { name: "keep", paths: [0.3, 0.3] },
  ]);
  assert.equal(picked.name, "keep");
  const start = stepHouse(0);
  assert.equal(start.length, 5);
  assert.equal(start[0].name, "Tessera");
  assert.notDeepEqual(stepHouse(1), start);
  const rooms = roomsAt(0);
  assert.equal(rooms.length > 0, true);
  assert.equal(roomsAt(0).join("|"), rooms.join("|"));
});
