import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { batch4, linearSample, quadraticIn, quadraticOut } from "./batch-4.ts";
import { CATALOG } from "./catalog-pass.ts";
import { dataPath } from "./data-path.ts";

test("the remaining catalog cards were read and three tween steps run", () => {
  const rows = batch4();
  assert.equal(rows.length, 42);
  const names = new Set(CATALOG.filter((row) => row.home === "card").map((row) => row.name));
  const earlier = new Set();
  for (const file of ["batch-50.json", "batch-2.json", "batch-3.json"]) {
    const prior = JSON.parse(readFileSync(dataPath("school", file), "utf8")) as { repo: string }[];
    for (const row of prior) earlier.add(row.repo);
  }
  for (const row of rows) {
    assert.equal(names.has(row.repo), true);
    assert.equal(earlier.has(row.repo), false);
  }
  assert.equal(rows.filter((row) => row.moved).length, 3);
  assert.equal(rows[0]?.repo, "StockSharp/StockSharp");
  assert.equal(rows[41]?.repo, "zai-org/GLM-5");

  assert.equal(linearSample(0, 10, 0.5), 5);
  assert.equal(linearSample(2, 6, 0), 2);
  assert.equal(linearSample(2, 6, 1), 6);
  assert.equal(quadraticIn(3), 9);
  assert.equal(quadraticIn(0.5), 0.25);
  assert.equal(quadraticOut(0.5), 0.75);
  assert.equal(quadraticOut(0), 0);
  assert.equal(quadraticOut(1), 1);
});
