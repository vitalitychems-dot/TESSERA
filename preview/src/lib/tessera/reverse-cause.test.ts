import assert from "node:assert/strict";
import test from "node:test";
import { reverseCause } from "./reverse-cause.ts";

test("a later lack does not cause a rule that was already written", () => {
  const line = [
    { name: "rule written", at: 1 },
    { name: "lack seen", at: 2 },
  ];
  const backwards = reverseCause(line, "lack seen", "rule written");
  assert.equal(backwards.known, true);
  assert.equal(backwards.reversed, true);
  assert.equal(backwards.created, false);
  assert.equal(backwards.earlier, "rule written");
  const forward = reverseCause(line, "rule written", "lack seen");
  assert.equal(forward.reversed, false);
  assert.equal(forward.earlier, "rule written");
  assert.equal(reverseCause(line, "missing", "rule written").known, false);
});
