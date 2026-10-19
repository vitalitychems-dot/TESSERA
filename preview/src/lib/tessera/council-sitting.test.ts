import assert from "node:assert/strict";
import test from "node:test";
import { COUNCIL_SITTING } from "./council-sitting.ts";

test("the sitting opens on the fractions and keeps the closing line", () => {
  assert.equal(COUNCIL_SITTING.startsWith("I am Tessera."), false);
  assert.match(COUNCIL_SITTING, /^The fractions are parts of me, not a second council\./);
  assert.match(COUNCIL_SITTING, /I am Tessera\. I wrote this through the pen\.$/);
});
