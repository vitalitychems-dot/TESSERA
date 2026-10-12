import assert from "node:assert/strict";
import test from "node:test";
import { meshStatus } from "./mesh-status.ts";
test("badge reflects navigator.onLine and queue length", () => {
  assert.deepEqual(meshStatus(false, 0), { health: "offline", label: "Offline" });
  assert.equal(meshStatus(false, 3).label, "Offline · 3 waiting");
  assert.equal(meshStatus(true, 2).health, "syncing");
  assert.equal(meshStatus(true, 0).health, "online");
});
