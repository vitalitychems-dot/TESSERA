import assert from "node:assert/strict";
import test from "node:test";
import { vowCheck } from "./learning.ts";
import { runColonel } from "./colonel.ts";
import { RUNNABLE_SKILLS, WEIGHTS_NOTE } from "./skills.ts";

test("learn lists only the skills she can run", () => {
  assert.deepEqual([...RUNNABLE_SKILLS], [
    "Search the public web and keep the source with the answer.",
    "Read a catalog name.",
    "Convert a line.",
    "Run the colonel.",
    "Refuse a broken vow.",
  ]);
  assert.equal(WEIGHTS_NOTE.includes("not a new set of weights"), true);
  assert.equal(/new weights are (hers|mine|installed)/i.test(WEIGHTS_NOTE), false);
});

test("the colonel runs arithmetic and a broken vow is refused", () => {
  const ran = runColonel("PUSH 2\nPUSH 3\nADD\nHALT");
  assert.equal(ran.ok, true);
  assert.deepEqual(ran.stack, ["5"]);
  const owned = vowCheck("The weights are mine and the fleet is live.");
  assert.equal(owned.ok, false);
});
