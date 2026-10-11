import assert from "node:assert/strict";
import test from "node:test";
import { clampUnit, qStep, stateKey, trainNormal } from "./own-step.ts";

test("a state key, a clamp, and a q step match the file, and the rest of the catalog stays unported", () => {
  const run = trainNormal();
  assert.equal(run.proved, true);
  assert.equal(run.after, 5);
  assert.equal(stateKey(0.5, 0.55), "h5_f5");
  assert.equal(clampUnit(2), 1);
  assert.equal(clampUnit(-1), 0);
  assert.ok(Math.abs(qStep(0.1, 1, 0) - 0.19) < 1e-9);
  assert.match(run.said, /other names were not turned into programs/);
});
