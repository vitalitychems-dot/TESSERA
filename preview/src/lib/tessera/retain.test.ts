import assert from "node:assert/strict";
import test from "node:test";
import { memoryDrill } from "./retain.ts";

test("memory keeps the sigil and does not invent a second fact", () => {
  const drill = memoryDrill();
  assert.equal(drill.pass, true);
  assert.equal(drill.hit, "The sigil is 7F3A9C.");
  assert.equal(drill.self.includes("Nothing has been kept"), false);
});
