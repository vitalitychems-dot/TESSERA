import assert from "node:assert/strict";
import test from "node:test";
import { recordArms } from "../src/token/ab-graph.mjs";

test("graph retrieval and full-file arms are both recorded", () => {
  const full = "The studio wall lists every task, its desk, and the decision that blocks it. ".repeat(20);
  const notes = "TESSERA_v2: studio wall, desks, decisions.";
  const run = recordArms("task-ab-1", full, notes);
  assert.equal(run.task, "task-ab-1");
  assert.equal(typeof run.arms.fullFile.tokens, "number");
  assert.equal(typeof run.arms.graph.tokens, "number");
  assert.equal(run.arms.fullFile.success, true);
  assert.equal(run.arms.graph.success, true);
  assert.ok(run.arms.graph.tokens < run.arms.fullFile.tokens);
});
