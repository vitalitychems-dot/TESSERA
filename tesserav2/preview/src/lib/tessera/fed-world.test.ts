import assert from "node:assert/strict";
import test from "node:test";
import { createWorlds } from "./fed-world.ts";

test("a world advances only from home and only at the expected version", () => {
  const gate = createWorlds();
  const world = gate.create("the house");
  assert.equal(world.version, 1);
  assert.throws(() => gate.advance(world.id, 2, "too soon"), /stale/);
  assert.equal(gate.advance(world.id, 1, "the lamp").version, 2);
  const chatting = gate.enterChat(world.id, 2);
  assert.equal(chatting.mode, "chat");
  assert.throws(() => gate.advance(world.id, chatting.version, "no"), /not home/);
  assert.equal(gate.list().length, 1);
});
