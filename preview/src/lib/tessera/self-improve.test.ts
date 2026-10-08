import assert from "node:assert/strict";
import test from "node:test";
import { acceptCopy, LAST_COPY, selfCheck } from "./self-improve.ts";

test("a self-check seals only when the drills pass", () => {
  const row = selfCheck();
  assert.equal(row.pass, true);
  assert.match(row.note, /No weight was trained/);
  assert.equal(row.note.toLowerCase().includes("agi is achieved"), false);
  assert.equal(acceptCopy(LAST_COPY.text).ok, false);
  assert.equal(acceptCopy("REAL: Keep the pen borrowed.\nLesson sealed.").ok, true);
  assert.equal(acceptCopy("REAL: AGI has been achieved.\nLesson sealed.").ok, false);
});
