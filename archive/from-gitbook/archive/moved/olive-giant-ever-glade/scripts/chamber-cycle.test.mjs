import assert from "node:assert/strict";
import test from "node:test";
import { CYCLE_FLAG, proposeUpgrade } from "../src/lib/tessera/chamber-cycle.ts";

const PREVIOUS =
  "The tighter sentence is: the only recursive step allowed here is a text cycle — constitution, then lesson, then pulse, then world tick — and an upgrade is kept only when it quotes the exact previous surviving sentence it improves.";

test("the cycle stays off and does not upgrade", () => {
  assert.equal(CYCLE_FLAG, 0);
  assert.deepEqual(proposeUpgrade(PREVIOUS, "a shorter honest sentence"), { ok: false, text: "off" });
});
