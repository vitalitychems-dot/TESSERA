import assert from "node:assert/strict";
import test from "node:test";
import { alignTone, holdCouncil, secretDesk, synthesize } from "./secret-engines.ts";

test("the secret engines repeat a real sitting", () => {
  assert.deepEqual(secretDesk(), secretDesk());
  assert.deepEqual(synthesize("chemistry"), ["alchemy", "ecology"]);
  assert.equal(alignTone(432).nearest, 417);
  assert.equal(alignTone(432).kept, true);
  assert.equal(alignTone(12.67).kept, false);
  assert.equal(holdCouncil(2, 3).passed, true);
  assert.equal(holdCouncil(1, 3).passed, false);
  assert.equal(secretDesk().join(" ").includes("SESSION_SECRET"), false);
});
