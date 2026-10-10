import assert from "node:assert/strict";
import test from "node:test";
import { wave7, wave7ok } from "./wave-7.ts";

test("the seventh twenty match the second reward, the cap, and the blocked query", () => {
  assert.equal(wave7().length, 20);
  assert.equal(wave7ok(), true);
});
