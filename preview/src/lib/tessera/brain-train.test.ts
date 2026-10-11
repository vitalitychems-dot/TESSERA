import assert from "node:assert/strict";
import test from "node:test";
import { trainBrain } from "./brain-train.ts";

test("training fills 32 exact answers and does not pretend the overlap is fixed", () => {
  const run = trainBrain();
  assert.equal(run.proved, true);
  assert.equal(run.score, 32);
  assert.match(run.said, /exact recall returns 0/);
  assert.match(run.said, /Overlap still returns the high line/);
});
