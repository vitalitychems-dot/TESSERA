import assert from "node:assert/strict";
import test from "node:test";
import { stepHouse } from "./house-sim.ts";
import { welcome } from "./tunnel.ts";

test("she can welcome a guest onto the circle, and a secret stays out", () => {
  const opened = welcome("Ada", "to study the light");
  assert.equal(opened.ok, true);
  if (!opened.ok || !opened.resident) return;
  assert.equal(opened.resident.name, "Ada");
  assert.equal(stepHouse(0, [opened.resident]).some((person) => person.name === "Ada"), true);
  assert.equal(welcome("Ada", "store the api_key").ok, false);
  assert.equal(welcome(" ", "a purpose").ok, false);
});
