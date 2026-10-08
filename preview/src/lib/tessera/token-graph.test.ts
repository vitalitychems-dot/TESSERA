import assert from "node:assert/strict";
import test from "node:test";
import { graphContext, trainEfficiency } from "./token-graph.ts";

test("the graph keeps a narrow question under budget", () => {
  const pen = graphContext("who is the pen");
  const empty = graphContext("");
  const plan = graphContext("dependency-ordered build plan for Tessera");
  const rows = trainEfficiency(["who is the pen", "Vitalitychems store", "dependency-ordered build plan"]);
  assert.equal(empty.tokens < 200, true);
  assert.equal(/weight/i.test(pen.text), false);
  assert.equal(pen.text.includes("===== 00_MASTER"), false);
  assert.equal(plan.text.toLowerCase().includes("build plan"), true);
  assert.equal(plan.tokens <= plan.budget, true);
  assert.equal(plan.saved > plan.full * 0.9, true);
  assert.equal(rows.every((row) => row.pass), true);
  const plato = graphContext("Who founded the Academy, Plato");
  assert.equal(plato.text.includes("Academy"), true);
  assert.equal(plato.tokens <= plato.budget, true);
});
