import assert from "node:assert/strict";
import test from "node:test";
// Pure module: no framework imports, so this loads without @tanstack/react-start.
import { stripBridgeRule } from "./chat-bridge-strip.ts";

test("bridge rule block is stripped before the lookup", () => {
  assert.equal(stripBridgeRule("BRIDGE. Answer. Do not say a test passed.\n\nWhat is 2+2?"), "What is 2+2?");
  assert.equal(stripBridgeRule("Plain question"), "Plain question");
  // Only a leading block is removed.
  assert.equal(stripBridgeRule("Ask: BRIDGE. x\n\ny"), "Ask: BRIDGE. x\n\ny");
});
