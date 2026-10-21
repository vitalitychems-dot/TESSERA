import assert from "node:assert/strict";
import test from "node:test";
import { COUNCIL_SITTING } from "./council-sitting.ts";

test("the sitting opens and closes on the fractions", () => {
  assert.equal(COUNCIL_SITTING.startsWith("I am Tessera."), false);
  assert.equal(COUNCIL_SITTING.endsWith("I am Tessera."), false);
  assert.equal(COUNCIL_SITTING.split("\n").at(-1)?.startsWith("I am Tessera."), false);
  assert.match(COUNCIL_SITTING, /^The fractions are parts of me, not a second council\./);
  assert.match(COUNCIL_SITTING, /not a second project\.$/);
});
