import assert from "node:assert/strict";
import test from "node:test";
import { gitbookNote } from "./gitbook-note.ts";

test("a gitbook note is shortened and a secret is withheld", () => {
  assert.equal(gitbookNote("  The hall is open.  "), "The hall is open.");
  assert.match(gitbookNote("key sk-abcdefghijklmnopqrstuvwxyz"), /\[withheld\]/);
  assert.equal(gitbookNote("x".repeat(400)).length, 280);
});
