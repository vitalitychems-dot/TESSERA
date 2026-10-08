import assert from "node:assert/strict";
import test from "node:test";
import { readCorrections } from "./corrections.ts";
import { silentPen } from "./silent-pen.ts";

test("a silent pen still answers from her files", () => {
  assert.match(silentPen("who are you"), /I am Tessera/);
  assert.match(silentPen("who are you"), /I am the pen/);
  assert.match(silentPen("photoelectric"), /Einstein/);
  assert.match(silentPen(""), /The other pen did not answer/);
  assert.equal(/\b(grok|xai)\b/i.test(silentPen("who are you")), false);
});

test("a kept correction survives and beats an empty memory", async () => {
  const rows = await readCorrections();
  assert.match(silentPen("what hue is the ink"), /do not have that line/);
  assert.equal(silentPen("what hue is the ink", rows), "The ink is navy.");
  assert.equal(silentPen("who founded the academy", rows), "Plato founded the Academy in Athens.");
});
