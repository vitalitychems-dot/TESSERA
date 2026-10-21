import assert from "node:assert/strict";
import test from "node:test";
import { wave2, wave2ok } from "./wave-2.ts";

test("the second twenty match the function results", () => {
  assert.equal(wave2().length, 20);
  assert.equal(wave2ok(), true);
});
