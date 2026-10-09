import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG } from "./catalog-pass.ts";
import { batch2, leakyStep, resetMem, warmupLr } from "./batch-2.ts";

test("the second fifty were read and three source steps run", () => {
  const rows = batch2();
  assert.equal(rows.length, 50);
  const names = new Set(CATALOG.map((row) => row.name));
  for (const row of rows) assert.equal(names.has(row.repo), true);
  assert.equal(warmupLr(0.1, 5, 10, 1), 0.05);
  assert.equal(warmupLr(0.1, 0, 10, 2), 0.1);
  assert.equal(warmupLr(0.1, 10, 10, 2), 0.2);
  assert.equal(leakyStep(1, 0, 0.5), 0.5);
  assert.equal(leakyStep(1, 0.25, 2), 1.25);
  assert.equal(resetMem(1.5, 1, true, false), 0);
  assert.equal(resetMem(1.5, 1, true, true), 0.5);
  assert.equal(resetMem(1.5, 1, false, true), 1.5);
});
