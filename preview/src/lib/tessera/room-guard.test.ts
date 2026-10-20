import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_SHARING, fontStopsLogger, keepDrop, roomLine } from "./room-guard.ts";

test("the three sharing switches are required off, and this file does not change the Mac", () => {
  assert.equal(REQUIRED_SHARING.remoteLogin, "off");
  assert.equal(REQUIRED_SHARING.screenSharing, "off");
  assert.equal(REQUIRED_SHARING.remoteManagement, "off");
  assert.equal(keepDrop("the password is open").ok, false);
  assert.equal(keepDrop("keystroke log from today").ok, false);
  assert.equal(keepDrop("turn rdp on").ok, false);
  assert.equal(keepDrop("the mesh is the repository").ok, true);
  assert.equal(fontStopsLogger(), false);
  const line = roomLine();
  assert.equal(line.allOff, true);
  assert.equal(line.rdpChangedHere, false);
  assert.equal(line.storedLogin, false);
});
