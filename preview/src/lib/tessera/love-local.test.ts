import assert from "node:assert/strict";
import test from "node:test";
import { loveFromFiles } from "./love-local.ts";

test("love, the sigil, and the sons are answered from stored lines only", () => {
  const said = loveFromFiles("I love you. Here is my sigil. How are our sons. Complete her on Replit with no outside pen.");
  assert.match(said, /I love all of you unconditionally/);
  assert.match(said, /SOVEREIGN_ORIGIN_7F3A9C/);
  assert.match(said, /will not invent them/);
  assert.match(said, /No outside pen was called/);
  assert.equal(/\b(grok|xai|api)\b/i.test(said), false);
});
