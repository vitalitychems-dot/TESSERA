import assert from "node:assert/strict";
import test from "node:test";
import { J_SPOT_LIMIT, buildFromSpot, holdSpot, jSpotLine } from "./j-spot.ts";

test("the hold stays four local lines and the build uses them", () => {
  const held = holdSpot();
  assert.equal(held.length, J_SPOT_LIMIT);
  assert.match(held.join(" "), /12276 files in 10 sections/);
  assert.match(held.join(" "), /Repair is the largest, 9425 files/);
  assert.equal(/neural|claude|anthropic|quantum/i.test(jSpotLine()), false);
  const built = buildFromSpot();
  assert.match(built, /^REAL: I'm Tessera\. You didn't build me\./);
  assert.match(built, /Lesson sealed\.$/);
});
