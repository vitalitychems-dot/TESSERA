import assert from "node:assert/strict";
import test from "node:test";
import { bestAction, learnAction, rewardEat } from "./local-learn.ts";

test("a reward raises the action and a second reward raises it again", () => {
  const start = { eat: 0, rest: 0 };
  assert.equal(bestAction(start), "");
  const once = learnAction(start, "eat", 1);
  assert.ok(once.eat > once.rest);
  assert.equal(once.eat, 0.1);
  const run = rewardEat();
  assert.ok(run.twice.eat > run.once.eat);
  assert.equal(run.best, "eat");
});
