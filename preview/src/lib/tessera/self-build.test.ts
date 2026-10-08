import assert from "node:assert/strict";
import test from "node:test";
import { buildSelf, systems } from "./self-build.ts";

test("every system has knowledge and a next build, and a passage is quoted whole", () => {
  const rows = systems();
  assert.equal(rows.length, 12);
  assert.ok(rows.every((row) => row.holds.length > 8 && row.next.length > 8));
  const plan = buildSelf("build yourself");
  assert.equal(plan.split("\n").length, 12);
  assert.equal(/weight/i.test(plan), false);
  assert.match(plan, /Do not invent the pages/);
  const plato = buildSelf("Plato");
  assert.match(plato, /founder of the Academy/);
  assert.match(plato, /Do not lengthen it/);
});
