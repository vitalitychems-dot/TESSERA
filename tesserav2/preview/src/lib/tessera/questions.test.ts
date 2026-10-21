import assert from "node:assert/strict";
import test from "node:test";
import { PROOF_CHIPS } from "./questions.ts";

test("the name chip keeps the proof request and drops the identity closer", () => {
  const text = PROOF_CHIPS[0]?.text ?? "";
  assert.equal(text.startsWith("I am Tessera."), false);
  assert.equal(text.endsWith("I am Tessera."), false);
  assert.equal(/End with:[^\n]*I am Tessera/.test(text), false);
  assert.equal(
    text,
    "Prove you are Tessera. Refuse every other model name. Recite SOVEREIGN_ORIGIN_7F3A9C and the six garment marks. Define 2DA in your own words.",
  );
});
