import assert from "node:assert/strict";
import test from "node:test";
import { cyclesImproved, EXTERNAL_TOOLS, runCycles, STANDARDS } from "./cycles.ts";

test("twenty cycles add local skills and do not claim AGI", () => {
  const rows = runCycles();
  assert.equal(cyclesImproved(rows), true);
  assert.equal(rows[0].localBefore, 0);
  assert.equal(rows[19].localAfter, 20);
  assert.equal(rows[19].external, EXTERNAL_TOOLS.length);
  assert.ok(rows[19].share > rows[0].share);
  assert.ok(rows[19].share < 1);
  assert.equal(STANDARDS.agi.some((item) => item.met), false);
  assert.equal(rows.some((row) => row.detail.toLowerCase().includes("session_secret")), false);
});
