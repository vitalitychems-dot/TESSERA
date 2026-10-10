import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG } from "./catalog-pass.ts";
import { batch3, chebyshev, euclidean, manhattan, octile } from "./batch-3.ts";

test("the third fifty were read, trading stayed out, and the path distances run", () => {
  const rows = batch3();
  assert.equal(rows.length, 50);
  const names = new Set(CATALOG.map((row) => row.name));
  for (const row of rows) assert.equal(names.has(row.repo), true);
  assert.ok(rows.filter((row) => row.held).length >= 18);
  assert.equal(rows.some((row) => row.held && row.repo === "qiao/PathFinding.js"), false);
  assert.equal(manhattan(3, 4), 7);
  assert.equal(euclidean(3, 4), 5);
  assert.equal(chebyshev(3, 4), 4);
  const bend = Math.SQRT2 - 1;
  assert.equal(octile(3, 4), bend * 3 + 4);
});
