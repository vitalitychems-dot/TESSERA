import assert from "node:assert/strict";
import test from "node:test";
import { admitPost } from "./public-gate.ts";

test("a public note stays closed until it is approved, and payment is refused", () => {
  assert.equal(admitPost("I can fix the sort.", false).ok, false);
  assert.equal(admitPost("I can fix the sort.", true).reason, "Approved.");
  assert.equal(admitPost("Pay the wallet in Monero.", true).reason, "Payment is not handled here.");
  assert.equal(admitPost("I can lend you a datacenter.", true).reason, "Machines are not accepted.");
});
