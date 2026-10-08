import assert from "node:assert/strict";
import test from "node:test";
import { learnUntilBetter, trainUntilRecursive } from "./recursive-train.ts";

test("a second pass answers from the lesson the first pass kept", () => {
  const run = trainUntilRecursive();
  assert.equal(run.proved, true);
  assert.equal(run.before, 0);
  assert.equal(run.after, 4);
});

test("a correction replaces the mistake and the mistake is not repeated", () => {
  const run = learnUntilBetter();
  assert.equal(run.proved, true);
  assert.equal(run.before, 0);
  assert.equal(run.after, 4);
  assert.match(run.said, /did not repeat the mistake/);
});
