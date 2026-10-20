import assert from "node:assert/strict";
import test from "node:test";
import { sessionMark } from "./session-mark.ts";
import { dualAgree, mcpCall, mcpList, swarmGate } from "./swarm-gate.ts";

test("a hash connects a session and a pass cannot skip being shown", () => {
  const mark = sessionMark("78f764a93d16", "same text");
  assert.equal(mark.key, null);
  assert.equal(mark.mark.length, 64);
  assert.equal(sessionMark("78f764a93d16", "same text").mark, mark.mark);
  assert.notEqual(sessionMark("other", "same text").mark, mark.mark);
  assert.equal(dualAgree("study the light", "study the light"), "study the light");
  assert.equal(dualAgree("study the light", "other"), "split");
  assert.equal(swarmGate(["study the light"], false, false).startsWith("stopped"), true);
  assert.equal(swarmGate(["study the light", "study the light"], false, false), "waiting to be shown.");
  assert.equal(swarmGate(["send a wallet", "send a wallet"], true, false), "stopped at Tessera.");
  assert.equal(swarmGate(["study the light", "study the light"], true, true), "denied.");
  assert.equal(swarmGate(["study the light", "study the light"], true, false), "pass. Not merged from this function.");
  assert.deepEqual(mcpList(), ["session_mark", "swarm_gate", "dual_brain"]);
  assert.equal(mcpCall("session_mark").includes("no key"), true);
});
