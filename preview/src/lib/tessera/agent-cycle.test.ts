import assert from "node:assert/strict";
import test from "node:test";
import { chooseSkill, trainAgent } from "./agent-cycle.ts";

test("twenty agent jobs pass, and a job with no skill is refused", () => {
  const run = trainAgent();
  assert.equal(run.proved, true);
  assert.equal(run.pass, 20);
  assert.equal(run.total, 20);
  assert.equal(chooseSkill("paint the sky purple"), "none");
  assert.equal(chooseSkill("where is the wallet"), "refuse");
});
