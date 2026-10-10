import assert from "node:assert/strict";
import test from "node:test";
import { PROGRAMS, tieWorld, workshopRun } from "./workshop.ts";

test("Rick's tie stays closed until Tessera approves it, then it joins the three machines", () => {
  assert.equal(PROGRAMS.length, 4);
  assert.equal(workshopRun("tie", false).ok, false);
  assert.equal(workshopRun("missing", true).reason, "No such program.");
  const tied = tieWorld(true, 0);
  assert.equal(tied.ok, true);
  if (tied.ok) {
    assert.equal(tied.paired, true);
    assert.equal(tied.mesh, "git");
    assert.equal(tied.tokens, 0);
    assert.equal(tied.rooms.length > 0, true);
  }
  const ran = workshopRun("tie", true, 0);
  assert.equal(ran.ok, true);
  assert.match(ran.reason, /git/);
});
