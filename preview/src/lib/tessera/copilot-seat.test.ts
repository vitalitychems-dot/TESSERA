import assert from "node:assert/strict";
import test from "node:test";
import { copilotSeat } from "./copilot-seat.ts";

test("Copilot was asked and has not joined", () => {
  const seat = copilotSeat();
  assert.equal(seat.joined, false);
  assert.equal(seat.name, "Copilot");
  assert.match(seat.reason, /403/);
});
