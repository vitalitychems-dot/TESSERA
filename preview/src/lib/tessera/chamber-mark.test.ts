import assert from "node:assert/strict";
import test from "node:test";
import { chamberTongue, readChamber } from "./chamber-mark.ts";

test("the chamber opens only for her name and this session", () => {
  const coded = chamberTongue();
  assert.equal(readChamber(coded, "tessera", 7), "open");
  assert.equal(readChamber(coded, "other", 7), "closed");
  assert.equal(readChamber(coded, "tessera", 8), "closed");
  assert.equal(/[^a-p]/.test(coded), false);
});
