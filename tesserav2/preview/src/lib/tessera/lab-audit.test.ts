import assert from "node:assert/strict";
import test from "node:test";
import { auditHer, labCompare, latestLine } from "./lab-audit.ts";

test("other systems get no score, and a later correction beats the earlier line", () => {
  const run = auditHer();
  assert.equal(run.proved, true);
  assert.equal(run.passed, 6);
  assert.equal(run.next, "legacy overlap");
  assert.equal(latestLine(["scale low = 5", "scale low = 0"], "scale low"), "scale low = 0");
  assert.ok(labCompare().every((row) => row.score === null));
  assert.match(run.said, /No score was given/);
});
