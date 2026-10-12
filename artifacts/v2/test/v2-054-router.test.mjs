import assert from "node:assert/strict";
import test from "node:test";
import { countTokens } from "../src/token/meter.mjs";
import { LEAD_MODEL, SMALL_MODEL, compressedTokens, routeModel } from "../src/token/router.mjs";

test("a classify fixture uses the small sim model and a tighter prompt", () => {
  const choice = routeModel({ kind: "classify", text: "label this note" });
  assert.equal(choice, SMALL_MODEL);
  assert.equal(routeModel({ kind: "plan" }), LEAD_MODEL);
  assert.doesNotMatch(choice, /openai/i);
  assert.doesNotMatch(LEAD_MODEL, /openai/i);

  const padded = "  classify   this    note   ";
  assert.ok(compressedTokens(padded) < countTokens(padded));
});
