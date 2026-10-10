import assert from "node:assert/strict";
import test from "node:test";
import { measureMetrics } from "./rick-metrics.ts";

test("twenty-five metric swaps keep the same answer", () => {
  const rows = measureMetrics();
  assert.equal(rows.length, 25);
  const names = new Set(rows.map((item) => item.name));
  assert.equal(names.size, 25);
  for (const item of rows) {
    assert.equal(item.same, true, item.name);
    assert.equal(Number.isFinite(item.pct), true, item.name);
  }
});
