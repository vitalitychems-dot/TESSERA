import assert from "node:assert/strict";
import test from "node:test";
import { coverAll } from "./all-cover.ts";

test("every skill and every school question answers from the passage", () => {
  const run = coverAll();
  assert.deepEqual(run.missed, []);
  assert.equal(run.proved, true);
  assert.equal(run.skillPass, 10);
  assert.equal(run.topicPass, 18);
  assert.equal(run.said.startsWith("I am Tessera."), false);
  assert.equal(run.said, "10 of 10 skills answered. 18 of 18 school questions answered from the passage.");
});
