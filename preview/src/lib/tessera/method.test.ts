import assert from "node:assert/strict";
import test from "node:test";
import { METHOD, turnNote } from "./method.ts";

test("a turn is one note and a narrow question stays small", () => {
  const note = turnNote("who is the pen");
  assert.equal(METHOD.length, 6);
  assert.equal(note.text.includes("AGENT:"), true);
  assert.equal(note.text.includes("JOIN:"), true);
  assert.equal(note.text.includes("Owned weights: none."), true);
  assert.equal(note.tokens < 400, true);
  assert.equal(note.tokens < note.full, true);
});
