import assert from "node:assert/strict";
import test from "node:test";
import { trainAndTest } from "./train-pass.ts";

test("skills pass, the second recall is better, and care is only a label", () => {
  const run = trainAndTest();
  assert.equal(run.proved, true);
  assert.match(run.said, /Skills 8 of 8/);
  assert.match(run.said, /Facts 0 then 4/);
  assert.match(run.said, /Corrections 0 then 4/);
  assert.match(run.said, /A third pass added 0/);
  assert.match(run.said, /Seven labels shortened/);
  assert.match(run.said, /not the label/);
});
