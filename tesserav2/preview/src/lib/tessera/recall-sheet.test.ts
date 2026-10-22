import assert from "node:assert/strict";
import test from "node:test";
import { finishRecall } from "./recall-sheet.ts";

test("eight measured facts are recalled, and an unknown question is not", () => {
  const run = finishRecall();
  assert.equal(run.proved, true);
  assert.equal(run.before, 0);
  assert.equal(run.after, 8);
  assert.match(run.said, /not finished/);
});
