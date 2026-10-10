import assert from "node:assert/strict";
import test from "node:test";
import { rickThirtyLine } from "./rick-thirty.ts";

test("thirty before-and-after rows all change", () => {
  const run = rickThirtyLine();
  assert.equal(run.proved, true);
  assert.equal(run.moved, 30);
  assert.equal(new Set(run.rows.map((row) => row.name)).size, 30);
  for (const row of run.rows) assert.notEqual(row.before, row.after);
});
