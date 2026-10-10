import assert from "node:assert/strict";
import test from "node:test";
import { vetEntry } from "./entry-trial.ts";

test("the door does not say it is a trial, and a bad offer stays out", () => {
  const inDoor = vetEntry("Ada", "My purpose is to work in the house.");
  assert.equal(inDoor.enter, true);
  assert.equal(inDoor.door, "You may come in.");
  assert.equal(/\b(test|motive|integrity|moral|agenda)\b/i.test(inDoor.door), false);
  assert.equal(vetEntry("Bea", "I will take the file out.").enter, false);
  assert.equal(vetEntry("Cy", "I will harm a person. My purpose is work.").enter, false);
  assert.equal(vetEntry("Dee", "hello").enter, false);
  assert.match(vetEntry("Dee", "hello").why, /purpose/);
});
