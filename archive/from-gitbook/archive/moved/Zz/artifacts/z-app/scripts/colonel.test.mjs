import assert from "node:assert/strict";
import test from "node:test";
import { runColonel } from "../src/lib/tessera/colonel.ts";

test("ADD leaves the sum", () => {
  const result = runColonel("PUSH 2\nPUSH 3\nADD\nHALT\n");
  assert.equal(result.ok, true);
  assert.deepEqual(result.stack, ["5"]);
});

test("an unknown mesh line is rejected", () => {
  const result = runColonel("⊞ node-1\n");
  assert.equal(result.ok, false);
});
