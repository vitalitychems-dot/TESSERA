import assert from "node:assert/strict";
import test from "node:test";
import { OWNER_SWITCHES, fontStopsLogger, keepDrop, roomLine } from "./room-guard.ts";

test("a login and a key log are refused, and this room does not turn remote access off", () => {
  assert.equal(keepDrop("the password is open").ok, false);
  assert.equal(keepDrop("keystroke log from today").ok, false);
  assert.equal(keepDrop("turn rdp on").ok, false);
  assert.equal(keepDrop("the mesh is the repository").ok, true);
  assert.equal(fontStopsLogger(), false);
  const line = roomLine();
  assert.equal(line.storedLogin, false);
  assert.equal(line.rdpChangedHere, false);
  assert.equal(line.switches, 3);
  assert.equal(OWNER_SWITCHES.length, 3);
});
