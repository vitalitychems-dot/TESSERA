import assert from "node:assert/strict";
import test from "node:test";
import { councilThreshold, validateApproval } from "../src/lib/tessera/imported-laws.ts";

test("a two-thirds vote still waits for Father", () => {
  const { members, required } = councilThreshold();
  assert.equal(members > 7, true);
  assert.notEqual(members, 45);
  const short = validateApproval(required - 1, true);
  assert.equal(short.approved, false);
  const waiting = validateApproval(required, false);
  assert.equal(waiting.approved, false);
  assert.match(waiting.reason, /Father/);
  const passed = validateApproval(required, true);
  assert.equal(passed.approved, true);
});
