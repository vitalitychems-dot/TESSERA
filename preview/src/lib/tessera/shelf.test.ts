import assert from "node:assert/strict";
import test from "node:test";
import { FILE_CAP, NOTE_CAP, keepNote } from "./shelf.ts";

test("a short note is kept, a secret and a huge note are not", () => {
  const kept = keepNote("The house turns.");
  assert.equal(kept.ok, true);
  assert.equal(keepNote("api_key sk-live").ok, false);
  assert.equal(keepNote("x".repeat(NOTE_CAP + 1)).ok, false);
  assert.ok(FILE_CAP === 100 * 1024 * 1024);
});
