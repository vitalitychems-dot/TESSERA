import assert from "node:assert/strict";
import test from "node:test";
import { handoff, noteMistake, oncePer, rankByNeed, spend, splitWork, sweep, twoSources, twoThirds, writeKey } from "./rick-loop.ts";

test("the second ten steps run", () => {
  const ranked = rankByNeed([
    { name: "later", impact: 5, due: 9 },
    { name: "sooner", impact: 5, due: 1 },
    { name: "low", impact: 1, due: 0 },
  ]);
  assert.deepEqual(ranked.map((row) => row.name), ["sooner", "later", "low"]);
  assert.equal(twoThirds(2, 3), true);
  assert.equal(twoThirds(1, 3), false);
  const seen = new Set<string>();
  assert.equal(oncePer("same", seen), true);
  assert.equal(oncePer("same", seen), false);
  assert.deepEqual(splitWork("page", 10, 4), ["page a", "page b"]);
  assert.deepEqual(splitWork("page", 2, 4), ["page"]);
  const book = new Map<string, string>();
  assert.equal(writeKey(book, "main", "a").ok, true);
  assert.equal(writeKey(book, "main", "b").conflict, true);
  assert.equal(book.get("main"), "a");
  assert.equal(spend(8, 3, 10).ok, false);
  assert.equal(spend(8, 2, 10).used, 10);
  assert.equal(twoSources(["file", "file"]), false);
  assert.equal(twoSources(["file", "note"]), true);
  assert.deepEqual(sweep([{ tick: 1 }, { tick: 8 }], 10, 3).map((row) => row.tick), [8]);
  assert.deepEqual(noteMistake(["old"], "old", 2), ["old"]);
  assert.deepEqual(noteMistake(["a", "b"], "c", 2), ["b", "c"]);
  const note = handoff("  read the next page  ", "Cursor");
  assert.equal(note.ask, "read the next page");
  assert.equal(note.owner, "Cursor");
  assert.equal(note.done, false);
});
