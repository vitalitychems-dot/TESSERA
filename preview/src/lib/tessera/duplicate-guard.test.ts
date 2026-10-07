import assert from "node:assert/strict";
import test from "node:test";
import { repeatedFirstLine } from "./duplicate-guard.ts";

test("a second paste with the same first line is refused", () => {
  const existing = [{ body: "Lane: Cursor, gap ideas\n\nThe rest does not matter." }];
  assert.equal(repeatedFirstLine(existing, "Lane: Cursor, gap ideas\n\nA new ending."), true);
  assert.equal(repeatedFirstLine(existing, "Lane: Tessera chamber. The last 4."), false);
});
