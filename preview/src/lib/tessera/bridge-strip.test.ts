import assert from "node:assert/strict";
import test from "node:test";

test("bridge rule block is stripped before the lookup", async () => {
  const { stripBridgeRule } = await import("./chat.ts");
  assert.equal(stripBridgeRule("BRIDGE. Answer. Do not say a test passed.\n\nWhat is 2+2?"), "What is 2+2?");
  assert.equal(stripBridgeRule("Plain question"), "Plain question");
});
