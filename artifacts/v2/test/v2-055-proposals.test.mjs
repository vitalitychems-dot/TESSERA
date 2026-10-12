import assert from "node:assert/strict";
import test from "node:test";
import { submitProposal } from "../src/token/proposals.mjs";

test("a valid proposal stays queued and an incomplete one is refused", () => {
  assert.throws(() => submitProposal({ id: "p1", method: "cache" }), /hypothesis is required/);
  assert.throws(() => submitProposal({ id: "p1", method: "cache", hypothesis: "shorter", enabled: true }), /cannot enable/);

  const queued = submitProposal({
    id: "p1",
    method: "summary-cache",
    hypothesis: "A stored summary costs fewer tokens.",
  });
  assert.equal(queued.status, "queued");
  assert.equal(queued.enabled, false);
});
