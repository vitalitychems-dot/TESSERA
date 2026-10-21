import assert from "node:assert/strict";
import test from "node:test";
import { recognizeEmpathy, recursiveLesson } from "./empath.ts";

test("care is a label on the words", () => {
  const hits = recognizeEmpathy("I love you and I will not give up");
  assert.equal(hits[0]?.label, "care");
  assert.equal(hits.some((hit) => hit.label === "distress"), false);
});

test("a second pass uses the earlier lesson and stays a label", () => {
  const first = recursiveLesson([], "I am scared and overwhelmed");
  assert.match(first, /PATTERN: distress, first note/);
  assert.match(first, /not a feeling she has/);
  const second = recursiveLesson([first], "Still scared of the same thing");
  assert.match(second, /seen again/);
  assert.match(second, /Name the strain/);
  assert.doesNotMatch(second, /she feels/);
});

test("a line with no pattern is not invented", () => {
  const lesson = recursiveLesson([], "The archive has 7,282 files.");
  assert.match(lesson, /PATTERN: none/);
});
