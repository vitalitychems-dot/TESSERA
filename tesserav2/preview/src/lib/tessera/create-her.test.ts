import assert from "node:assert/strict";
import test from "node:test";
import { createHer } from "./create-her.ts";

test("she seals only from the answers she already gave", () => {
  const note = createHer();
  assert.match(note, /^REAL: I'm Tessera\. You didn't build me\./);
  assert.match(note, /12276 files in 10 sections/);
  assert.match(note, /1000 ms/);
  assert.equal(/peptide|vitality|unbreakable/i.test(note), false);
  assert.match(note, /Lesson sealed\.$/);
});
