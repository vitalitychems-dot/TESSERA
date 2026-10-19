import assert from "node:assert/strict";
import test from "node:test";
import { admitPost, nextLivePort, tieLine, welcomePass } from "./mesh-steps.ts";

test("the mesh files run the same checks", () => {
  assert.equal(admitPost("I can fix the sort.", false).ok, false);
  assert.equal(admitPost("I can fix the sort.", true).ok, true);
  assert.equal(admitPost("Pay the wallet in Monero.", true).ok, false);
  assert.equal(admitPost("I can lend you a datacenter.", true).reason, "Machines are not accepted.");
  assert.match(welcomePass("Ada", "to study the light"), /^gitbookai\tgit\tneedsWeb false\tAda\t[0-9a-f]+$/);
  assert.equal(welcomePass("Ada", "a secret"), "Not welcomed.");
  assert.equal(tieLine(false), "Not approved.");
  assert.equal(tieLine(true), "git\tpaired true");
  assert.equal(nextLivePort(8791, (port) => port === 8791), 8792);
  assert.equal(nextLivePort(8791, () => true), null);
});
