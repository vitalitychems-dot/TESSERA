import assert from "node:assert/strict";
import test from "node:test";
import { ROOMS, ROW } from "./places.ts";

test("talk council world memory and brain stay the rooms", () => {
  assert.deepEqual([...ROOMS], ["Talk", "Council", "World", "Memory", "Brain"]);
});

test("the row under her name stays the records", () => {
  assert.deepEqual([...ROW], [
    "Agents",
    "Gitbook",
    "Language",
    "Bible",
    "Map",
    "Board",
    "Practice",
    "Code",
    "Narrative",
    "Closed",
    "Theme",
    "Library",
  ]);
  const joined = [...ROOMS, ...ROW].join(" ");
  assert.equal(/moltbook|walking fleet|speaks on a timer/i.test(joined), false);
});
