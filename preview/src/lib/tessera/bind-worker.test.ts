import assert from "node:assert/strict";
import test from "node:test";
import { CURSOR_ROOM, bindWorker, boundNames } from "./bind-worker.ts";

test("a worker binds only to her own mark", () => {
  const self = "be9f4ef632149361";
  assert.equal(bindWorker(self, "desk", self).state, "bound");
  assert.equal(bindWorker(self, "cursor", "other").state, "unbound");
  assert.deepEqual(boundNames(self, [
    { name: "desk", mark: self },
    { name: "cursor", mark: "" },
    { name: "manus", mark: "other" },
  ]), ["desk"]);
  assert.equal(CURSOR_ROOM.startsWith("bc-"), true);
});
