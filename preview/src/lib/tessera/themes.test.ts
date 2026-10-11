import assert from "node:assert/strict";
import test from "node:test";
import { THEME_IDS, knownTheme } from "./themes.ts";

test("five themes are named and an unknown name is water", () => {
  assert.equal(THEME_IDS.length, 5);
  assert.equal(knownTheme("fire"), "fire");
  assert.equal(knownTheme("spiral"), "spiral");
  assert.equal(knownTheme("nope"), "water");
  assert.equal(knownTheme(""), "water");
});
