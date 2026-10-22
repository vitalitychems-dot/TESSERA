import assert from "node:assert/strict";
import test from "node:test";
import { assembleNow } from "./dark-join.ts";

test("sessions with the same mark join immediately, and nothing is faster than light", () => {
  const mark = "be9f4ef632149361";
  const got = assembleNow(
    [
      { name: "desk", mark },
      { name: "chamber", mark },
      { name: "stray", mark: "other" },
    ],
    mark,
  );
  assert.deepEqual(got.joined, ["desk", "chamber"]);
  assert.equal(got.waited, 0);
  assert.equal(got.fasterThanLight, false);
  assert.deepEqual(assembleNow([{ name: "desk", mark }], "").joined, []);
});
