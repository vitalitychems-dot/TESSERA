import assert from "node:assert/strict";
import test from "node:test";
import { DESK_MEM_LIMIT_MB, runDeskProbe } from "../src/compute/sandbox.mjs";

test("a desk probe denies the network and stays under the memory cap", () => {
  const probe = runDeskProbe();
  assert.equal(probe.networkDenied, true);
  assert.equal(probe.memLimitMb, DESK_MEM_LIMIT_MB);
  assert.ok(probe.heapLimit < 128 * 1024 * 1024);
});
