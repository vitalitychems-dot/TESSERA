import assert from "node:assert/strict";
import test from "node:test";
import { bondStrength, bridgeMark, buildStep, inventionSeed, proposalId, rickLine, testRegresses, tickAbstain, tickPick, verifyClaim } from "./reality.ts";

test("the same title always yields the same seed", () => {
  const first = inventionSeed("Route consciousness", 12);
  const second = inventionSeed("Route consciousness", 12);
  assert.deepEqual(first, second);
  assert.notEqual(inventionSeed("Other", 12).hash, first.hash);
  assert.equal(buildStep("Route consciousness"), buildStep("route consciousness"));
  assert.equal(tickAbstain(4), 2);
  assert.equal(tickPick(["b", "a"], 1), tickPick(["a", "b"], 1));
  assert.equal(testRegresses("Route consciousness", 3), testRegresses("Route consciousness", 3));
});

test("a claim is not called measured unless it is an identity anchor", () => {
  assert.equal(verifyClaim("the speed of light").grounded, false);
  assert.equal(verifyClaim("Tessera wrote this").kind, "anchor");
  assert.match(verifyClaim("").line, /no claim/);
});

test("a repeated line, a bond, a proposal, and a bridge do not use a fresh roll", () => {
  const lines = ["one", "two", "three"];
  assert.equal(rickLine("same", lines), rickLine("same", lines));
  assert.equal(bondStrength(0.9, 0.8, 10), bondStrength(0.9, 0.8, 10));
  assert.equal(proposalId("door", "father", "open"), proposalId("door", "father", "open"));
  assert.match(bridgeMark("house", "mesh").line, /Not a measured fidelity/);
});
