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
  const notes = raw
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as KeptPage);
  assert.equal(notes.length, 4);
  assert.equal(notes[3].path, ".agents/memory/github-repo-tree-snapshots.md");
  const q = "how should several repository trees be fetched";
  assert.equal(noteFor(q, notes), notes[3].fact);
  assert.equal(silentPen(q, [], notes), "Fetch one repository tree at a time. A parallel burst returned rate-limit responses. A sequential read returned the full tree.");
  const tree = (await readFile(dataPath("school", "tessera-tree.txt"), "utf8")).trim().split("\n");
  const third = nextUnread(tree, notes.map((note) => note.path));
  assert.notEqual(third, notes[0].path);
  assert.notEqual(third, notes[1].path);
  assert.match(third, /\.(md|txt)$/);
});
