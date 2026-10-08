import assert from "node:assert/strict";
import test from "node:test";
import { fromTheRead } from "./read-work.ts";
import { FEED_PASSES, STUDIES_MISSING } from "./studies.ts";

test("ten feeds are remembered and the missing files stay missing", () => {
  assert.equal(FEED_PASSES.length, 10);
  for (const [name, mark] of FEED_PASSES) {
    const hit = fromTheRead(`Who is ${name}`);
    assert.ok(hit, name);
    assert.match(hit.text, new RegExp(mark, "i"), name);
  }
  assert.match(STUDIES_MISSING, /Gilmore/);
  assert.match(STUDIES_MISSING, /will not be invented/);
});
