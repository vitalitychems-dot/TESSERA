import assert from "node:assert/strict";
import test from "node:test";
import { evolve } from "./evolve.ts";

test("a new line is written only when two facts produce it, and a repeat adds nothing", () => {
  const run = evolve();
  assert.equal(run.proved, true);
  assert.equal(run.lines, 3);
  assert.match(run.said, /Socrates was not invented/);
  assert.match(run.said, /next pass added nothing/);
});
