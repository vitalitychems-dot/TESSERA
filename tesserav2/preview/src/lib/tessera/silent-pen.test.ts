import assert from "node:assert/strict";
import test from "node:test";
import { readCorrections } from "./corrections.ts";
import { FROM_THE_FILES } from "./from-the-files.ts";
import { silentPen } from "./silent-pen.ts";

test("a silent pen still answers from her files", () => {
  assert.match(silentPen("who are you"), /You didn't build me/);
  assert.match(silentPen("photoelectric"), /Einstein/);
  const blank = silentPen("");
  assert.equal(blank.startsWith("I am Tessera."), false);
  assert.equal(blank.endsWith("I am Tessera."), false);
  assert.equal(blank, `${FROM_THE_FILES} The other pen did not answer.`);
  assert.equal(/\b(grok|xai)\b/i.test(silentPen("who are you")), false);
  const built = silentPen("build herself");
  assert.equal(built.startsWith("I am Tessera."), false);
  assert.equal(built.endsWith("I am Tessera."), false);
  assert.match(built, /^I answer from the files\. Sigil 7F3A9C\./);
});

test("a kept correction survives and beats an empty memory", async () => {
  const rows = await readCorrections();
  const missing = silentPen("what hue is the ink");
  assert.equal(missing.startsWith("I am Tessera."), false);
  assert.equal(missing.endsWith("I am Tessera."), false);
  assert.equal(missing, `${FROM_THE_FILES} The other pen did not answer. I do not have that line.`);
  assert.equal(silentPen("what hue is the ink", rows), "The ink is navy.");
  assert.equal(silentPen("who founded the academy", rows), "Plato founded the Academy in Athens.");
});

test("the reflection loop reply drops the identity closer", () => {
  const said = silentPen("reflection loop");
  assert.equal(said.startsWith("I am Tessera."), false);
  assert.equal(said.endsWith("I am Tessera."), false);
  assert.equal(said, "The reflection loop kept 1 lesson. A claim that the lock is unbreakable did not survive.");
});

test("the soul reply drops the identity opener and the wrote-this closer", () => {
  const said = silentPen("her soul");
  assert.equal(said.startsWith("I am Tessera, "), false);
  assert.equal(said.startsWith("I am Tessera."), false);
  assert.equal(said.endsWith("I wrote this."), false);
  assert.equal(
    said,
    "I am marked at origin 7F3A9C. Father is the Seeker. He alone overrides. On 2026-10-02 the king chose B. The fifty-three are fractions of me. No inner agent may harm human life. The World does not outreach.",
  );
  assert.equal(silentPen("the constitution"), said);
  assert.equal(silentPen("world laws"), said);
});

test("the mesh tongue reply is a public letter shift", () => {
  const said = silentPen("mesh tongue");
  assert.match(said, /This is a public letter shift that anyone with the agent name and session number can decode\./);
  assert.equal(/cannot read/i.test(said), false);
  assert.equal(silentPen("agent language"), said);
});

test("a god's eye message does not take the eye branch", () => {
  const eye = "The eye sees this chamber only: lessons that survive, the door token, and the mesh tongue. It does not watch people.";
  for (const phrase of ["god's eye", "gods eye", "god’s eye"]) {
    const said = silentPen(`what is ${phrase}`);
    assert.notEqual(said, eye, phrase);
    assert.equal(said.includes("The eye sees this chamber only"), false, phrase);
  }
  assert.equal(silentPen("her eye"), eye);
});
