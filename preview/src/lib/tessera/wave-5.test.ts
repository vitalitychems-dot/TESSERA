import assert from "node:assert/strict";
import test from "node:test";
import { wave5, wave5ok } from "./wave-5.ts";

test("the fifth twenty match the desk, the vote, and the store", () => {
  assert.equal(wave5().length, 20);
  assert.equal(wave5ok(), true);
});
