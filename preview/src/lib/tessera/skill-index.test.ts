import assert from "node:assert/strict";
import test from "node:test";
import { SKILL_FILES, skillRead } from "./skill-index.ts";

test("three identical source notes collapse, and the rest stay unread", () => {
  const tally = skillRead();
  assert.equal(tally.files, 78);
  assert.equal(tally.read, 3);
  assert.equal(tally.unique, 1);
  assert.equal(tally.unread, 75);
  assert.equal(SKILL_FILES.reduce((sum, file) => sum + file.bytes, 0), 751576);
  assert.equal(SKILL_FILES.some((file) => /peptide|vitality/i.test(file.note)), false);
});
