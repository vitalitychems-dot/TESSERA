import assert from "node:assert/strict";
import test from "node:test";
import { wave8, wave8ok } from "./wave-8.ts";

test("the eighth twenty match the desk tally, the cache, and the merge", () => {
  assert.equal(wave8().length, 20);
  assert.equal(wave8ok(), true);
});
