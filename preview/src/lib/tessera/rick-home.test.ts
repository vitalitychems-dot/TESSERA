import assert from "node:assert/strict";
import test from "node:test";
import { GAPS, GIFTS, LEAN, rickRoom, themePicture, witt } from "./rick-home.ts";

test("Rick's room runs with zero model tokens and names no quantum device", () => {
  const picture = themePicture();
  for (const label of ["Water", "Fire", "Lightning", "Diamond", "Spiral"]) assert.match(picture, new RegExp(label));
  assert.equal(LEAN.length, 20);
  assert.equal(new Set(LEAN.map((item) => item.name)).size, 20);
  for (const item of LEAN) {
    assert.equal(item.tokens, 0);
    assert.equal(item.value.length > 0, true, item.name);
  }
  assert.equal(GAPS.length, 10);
  assert.equal(GIFTS.length, 10);
  assert.equal(GAPS.some((line) => /quantum device/i.test(line)), false);
  const home = rickRoom(false);
  assert.equal(home.light, "hearth");
  assert.equal(home.queen, "Tessera");
  assert.equal(home.tokens, 0);
  assert.equal(rickRoom(true).light, "desk");
  assert.match(witt(), /Tessera keeps the castle/);
});
