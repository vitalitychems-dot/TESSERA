import assert from "node:assert/strict";
import test from "node:test";
import { sectionDelay } from "./section-step.ts";

test("a wait from the tess section stays at least one second", () => {
  assert.equal(sectionDelay(10000, 0.5), 10000);
  assert.equal(sectionDelay(10000, 0), 7000);
  assert.equal(sectionDelay(10000, 1), 13000);
  assert.equal(sectionDelay(100, 0), 1000);
});
