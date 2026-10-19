import assert from "node:assert/strict";
import test from "node:test";
import { learnUntilBetter, recallExact, recallLearned, stepLearn, trainUntilRecursive } from "./recursive-train.ts";

test("a second pass answers from the lesson the first pass kept", () => {
  const run = trainUntilRecursive();
  assert.equal(run.proved, true);
  assert.equal(run.before, 0);
  assert.equal(run.after, 4);
  assert.equal(run.said.startsWith("I am Tessera."), false);
  assert.match(run.said, /^I missed 4 questions\. I kept each fact\. Asked again, I answered 4 from the kept lines\. Each later line quotes the earlier line\.$/);
});

test("a correction replaces the mistake and the mistake is not repeated", () => {
  const run = learnUntilBetter();
  assert.equal(run.proved, true);
  assert.equal(run.before, 0);
  assert.equal(run.after, 4);
  assert.equal(run.said.startsWith("I am Tessera."), false);
  assert.match(run.said, /^I was wrong 4 times\. I kept the correction\. Asked again, I answered 4 and I did not repeat the mistake\.$/);
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

test("an exact key beats a line that only shares the word scale", () => {
  const memory = ["scale high = 10", "scale low = 0"];
  assert.equal(recallLearned(memory, "scale low"), "scale high = 10");
  assert.equal(recallExact(memory, "scale low"), "scale low = 0");
});


