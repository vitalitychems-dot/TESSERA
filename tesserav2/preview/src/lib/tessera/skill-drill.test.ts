import assert from "node:assert/strict";
import test from "node:test";
import { skillDrill } from "./skill-drill.ts";

test("she runs the follow-ups without being asked", () => {
  const run = skillDrill();
  assert.equal(run.ok, true);
  assert.equal(run.lines[0], "There is no last skill.");
  assert.equal(run.lines[1], "alpha, zeta");
  assert.equal(run.lines[2], "alpha, beta, zeta");
  assert.equal(run.lines[3], "sort zeta, alpha, beta");
  assert.match(run.lines[4] ?? "", /Our Lady of Fátima is a title\./);
  assert.equal(run.lines[5], "help stays help");
});
