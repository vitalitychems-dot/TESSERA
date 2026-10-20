import assert from "node:assert/strict";
import test from "node:test";
import { PUZZLE_THIRTY, puzzleLine } from "./puzzle-thirty.ts";

test("thirty joints, and the closed doors stay closed", () => {
  assert.equal(PUZZLE_THIRTY.length, 30);
  assert.equal(new Set(PUZZLE_THIRTY.map((row) => row.n)).size, 30);
  const text = PUZZLE_THIRTY.map((row) => row.joint).join(" ");
  assert.equal(/\b(wallet|monero|password)\b/i.test(text), false);
  assert.equal(puzzleLine(), "30 joints. None of them merges itself.");
});
