import assert from "node:assert/strict";
import test from "node:test";
import { enqueue, memoryStore, replay, STORE_NAMES } from "./queue.ts";

test("queued POST replays once on reconnect, no duplicates", async () => {
  const s = memoryStore();
  await enqueue(s, { key: "a", method: "POST", url: "/api/x", body: "1" });
  await enqueue(s, { key: "a", method: "POST", url: "/api/x", body: "1" });
  let calls = 0;
  let online = false;
  assert.deepEqual(await replay(s, async () => { calls++; return online; }), { sent: 0, left: 1 });
  online = true;
  assert.deepEqual(await replay(s, async () => { calls++; return online; }), { sent: 1, left: 0 });
  assert.deepEqual(await replay(s, async () => { calls++; return true; }), { sent: 0, left: 0 });
  assert.equal(calls, 2);
});

test("no knowledgeVault store", () => {
  assert.ok(!(STORE_NAMES as readonly string[]).some((n) => /vault/i.test(n)));
});
