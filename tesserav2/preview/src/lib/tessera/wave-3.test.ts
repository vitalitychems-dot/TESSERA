import assert from "node:assert/strict";
import test from "node:test";
import { wave3, wave3ok } from "./wave-3.ts";

test("the third twenty match the counted ledger and the refusals", () => {
  assert.equal(wave3().length, 20);
  assert.equal(wave3ok(), true);
});
