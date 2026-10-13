import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGraph, hebbian, decay, recall, connectome, weight, synapse, predict } from "../src/brain/synapse.mjs";
import { classify, replyStyle } from "../src/brain/affect.mjs";
import { createLearner } from "../src/brain/learn.mjs";
import { gate, propose, FLAG } from "../src/brain/selfpatch.mjs";
import { benchAffect, benchPatch } from "../src/brain/bench.mjs";
const J = [
  { type: "entity", name: "A", entityType: "x", observations: [] }, { type: "entity", name: "B", entityType: "x", observations: [] },
  { type: "relation", from: "A", to: "B", relationType: "r" }, { type: "relation", from: "B", to: "C", relationType: "r" },
].map((r) => JSON.stringify(r)).join("\n") + "\nnot json";
test("B1-01 synapse: load, hebbian strengthens with cap, decay prunes, recall, connectome", () => {
  const g = loadGraph(J); assert.equal(g.nodes.size, 3); assert.equal(weight(g, "A", "B"), 1);
  hebbian(g, ["A", "C"]); assert.equal(synapse(g, "A", "C"), 0.5); assert.equal(weight(g, "A", "C"), 0);
  for (let i = 0; i < 200; i++) hebbian(g, ["A", "B"]); assert.ok(synapse(g, "A", "B") < 10); assert.equal(weight(g, "A", "B"), 1);
  assert.equal(recall(g, "C", 2)[0], "B"); assert.ok(predict(g, "C", 3).includes("A"));
  const pruned = decay(g, { factor: 0.01, floor: 0.05 }); assert.ok(pruned >= 1);
  assert.ok(connectome(loadGraph(J)).modules >= 1);
});
test("B1-02 affect/intent classifier", () => {
  assert.equal(classify("I approve all").intent, "approve");
  assert.equal(classify("undo 3").intent, "undo");
  assert.equal(classify("How many left?").intent, "ask");
  assert.equal(classify("this is broken again").affect, "negative");
  assert.equal(replyStyle(classify("this is broken")), "acknowledge-then-fix");
  const b = benchAffect(); assert.ok(b.intent.f1 > b.intent.baselineF1 + 0.5); assert.ok(b.affect.f1 > b.affect.baselineF1 + 0.5);
});
test("B1-03 learner: failures raise priority, mastery closes topic", () => {
  const L = createLearner(["a", "b"]); L.record("a", false); assert.equal(L.next(), "a");
  for (let i = 0; i < 6; i++) L.record("b", true); assert.ok(L.mastered("b"));
  const g = loadGraph(""); const L2 = createLearner(["a"], { graph: g }); L2.record("a", true);
  assert.ok(synapse(g, "topic:a", "outcome:pass") > 0);
});
test("B1-04 self-patch: default off, suggest-only, every unsafe proposal rejected", () => {
  const p = { title: "t", testRef: "test/a.test.mjs", testResult: { passed: 1, failed: 0 }, author: "tessera", approver: "father", mode: "suggest", files: ["a.mjs"], diff: "+x" };
  assert.equal(propose(p, {}).status, "disabled");
  assert.equal(propose(p, { [FLAG]: "1" }).status, "proposed");
  assert.deepEqual(gate({ ...p, diff: "+TESSERA_ENABLE_X=1" }).failed, ["no-flag-flip"]);
  const b = benchPatch(); assert.equal(b.gatedAccepted, 0); assert.equal(b.safeRejected, 0);
});
