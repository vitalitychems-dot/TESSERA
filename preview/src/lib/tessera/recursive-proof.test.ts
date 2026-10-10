import assert from "node:assert/strict";
import test from "node:test";
import { proveRecursive, taught, useLink } from "./recursive-proof.ts";

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
