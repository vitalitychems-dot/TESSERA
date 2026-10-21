import assert from "node:assert/strict";
import test from "node:test";
import { askAll } from "./ask-all.ts";
import { threeCycles, WEAK } from "./gap-25.ts";

test("three cycles raise the score, version 2 fills only the misses, and five gaps stay open", () => {
  const run = threeCycles();
  assert.equal(run.proved, true);
  assert.deepEqual(run.scores, [0, 8, 16, 20]);
  assert.equal(run.fourth, 0);
  assert.equal(run.addedOnPartial, 12);
  assert.equal(run.weak.length, 5);
  assert.equal(WEAK.length, 5);
  assert.equal(askAll("who are you"), null);
  assert.match(run.said, /She is not AGI/);
});
