import assert from "node:assert/strict";
import test from "node:test";
import { expandCycles, NEXT_WEAK } from "./expand-3.ts";

test("a new deck rises three times and leaves four directions open", () => {
  const run = expandCycles();
  assert.equal(run.proved, true);
  assert.deepEqual(run.scores, [0, 4, 8, 12]);
  assert.equal(run.fourth, 0);
  assert.equal(run.addedOnPartial, 8);
  assert.equal(NEXT_WEAK.length, 4);
  assert.match(run.said, /not a logged run/);
});
