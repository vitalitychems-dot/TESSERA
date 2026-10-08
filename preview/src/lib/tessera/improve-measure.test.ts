import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { measureGains } from "./improve-measure.ts";
import type { RecallRow } from "./recall-all.ts";

test("the quiz rises only after a real matcher change", () => {
  const rows = readFileSync("data/school/recall-index.jsonl", "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RecallRow);
  const gains = measureGains(rows);
  assert.ok(gains[1].score > gains[0].score);
  assert.ok(gains[2].score > gains[1].score);
  assert.equal(gains[2].score, 12);
});
