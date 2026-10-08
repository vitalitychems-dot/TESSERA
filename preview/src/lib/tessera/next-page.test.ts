import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { dataPath } from "./data-path.ts";
import { herInstruction, nextBatch, nextUnread, noteFor, type KeptPage } from "./next-page.ts";
import { silentPen } from "./silent-pen.ts";

test("one pass keeps more than one page and the next path is new", async () => {
  const toy = ["a.png", "one.md", "two.md", "three.md", "secret.env"];
  const batch = nextBatch(toy, [], 3);
  assert.deepEqual(batch, ["one.md", "two.md", "three.md"]);
  assert.equal(batch.length > 1, true);
  const raw = await readFile(dataPath("school", "read-one.jsonl"), "utf8");
  const notes = raw
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as KeptPage);
  const before = 5;
  assert.equal(notes.length, 10);
  assert.equal(notes.length - before > 1, true);
  const q = "was an outside app run";
  assert.equal(noteFor(q, notes), notes[9].fact);
  assert.equal(silentPen(q, [], notes), "A run on that page takes an app name and an input file. No app was run.");
  const tree = (await readFile(dataPath("school", "tessera-tree.txt"), "utf8")).trim().split("\n");
  const after = nextUnread(
    tree,
    notes.map((note) => note.path),
  );
  assert.equal(
    notes.some((note) => note.path === after),
    false,
  );
  assert.match(after, /\.(md|txt)$/);
  const told = herInstruction(before, notes.length);
  assert.match(told, /from 5 to 10/);
  assert.match(told, /more than one unread text page/);
  assert.match(told, /Do not fetch trees in parallel/);
});
