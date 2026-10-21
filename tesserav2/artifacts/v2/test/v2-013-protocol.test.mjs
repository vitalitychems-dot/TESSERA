import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkMessage } from "../src/studio/protocol.mjs";

test("npm run check accepts the protocol examples", () => {
  const script = fileURLToPath(new URL("../src/check-protocol.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /protocol ok/);
});

test("a message missing a required field is rejected", () => {
  const errors = checkMessage({ type: "goal.post" });
  assert.ok(errors.some((error) => error.includes("goal")));
  assert.deepEqual(checkMessage({ type: "wallet.transfer", amount: "1" }).length > 0, true);
});
