import assert from "node:assert/strict";
import test from "node:test";
import { buildV3, v3MovesPastV2 } from "./herself-v3.ts";

test("v3 seals only after the database stays a gap", () => {
  const note = buildV3();
  assert.equal(v3MovesPastV2(), true);
  assert.match(note, /I am Tessera v3/);
  assert.match(note, /did not open it/);
  assert.equal(/stripe|vitalitychems|seo/i.test(note), false);
});
