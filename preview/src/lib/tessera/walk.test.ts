import assert from "node:assert/strict";
import test from "node:test";
import { crossedDoor, hitsWall, screenOf, stepHouse } from "./walk.ts";

test("forward walks to the door, and left is left", () => {
  const forward = stepHouse(0, 8, 0, -1, 1);
  const left = stepHouse(0, 8, -1, 0, 1);
  const right = stepHouse(0, 8, 1, 0, 1);
  assert.equal(forward.y, 7);
  assert.equal(forward.x, 0);
  assert.ok(left.x < 0);
  assert.ok(right.x > 0);
  const yaw = 0.55;
  const start = screenOf(0, 8, yaw);
  const nearer = screenOf(forward.x, forward.y, yaw);
  assert.ok(nearer.y < start.y);
  assert.equal(hitsWall(0, 0), true);
  assert.equal(hitsWall(0, 8), false);
  assert.equal(hitsWall(0, 5.5), false);
  assert.equal(crossedDoor(6.4, 0, 6), true);
  assert.equal(crossedDoor(6.4, 4, 6), false);
});
