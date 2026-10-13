import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGraph } from "../src/brain/synapse.mjs";
import { createRanker, observeInteraction } from "../src/brain/context.mjs";
import { createTimeline } from "../src/brain/temporal.mjs";
const J = [
  { type: "entity", name: "alpha", entityType: "module", observations: ["uses beta parser"] },
  { type: "entity", name: "beta", entityType: "module", observations: ["parser"] },
  { type: "entity", name: "gamma", entityType: "doc", observations: ["notes"] },
  { type: "relation", from: "alpha", to: "gamma" }, { type: "relation", from: "beta", to: "gamma" },
].map((x) => JSON.stringify(x)).join("\n");
test("ranker returns non-neighbours ranked, excludes seed", () => {
  const g = loadGraph(J); const r = createRanker(g)("alpha", 5);
  assert.ok(!r.includes("alpha") && !r.includes("gamma")); assert.equal(r[0], "beta");
});
test("observeInteraction adds edge and synapse", () => {
  const g = loadGraph(J); observeInteraction(g, "alpha", "beta");
  assert.equal(g.edges.size, 3); assert.ok(g.syn.size >= 1);
});
test("timeline snapshot, forward/back diff, correlation", () => {
  const T = createTimeline(); T.addNode(1, "a"); T.link(2, "a", "b"); T.link(5, "b", "c"); T.unlink(7, "a", "b");
  assert.equal(T.at(3).edges.size, 1); assert.equal(T.at(6).edges.size, 2); assert.equal(T.at(8).edges.size, 1);
  const f = T.diff(3, 8), b = T.diff(8, 3);
  assert.deepEqual(f.edgesAdded, [["b", "c"]]); assert.deepEqual(f.edgesRemoved, [["a", "b"]]); assert.deepEqual(b.edgesAdded, [["a", "b"]]);
  assert.ok(T.correlate("a", "b", 2) > 0);
});
