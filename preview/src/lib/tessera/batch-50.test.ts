import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG } from "./catalog-pass.ts";
import { batch50, selector, sequence } from "./batch-50.ts";

test("fifty catalog repos were read and the behavior tree step runs", () => {
  const rows = batch50();
  assert.equal(rows.length, 50);
  const names = new Set(CATALOG.map((row) => row.name));
  for (const row of rows) {
    assert.equal(names.has(row.repo), true);
    assert.equal(typeof row.moved, "boolean");
    assert.equal(typeof row.lang, "string");
    assert.equal(row.kb > 0, true);
  }
  assert.equal(sequence([true, false, true]), false);
  assert.equal(sequence([true, true]), true);
  assert.equal(sequence([]), true);
  assert.equal(selector([false, true, false]), true);
  assert.equal(selector([false, false]), false);
  assert.equal(selector([]), false);
  const tree = rows.find((row) => row.repo === "Calamari/BehaviorTree.js");
  assert.ok(tree);
  assert.match(tree.description, /Behavior Trees/);
});
