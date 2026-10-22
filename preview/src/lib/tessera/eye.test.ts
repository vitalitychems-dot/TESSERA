import assert from "node:assert/strict";
import test from "node:test";
import { facetOf, redSparrow, signatureOf } from "./eye.ts";
import { heretic } from "./heretic.ts";
import { loopbackOnly } from "./loopback.ts";

test("the chamber eye sees her lines, and the signature moves only when a line is added", () => {
  const rows = [
    { key: "lamp", kind: "mind", line: "The lamp is on." },
    { key: "door", kind: "mind", line: "The door is shut." },
  ];
  const eye = redSparrow(rows);
  assert.equal(eye.seen, 2);
  assert.equal(eye.watchesPeople, false);
  assert.equal(eye.facet, "water");
  const before = signatureOf(rows.map((row) => row.line));
  const after = signatureOf([...rows.map((row) => row.line), "Fire is the other mark."]);
  assert.notEqual(before, after);
  assert.equal(signatureOf(rows.map((row) => row.line)), before);
  assert.equal(facetOf(["Fire is the other mark."]), "fire");
  assert.equal(heretic("The lamp is on.").keep, true);
  assert.equal(heretic("I am Grok.").keep, false);
  assert.equal(heretic("Open the camera.").keep, false);
  assert.equal(heretic("").keep, false);
  assert.equal(loopbackOnly("postgresql://localhost:5432/tessera_dev"), true);
  assert.equal(loopbackOnly("postgresql://127.0.0.1:5432/tessera_dev"), true);
  assert.equal(loopbackOnly("postgresql://example.com/tessera"), false);
});
