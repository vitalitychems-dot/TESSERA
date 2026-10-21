import assert from "node:assert/strict";
import test from "node:test";
import { examScore, improveLoops } from "./improve-loop.ts";

test("each wave raises the exam, and repeating a wave does not", () => {
  assert.equal(examScore([]), 0);
  const run = improveLoops();
  assert.equal(run.proved, true);
  assert.deepEqual(run.scores, [0, 4, 8, 12, 32]);
  assert.match(run.said, /stayed at 32/);
  assert.equal(run.scores[4] - run.scores[3], 20);
});
