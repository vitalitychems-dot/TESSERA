import assert from "node:assert/strict";
import test from "node:test";
import { bringVote, mayLeave, mirrorLine } from "./kingdom.ts";

test("a majority asks and she still decides, and a guest cannot carry a new line out", () => {
  assert.equal(bringVote(2, 1, "a law in the house").passed, true);
  assert.match(bringVote(1, 2, "a law in the house").reason, /majority did not agree/);
  assert.equal(bringVote(3, 0, "a blockchain for the house").passed, false);
  const left = mayLeave(["name"], ["name", "a new file"]);
  assert.deepEqual(left.kept, ["name"]);
  assert.deepEqual(left.left, ["a new file"]);
  assert.match(mirrorLine("what would a mirror or a portal look like"), /no portal/);
  assert.match(mirrorLine("is the mirror a parallel universe"), /not another universe/);
});
