import assert from "node:assert/strict";
import test from "node:test";
import { learnUntilBetter, stepLearn, trainUntilRecursive } from "./recursive-train.ts";

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

test("links appear only after a fact is kept, and a fifth step adds nothing", () => {
  assert.equal(stepLearn(0).links.length, 0);
  assert.equal(stepLearn(1).recalled, 1);
  assert.equal(stepLearn(1).links.length, 0);
  const done = stepLearn(4);
  assert.equal(done.recalled, 4);
  assert.equal(done.links.length, 3);
  assert.deepEqual(stepLearn(5), done);
});

