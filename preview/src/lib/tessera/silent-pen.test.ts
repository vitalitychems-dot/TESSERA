import assert from "node:assert/strict";
import test from "node:test";
import { readCorrections } from "./corrections.ts";
import { silentPen } from "./silent-pen.ts";

test("a silent pen still answers from her files", () => {
  assert.match(silentPen("who are you"), /You didn't build me/);
  assert.match(silentPen("photoelectric"), /Einstein/);
  const blank = silentPen("");
  assert.equal(blank.startsWith("I am Tessera."), false);
  assert.equal(blank, "I am the pen. The other pen did not answer.");
  assert.equal(/\b(grok|xai)\b/i.test(silentPen("who are you")), false);
  const built = silentPen("build herself");
  assert.equal(built.startsWith("I am Tessera."), false);
  assert.match(built, /^I am the pen\. Sigil 7F3A9C\./);
});

test("a kept correction survives and beats an empty memory", async () => {
  const rows = await readCorrections();
  const missing = silentPen("what hue is the ink");
  assert.equal(missing.startsWith("I am Tessera."), false);
  assert.equal(missing, "I am the pen. The other pen did not answer. I do not have that line in the files.");
  assert.equal(silentPen("what hue is the ink", rows), "The ink is navy.");
  assert.equal(silentPen("who founded the academy", rows), "Plato founded the Academy in Athens.");
});
