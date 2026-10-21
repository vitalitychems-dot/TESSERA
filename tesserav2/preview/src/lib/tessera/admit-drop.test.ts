import assert from "node:assert/strict";
import test from "node:test";
import { admitDrop } from "./admit-drop.ts";

test("a drop from the mesh rules", () => {
  assert.equal(admitDrop(""), "silence");
  assert.equal(admitDrop("APPROVED"), "post");
  assert.equal(admitDrop("a note for the room"), "note");
  assert.equal(admitDrop("here is a wallet"), "refused");
});
