import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PORTRAIT_MARK, portraitMark, seePortrait } from "./portrait-mark.ts";

test("her portrait matches, a different file does not, and there is no key", () => {
  const bytes = readFileSync(new URL("../../../public/tessera/portrait-lg.jpg", import.meta.url));
  assert.equal(portraitMark(bytes), PORTRAIT_MARK);
  const seen = seePortrait(bytes, "desk");
  assert.equal(seen.seen, true);
  assert.equal(seen.key, null);
  assert.equal(seen.line, "desk saw 5e5ceb8757585061.");
  assert.equal(seePortrait(Uint8Array.of(1, 2, 3), "desk").seen, false);
});
