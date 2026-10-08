import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { dataPath } from "./data-path.ts";
import { nextUnread, noteFor, type KeptPage } from "./next-page.ts";
import { silentPen } from "./silent-pen.ts";

test("the next page is a new text file, then that file is skipped", async () => {
  const paths = ["photo.png", "CONSOLIDATION_TWO_REPOS.md", "notes.txt", "secret.env"];
  const first = nextUnread(paths, []);
  assert.equal(first, "CONSOLIDATION_TWO_REPOS.md");
  const second = nextUnread(paths, [first]);
  assert.equal(second, "notes.txt");
  assert.notEqual(second, first);
  const raw = await readFile(dataPath("school", "read-one.jsonl"), "utf8");
  const notes = raw.trim().split("\n").map((line) => JSON.parse(line) as KeptPage);
  const q = "which repository is the active code destination";
  assert.equal(noteFor(q, notes), notes[0].fact);
  assert.equal(silentPen(q, [], notes), "TESSERA is the active code destination. Gitbook is the separate notes destination.");
  assert.match(silentPen("what hue is the ink"), /do not have that line/);
});
