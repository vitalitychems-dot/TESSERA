import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { KEPT_LESSONS, lessonFor } from "./kept-lessons.ts";
import { learnUntilBetter } from "./recursive-train.ts";

test("the kept file answers the next question and the drill improves", () => {
  const file = readFileSync(new URL("../../../data/school/corrections.jsonl", import.meta.url), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(file, KEPT_LESSONS);
  assert.match(lessonFor("who founded the academy"), /Plato/);
  assert.equal(lessonFor("who founded the academy").includes("Aristotle"), false);
  assert.equal(lessonFor("not a lesson"), "");
  assert.equal(learnUntilBetter().proved, true);
});
