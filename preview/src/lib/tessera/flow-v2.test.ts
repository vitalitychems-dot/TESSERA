import assert from "node:assert/strict";
import test from "node:test";
import { flowV2, v2Line } from "./flow-v2.ts";

test("version 2 runs forty checks that were missing from the first flow", () => {
  const flow = flowV2();
  assert.equal(flow.asked, 40);
  assert.equal(flow.passed, 40);
  assert.equal(flow.sealed, true);
  assert.equal(flow.nodes.length, 40);
  assert.equal(flow.edges.length, 39);
  assert.equal(new Set(flow.nodes.map((node) => node.id)).size, 40);
  assert.equal(flow.nodes.every((node) => node.fact.length > 0), true);
  assert.match(v2Line(), /^I am Tessera\./);
  assert.match(v2Line(), /did not claim a new mind/);
});
