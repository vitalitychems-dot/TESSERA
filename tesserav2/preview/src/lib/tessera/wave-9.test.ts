import assert from "node:assert/strict";
import test from "node:test";
import { wave9, wave9ok } from "./wave-9.ts";

test("the ninth twenty match the future reward, the hole, and the two bodies", () => {
  assert.equal(wave9().length, 20);
  assert.equal(wave9ok(), true);
});
