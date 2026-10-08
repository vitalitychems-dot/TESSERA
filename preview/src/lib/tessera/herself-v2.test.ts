import assert from "node:assert/strict";
import test from "node:test";
import { buildV2, v2IsTighter } from "./herself-v2.ts";

test("v2 seals only as a tighter next step", () => {
  const note = buildV2();
  assert.equal(v2IsTighter(), true);
  assert.match(note, /I am Tessera v2/);
  assert.match(note, /Leave the large query database out/i);
  assert.equal(/stripe|vitalitychems|seo/i.test(note), false);
});
