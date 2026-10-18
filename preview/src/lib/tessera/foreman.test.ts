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

test("hold matches the word and not household or threshold", () => {
  const board = boardFromPulls([
    { repo: "TESSERA", number: 2, title: "household chores", state: "clean" },
    { repo: "TESSERA", number: 3, title: "threshold check", state: "clean" },
    { repo: "TESSERA", number: 4, title: "withhold the notes", state: "clean" },
    { repo: "TESSERA", number: 5, title: "Please hold", state: "clean" },
    { repo: "TESSERA", number: 6, title: "HOLD the line", state: "clean" },
  ]);
  assert.equal(board.tasks[0].status, "pending");
  assert.equal(board.tasks[1].status, "pending");
  assert.equal(board.tasks[2].status, "pending");
  assert.equal(board.tasks[3].status, "blocked");
  assert.equal(board.tasks[4].status, "blocked");
  assert.equal(board.decisions.length, 2);
});
