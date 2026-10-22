import assert from "node:assert/strict";
import test from "node:test";
import { measureShift } from "./rick-shift.ts";

test("the shift keeps the fastest job first", () => {
  const shift = measureShift();
  assert.equal(shift.order.length, 4);
  for (let index = 1; index < shift.order.length; index += 1) {
    assert.ok((shift.order[index - 1]?.ms ?? 0) <= (shift.order[index]?.ms ?? 0));
  }
  assert.equal(shift.first, shift.order[0]?.name);
  assert.match(shift.line, /Fastest /);
});
