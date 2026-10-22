import assert from "node:assert/strict";
import test from "node:test";
import { BAND, studyBand } from "./band-185.ts";
import { listen } from "./smarter-chat.ts";

test("185 lines are learned one at a time and the next ask hits", () => {
  assert.equal(BAND.length, 185);
  assert.equal(new Set(BAND.map((lesson) => lesson.key)).size, 185);
  const run = studyBand();
  assert.equal(run.steps.length, 185);
  assert.equal(run.known, 185);
  for (const step of run.steps) {
    assert.equal(step.missed, true, step.key);
    assert.equal(step.hit, true, step.key);
    assert.equal(step.after, step.before + 1, step.key);
  }
  assert.equal(run.steps[184]?.after, 185);
  assert.equal(listen("I am proud of you"), "I heard pride.");
  assert.equal(listen("I am ashamed"), "I heard shame.");
  assert.equal(listen("I am overwhelmed"), "I heard the weight.");
  assert.equal(listen("hello"), "");
});
