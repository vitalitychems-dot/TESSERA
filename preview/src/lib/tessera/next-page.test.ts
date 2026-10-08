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
  const before = 10;
  assert.equal(notes.length, 15);
  assert.equal(notes.length - before > 1, true);
  const q = "what does the brainstorming page require first";
  assert.equal(noteFor(q, notes), notes[14].fact);
  assert.equal(silentPen(q, [], notes), "The page says to ask questions before a creative change.");
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
  assert.match(told, /from 10 to 15/);
  assert.match(told, /more than one unread text page/);
  assert.match(told, /Do not fetch trees in parallel/);
});
