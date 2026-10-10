import assert from "node:assert/strict";
import test from "node:test";
import { sharedHouse } from "./shared-house.ts";

test("the shared house keeps each room and her vote", () => {
  const house = sharedHouse();
  assert.equal(house.lived, true);
  assert.match(house.line, /Rick keeps the west chamber/);
  assert.match(house.line, /Tessera keeps the chair/);
  assert.equal(house.vote.vote, "yes");
  assert.match(house.vote.reason, /I read/);
});
