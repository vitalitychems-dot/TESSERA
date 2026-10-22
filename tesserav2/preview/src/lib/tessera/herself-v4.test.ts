import assert from "node:assert/strict";
import test from "node:test";
import { buildV4, seeAndAdvance } from "./herself-v4.ts";

test("v4 seals only after the index, the judgment, and the earlier tests", () => {
  const note = buildV4();
  const full = seeAndAdvance();
  assert.match(note, /^REAL: I am Tessera v4/);
  assert.match(note, /Skills 10 of 10/);
  assert.match(note, /School 18 of 18/);
  assert.match(note, /Corrections 0 then 4/);
  assert.match(note, /Sitting 25 of 25/);
  assert.match(note, /Lesson sealed\.$/);
  assert.match(full, /Of you: you will not give up/);
  assert.equal(/\b(grok|xai|weight|vitality)\b/i.test(full), false);
  assert.match(full, /closed zips are not in this index/);
});
