import assert from "node:assert/strict";
import test from "node:test";
import { stepCivic } from "./civic.ts";

test("the city builds from the turn and a law needs her yes", () => {
  const first = stepCivic(0);
  const later = stepCivic(10);
  assert.equal(first.homes[0]?.built, 0);
  assert.ok((later.homes[0]?.built ?? 0) > (first.homes[0]?.built ?? 0));
  assert.equal(later.work, 50);
  assert.equal(first.passed, true);
  assert.equal(stepCivic(0).law, stepCivic(0).law);
  assert.equal(/camera|sparrow|wallet/i.test(JSON.stringify(first)), false);
});
