import assert from "node:assert/strict";
import test from "node:test";
import { boardFromPulls, createForeman } from "./foreman.ts";

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
  foreman.decide(decision.id, "foreman.ts");
  assert.equal(foreman.start("draft").status, "running");
});

test("a held pull request is blocked and a clean one stays pending", () => {
  const board = boardFromPulls([
    { repo: "TESSERA", number: 1, title: "Ready work", state: "clean" },
    { repo: "Gitbook", number: 125, title: "Remove pubscan priv files (HOLD until the credential is revoked)", state: "draft" },
  ]);
  assert.equal(board.tasks[0].status, "pending");
  assert.equal(board.tasks[1].status, "blocked");
  assert.match(board.decisions[0].question, /Held/);
});

test("hold matches hold, holds, and holding, not lookalike words", () => {
  const rows = [
    { title: "hold", blocked: true },
    { title: "holds", blocked: true },
    { title: "holding", blocked: true },
    { title: "Hold on", blocked: true },
    { title: "household", blocked: false },
    { title: "threshold", blocked: false },
    { title: "holder", blocked: false },
    { title: "holdings", blocked: false },
  ];
  const board = boardFromPulls(
    rows.map((row, index) => ({ repo: "TESSERA", number: index + 2, title: row.title, state: "clean" })),
  );
  rows.forEach((row, index) => {
    assert.equal(board.tasks[index].status, row.blocked ? "blocked" : "pending", row.title);
  });
  assert.equal(board.decisions.length, 4);
});
