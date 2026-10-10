import assert from "node:assert/strict";
import test from "node:test";
import { queryOk, readCheckouts, riseState } from "./checkout-steps.ts";

test("the two functions match the checkout source", () => {
  assert.equal(queryOk("hello"), true);
  assert.equal(queryOk("no"), false);
  assert.equal(queryOk("<script>alert"), false);
  assert.deepEqual(riseState(0.5, 0.5), { hunger: 0.6, fatigue: 0.55 });
  assert.equal(riseState(0.95, 0.98).hunger, 1);
  assert.equal(readCheckouts().proved, true);
});
