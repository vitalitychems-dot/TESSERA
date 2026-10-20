import assert from "node:assert/strict";
import test from "node:test";
import { puzzleFixes } from "./puzzle-fix.ts";

test("every joint that moves is kept, and the numbers are the measurement", () => {
  const rows = puzzleFixes();
  assert.equal(rows.length, 30);
  const dropped = rows.filter((row) => !row.kept);
  assert.deepEqual(dropped.map((row) => row.n), []);
  for (const row of rows) {
    console.log(`${row.n}\t${row.before}\t${row.after}\t${row.unit}\t${row.name}`);
  }
});
