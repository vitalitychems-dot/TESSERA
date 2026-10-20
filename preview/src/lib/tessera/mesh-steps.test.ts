import assert from "node:assert/strict";
import test from "node:test";
import { admitPost, meshFromPatent, nextLivePort, tieLine, welcomePass } from "./mesh-steps.ts";
import { memoryPack } from "./one-flow.ts";

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
  const kept = memoryPack().find((row) => row.q === "US8665210B2");
  assert.match(kept?.a ?? "", /does not stimulate/);
  assert.match(meshFromPatent("stimulate the nerve"), /Not built/);
  assert.match(meshFromPatent("recognize a node"), /already carries/);
});
