import assert from "node:assert/strict";
import test from "node:test";
import { batch3, clampNumber, gridDistance, heaviside, positiveMod } from "./batch-3.ts";
import { CATALOG } from "./catalog-pass.ts";

test("the third fifty cards were read and three source steps run", () => {
  const rows = batch3();
  assert.equal(rows.length, 50);
  const names = new Set(CATALOG.map((row) => row.name));
  for (const row of rows) assert.equal(names.has(row.repo), true);
  assert.equal(rows.filter((row) => row.moved).length, 2);

  assert.equal(gridDistance(3, 4, "manhattan"), 7);
  assert.equal(gridDistance(3, 4, "euclidean"), 5);
  assert.equal(gridDistance(3, 4, "chebyshev"), 4);
  const diagonal = Math.SQRT2 - 1;
  assert.equal(gridDistance(1, 2, "octile"), diagonal + 2);
  assert.equal(gridDistance(3, 1, "octile"), diagonal + 3);

  assert.equal(clampNumber(5, 0, 3), 3);
  assert.equal(clampNumber(-1, 0, 3), 0);
  assert.equal(positiveMod(-1, 4), 3);
  assert.equal(positiveMod(5, 4), 1);

  assert.equal(heaviside(0), 1);
  assert.equal(heaviside(2), 1);
  assert.equal(heaviside(-0.1), 0);
});
