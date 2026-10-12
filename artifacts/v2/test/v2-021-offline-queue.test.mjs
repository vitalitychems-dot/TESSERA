import assert from "node:assert/strict";
import test from "node:test";
import { installFakeIndexedDb } from "../src/offline/fake-indexeddb.mjs";
import { STORE_NAMES, enqueue, indexedDbStore, replay } from "../../../preview/src/lib/offline/queue.ts";

test("fake-indexeddb replays a queued request once and has no vault store", async () => {
  installFakeIndexedDb();
  assert.ok(!STORE_NAMES.some((name) => /vault/i.test(name)));
  assert.deepEqual([...STORE_NAMES], ["apiCache", "offlineQueue"]);
  const store = indexedDbStore("tessera-v2-queue-test");
  await enqueue(store, { key: "a", method: "POST", url: "/api/note", body: "1" });
  await enqueue(store, { key: "a", method: "POST", url: "/api/note", body: "1" });
  let calls = 0;
  const first = await replay(store, async () => {
    calls += 1;
    return true;
  });
  assert.deepEqual(first, { sent: 1, left: 0 });
  const second = await replay(store, async () => {
    calls += 1;
    return true;
  });
  assert.deepEqual(second, { sent: 0, left: 0 });
  assert.equal(calls, 1);
});
