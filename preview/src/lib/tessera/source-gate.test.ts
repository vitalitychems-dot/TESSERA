import assert from "node:assert/strict";
import test from "node:test";
import { sourceGate } from "./source-gate.ts";

test("the source gate has three states and no catalog", () => {
  assert.equal(sourceGate({ isPending: true, hasUser: true }), "pending");
  assert.equal(sourceGate({ isPending: false, hasUser: true }), "signed_in");
  assert.equal(sourceGate({ isPending: false, hasUser: false }), "signed_out");
});
