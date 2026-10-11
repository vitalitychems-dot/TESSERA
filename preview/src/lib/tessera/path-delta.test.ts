import assert from "node:assert/strict";
import test from "node:test";
import { AFTER_COPY } from "./forty.ts";
import { PATHS as GITBOOK_PATHS } from "./gitbook-paths.ts";
import { deltaLine, pathDelta, pathList } from "./path-delta.ts";
import { tokenReport } from "./token-index.ts";

test("the copy can be compared and a spaced search is split by repo", () => {
  const held = pathList("a.md\nb.md\n");
  const live = pathList("b.md\nc.md\nc.md\n");
  const delta = pathDelta(held, live);
  assert.deepEqual(delta.added, ["c.md"]);
  assert.deepEqual(delta.removed, ["a.md"]);
  assert.equal(delta.held, 2);
  assert.equal(delta.live, 2);
  assert.match(deltaLine("Gitbook", delta), /1 added/);
  assert.match(deltaLine("Gitbook", delta), /I did not open the bodies/);
  const notes = pathDelta(pathList(GITBOOK_PATHS), [...pathList(GITBOOK_PATHS), ...AFTER_COPY]);
  assert.deepEqual(notes.added, [...AFTER_COPY]);
  assert.equal(notes.removed.length, 0);
  const spaced = tokenReport("wave 9");
  assert.equal(spaced.hits.some((line) => line.includes("review/wave-9.md")), true);
  assert.equal(spaced.tesseraLeft + spaced.gitbookLeft, spaced.left);
});
