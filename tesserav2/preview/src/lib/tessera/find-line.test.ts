import assert from "node:assert/strict";
import test from "node:test";
import { findLines, pinLine } from "./find-line.ts";

test("search keeps eight matches and pin toggles", () => {
  const lines = Array.from({ length: 10 }, (_, i) => ({ content: i === 3 ? "wave-9 is on Gitbook" : `line ${i}` }));
  const hits = findLines(lines, "wave-9");
  assert.equal(hits.length, 1);
  assert.match(hits[0]?.content ?? "", /Gitbook/);
  assert.equal(findLines(lines, "line").length, 8);
  assert.equal(findLines(lines, "   ").length, 0);
  assert.equal(pinLine(null, "wave-9"), "wave-9");
  assert.equal(pinLine("wave-9", "wave-9"), null);
});
