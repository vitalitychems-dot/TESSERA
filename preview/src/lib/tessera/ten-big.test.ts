import assert from "node:assert/strict";
import test from "node:test";
import { tenBig } from "./ten-big.ts";

test("ten improvements each change a result", () => {
  const run = tenBig();
  assert.equal(run.proved, true);
  assert.equal(run.passed, 10);
  assert.match(run.said, /Ten of ten moved/);
});
