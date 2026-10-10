import assert from "node:assert/strict";
import test from "node:test";
import { acceptFigure, guardMind, sureAnswer } from "./guard.ts";

test("a missing line is refused, and a wrong figure is refused", () => {
  const run = guardMind();
  assert.equal(run.proved, true);
  assert.equal(sureAnswer([], "scale low").text, "Not stored.");
  assert.equal(acceptFigure("scale low", "5", ["scale low = 0"]), false);
  assert.match(run.said, /claimed 5 is refused/);
});
