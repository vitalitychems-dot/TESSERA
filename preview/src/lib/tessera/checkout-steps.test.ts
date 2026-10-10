import assert from "node:assert/strict";
import test from "node:test";
import { meanSquare, queryOk, readBatch, readCheckouts, riseState, sanitize, surrogate, top1 } from "./checkout-steps.ts";

test("the two functions match the checkout source", () => {
  assert.equal(queryOk("hello"), true);
  assert.equal(queryOk("no"), false);
  assert.equal(queryOk("<script>alert"), false);
  assert.deepEqual(riseState(0.5, 0.5), { hunger: 0.6, fatigue: 0.55 });
  assert.equal(riseState(0.95, 0.98).hunger, 1);
  assert.equal(readCheckouts().proved, true);
  assert.equal(meanSquare([1, 2], [1, 0]), 4);
  assert.equal(top1([[0, 1], [1, 0]], [1, 0]), 100);
  assert.ok(Math.abs(surrogate(0, 10).t - 0.001) < 1e-12);
  assert.equal(sanitize(" <b>hi</b> "), "hi");
  assert.equal(readBatch().proved, true);
});
