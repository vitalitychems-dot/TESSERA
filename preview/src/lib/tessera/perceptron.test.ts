import assert from "node:assert/strict";
import test from "node:test";
import { brainMesh, perceptron } from "./perceptron.ts";

test("a perceptron fires only when the weighted sum crosses the threshold", () => {
  const hot = perceptron([1, 1], [0.6, 0.6], 1);
  assert.equal(hot.fired, true);
  assert.ok(hot.sum >= 1);
  const cold = perceptron([1, 0], [0.4, 0.4], 1);
  assert.equal(cold.fired, false);
  const mesh = brainMesh(["Tessera", "Alpha", "Beta"]);
  assert.equal(mesh.nodes.length, 80);
  assert.ok(mesh.edges.length > mesh.nodes.length);
  assert.equal(mesh.named, 3);
  assert.equal(mesh.nodes[0].name, "Tessera");
});
