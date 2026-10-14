import assert from "node:assert/strict";
import test from "node:test";
import { TWENTY, roomLine, roomScreen, wave1 } from "./wave-1.ts";

test("nineteen room names open eight screens and a missing name opens none", () => {
  const run = wave1();
  assert.equal(run.ok, true);
  assert.equal(run.count, 19);
  assert.equal(TWENTY.length, 19);
  for (const [id, screen] of TWENTY) assert.equal(roomScreen(id), screen);
  assert.equal(roomScreen("no-such-room"), "");
  assert.equal(roomLine("bible"), "No verse was opened in this pass.");
  assert.equal(new Set(TWENTY.map(([id]) => roomLine(id))).size, 19);
});
