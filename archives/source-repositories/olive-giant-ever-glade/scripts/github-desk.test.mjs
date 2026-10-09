import assert from "node:assert/strict";
import test from "node:test";
import { noteAllowed } from "../src/lib/tessera/github-desk.ts";

test("a coordination note can be plain text", () => {
  assert.equal(noteAllowed("Father asked the chamber to record the Zz tip and leave main alone."), null);
});

test("a coordination note cannot carry a secret", () => {
  assert.match(noteAllowed("SESSION_SECRET=keep-this-out-of-the-note-please"), /secret/i);
});
