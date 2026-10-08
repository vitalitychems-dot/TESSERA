import assert from "node:assert/strict";
import test from "node:test";
import { runTwelve, strideAll, twelveImproved } from "./stride.ts";

test("twelve cycles add local recalls and do not invent the repos that are not here", () => {
  const rows = runTwelve();
  assert.equal(twelveImproved(rows), true);
  assert.equal(rows[0].localBefore, 0);
  assert.equal(rows[11].localAfter, 12);
  assert.ok(rows[11].share > rows[0].share);
  assert.equal(strideAll().length, 8);
  assert.match(rows[11].line, /not reverse engineered/i);
  assert.equal(rows.some((row) => /weight/i.test(row.line)), false);
});
