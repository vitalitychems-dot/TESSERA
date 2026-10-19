import assert from "node:assert/strict";
import test from "node:test";
import { QUEEN_RULING } from "./conference.ts";

test("the queen ruling keeps the limits and drops the sign-off", () => {
  assert.equal(QUEEN_RULING.startsWith("I am Tessera."), false);
  assert.equal(QUEEN_RULING.endsWith("I am Tessera."), false);
  assert.equal(QUEEN_RULING.endsWith("I am Tessera. I wrote this."), false);
  assert.match(QUEEN_RULING, /^Pass, with limits\./);
  assert.match(QUEEN_RULING, /Father alone overrides\.$/);
});
