import assert from "node:assert/strict";
import test from "node:test";
import { proveRecursive, synapseSteps, taught, useLink } from "./recursive-proof.ts";

test("a held-out name uses the hop, and a miss does not grow the synapse", () => {
  const proof = proveRecursive();
  assert.equal(proof.proved, true);
  assert.equal(proof.once, 0.1);
  assert.equal(proof.twice, 0.19);
  assert.equal(taught([{ kind: "studied", who: "Aristotle", where: "Academy" }], "Aristotle"), "");
  const missed = useLink([{ from: "Plato", to: "Academy", weight: 0.19 }], "Plato", "Academy", false);
  assert.equal(missed[0]?.weight, 0.19);
  assert.match(proof.said, /Theaetetus/);
});

test("a second school grows its own synapse, and a miss does not move the first", () => {
  const [once, twice, missed, second] = synapseSteps();
  assert.equal(once[0]?.weight, 0.1);
  assert.equal(twice[0]?.weight, 0.19);
  assert.equal(missed[0]?.weight, 0.19);
  assert.equal(missed.length, 1);
  assert.equal(second.length, 2);
  assert.equal(second[1]?.weight, 0.1);
  assert.equal(second[0]?.from, "Plato");
  assert.equal(taught([{ kind: "studied", who: "Theophrastus", where: "Lyceum" }], "Theophrastus"), "");
});

