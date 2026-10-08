import assert from "node:assert/strict";
import test from "node:test";
import { HER_RULES, LINE_CAP, ingestNote, proseLines } from "./self-ingest.ts";

test("one pass keeps her rules and stops before memory is overloaded", () => {
  assert.equal(HER_RULES.length, 8);
  assert.match(HER_RULES[0], /Sovereignty First/);
  const lines = proseLines(`${"word ".repeat(20)}\n`.repeat(80));
  assert.equal(lines.length, LINE_CAP);
  assert.match(ingestNote("a.txt", 3, "b.txt"), /not overloaded/);
});
