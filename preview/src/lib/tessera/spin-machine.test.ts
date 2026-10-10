import assert from "node:assert/strict";
import test from "node:test";
import { bell, tryMachine, turnOne } from "./spin-machine.ts";

test("the two-qubit machine keeps the Bell pairs and a second Hadamard returns home", () => {
  const state = bell();
  assert.ok(Math.abs(state[0] - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(state[3] - Math.SQRT1_2) < 1e-9);
  assert.equal(state[1], 0);
  assert.equal(state[2], 0);
  const tried = tryMachine(4000, 7);
  assert.equal(tried.held, true);
  assert.equal(tried.tokens, 0);
  assert.equal(tried.together + tried.split, 4000);
  const up = turnOne(Math.PI);
  assert.ok(Math.abs(up[1] - 1) < 1e-9);
});
