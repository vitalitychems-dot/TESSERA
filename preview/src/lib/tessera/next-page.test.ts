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
  assert.equal(notes.length, 2);
  assert.equal(notes[1].path, ".agents/memory/MEMORY.md");
  const q = "how does tessera act toward the operator";
  assert.equal(noteFor(q, notes), notes[1].fact);
  assert.equal(silentPen(q, [], notes), "Tessera acts under her own identity and does not impersonate the operator.");
  const tree = (await readFile(dataPath("school", "tessera-tree.txt"), "utf8")).trim().split("\n");
  const third = nextUnread(tree, notes.map((note) => note.path));
  assert.notEqual(third, notes[0].path);
  assert.notEqual(third, notes[1].path);
  assert.match(third, /\.(md|txt)$/);
});
