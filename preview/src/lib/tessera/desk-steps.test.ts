import assert from "node:assert/strict";
import test from "node:test";
import {
  acMood,
  allEight,
  blueprintCoherence,
  brainCogStep,
  brainSimStep,
  godelLabel,
  humanRate,
  hyperonBool,
} from "./desk-steps.ts";

test("all eight checkouts run a step that was read from their files", () => {
  const spike = brainCogStep(0, 2);
  assert.equal(spike.spike, true);
  assert.equal(spike.mem, 0);
  const quiet = brainSimStep(0.5);
  assert.equal(quiet.fired, false);
  assert.equal(brainSimStep(1.2).fired, true);
  assert.equal(godelLabel(0.9), "healthy");
  assert.equal(godelLabel(0.5), "degraded");
  assert.equal(godelLabel(0.1), "down");
  assert.equal(godelLabel(null), "unknown");
  assert.equal(humanRate([10, 30]), 50);
  assert.equal(acMood(0.9), "optimistic and emotionally stable");
  assert.equal(blueprintCoherence(3, 1, 4), 0.5);
  assert.equal(hyperonBool("True"), true);
  assert.equal(hyperonBool("False"), false);
  assert.equal(hyperonBool("Maybe"), null);
  const eight = allEight();
  assert.equal(Object.keys(eight).length, 8);
  assert.equal(eight.neuro, "eat");
  assert.equal(eight.human, 50);
});
