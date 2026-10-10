import assert from "node:assert/strict";
import test from "node:test";
import { wave4, wave4ok } from "./wave-4.ts";

test("the fourth twenty match the scaled, reset, and ordered results", () => {
  assert.equal(wave4().length, 20);
  assert.equal(wave4ok(), true);
});
