import assert from "node:assert/strict";
import test from "node:test";
import { tickReward } from "./reward-tick.ts";

test("each reward adds less than the one before it", () => {
  const first = tickReward(0);
  const second = tickReward(first.value);
  assert.ok(Math.abs(first.gain - 0.1) < 1e-9);
  assert.ok(second.gain < first.gain);
  assert.ok(second.value > first.value);
});
