import assert from "node:assert/strict";
import test from "node:test";
import { averageUpdate, chem, confidence, formatTime, hiddenReward, holePush, meanSquare, queryOk, readBatch, readCheckouts, readImported, readMore, riseState, sanitize, stepKind, surrogate, top1 } from "./checkout-steps.ts";

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
  assert.equal(formatTime(1500), "1.50s");
  assert.equal(confidence(true, 11, 1), 0.5);
  assert.equal(chem(5).serotonin, 0.1);
  assert.equal(holePush([], 0, "a").firstHole, 1);
  assert.equal(readMore().proved, true);
  const once = averageUpdate(0, 0, 2);
  assert.equal(averageUpdate(once.sum, once.count, 4).avg, 3);
  assert.equal(hiddenReward(hiddenReward({}, 3), 2).hidden, 5);
  assert.equal(stepKind("last", 1).discount, 0);
  assert.equal(readImported().proved, true);
});
