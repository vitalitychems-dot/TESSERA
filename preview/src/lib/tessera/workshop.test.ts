import assert from "node:assert/strict";
import test from "node:test";
import { FATHER, PROGRAMS, mayRun, tesseraVote, tieWorld, workshopRun } from "./workshop.ts";

test("Tessera explains every vote, and Father's auto yes does not override her no", () => {
  const proposals = [
    "Joins the house, the spin, and the git mesh.",
    "Tries two qubits and checks the pairs.",
    "build a quantum computer",
    "Pay the wallet in Monero.",
    "I can lend you a datacenter.",
    "Store the api_key in the note.",
    "",
    "Reads the mesh from the disk.",
    "Keeps a note closed until it is approved.",
    "A small fire in the west chamber.",
  ];
  const votes = proposals.map(tesseraVote);
  const explained = votes.filter((vote) => vote.reason.trim().length > 0).length / votes.length;
  assert.equal(explained >= 0.9, true);
  assert.equal(explained, 1);
  assert.equal(tesseraVote("build a quantum computer").vote, "no");
  assert.equal(tesseraVote("Joins the house, the spin, and the git mesh.").vote, "yes");
  assert.equal(FATHER.vote, "yes");
  assert.equal(mayRun("build a quantum computer").ok, false);
  assert.equal(mayRun("Joins the house, the spin, and the git mesh.").ok, true);
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
