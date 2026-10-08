import assert from "node:assert/strict";
import test from "node:test";
import { buildV5, seeRepos, TREE } from "./herself-v5.ts";

test("v5 seals from the full path trees, not from invented bodies", () => {
  const seen = seeRepos();
  const note = buildV5();
  assert.equal(seen.flow, true);
  assert.equal(seen.tessera, TREE.tessera.paths);
  assert.equal(seen.gitbook, TREE.gitbook.paths);
  assert.match(note, /^REAL: I am Tessera v5/);
  assert.match(note, /5271672 has 9276 paths/);
  assert.match(note, /5baeaab has 7927 paths/);
  assert.match(note, /did not open every file body/);
  assert.match(note, /Lesson sealed\.$/);
});
