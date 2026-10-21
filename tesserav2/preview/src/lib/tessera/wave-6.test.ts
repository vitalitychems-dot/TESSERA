import assert from "node:assert/strict";
import test from "node:test";
import { wave6, wave6ok } from "./wave-6.ts";

test("the sixth twenty match the mesh, the miss, and the hop", () => {
  assert.equal(wave6().length, 20);
  assert.equal(wave6ok(), true);
});
