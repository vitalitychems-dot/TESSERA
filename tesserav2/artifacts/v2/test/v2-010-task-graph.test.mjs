import assert from "node:assert/strict";
import test from "node:test";
import { createForeman } from "../src/studio/task-graph.mjs";

test("a dependency blocks start until the earlier task is done", () => {
  const foreman = createForeman();
  foreman.addTask({ id: "draft", title: "Draft the change" });
  foreman.addTask({ id: "prove", title: "Run the tests", dependsOn: ["draft"] });
  assert.throws(() => foreman.start("prove"), /dependencies open/);
  foreman.start("draft");
  foreman.complete("draft");
  assert.equal(foreman.start("prove").status, "running");
  assert.equal(foreman.complete("prove").status, "done");
});

test("an open decision blocks the worker until it is answered", () => {
  const foreman = createForeman();
  foreman.addTask({ id: "draft", title: "Draft the change" });
  const decision = foreman.requestDecision({ taskId: "draft", question: "Which file?" });
  assert.equal(foreman.snapshot().tasks[0].status, "blocked");
  assert.throws(() => foreman.start("draft"), /decision blocks worker/);
  foreman.decide(decision.id, "studio/task-graph.mjs");
  assert.equal(foreman.start("draft").status, "running");
  foreman.complete("draft");
  assert.equal(foreman.snapshot().tasks[0].status, "done");
  assert.equal(foreman.snapshot().decisions[0].answer, "studio/task-graph.mjs");
});
