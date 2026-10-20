import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkArgs, compare, safeScore, UNKNOWN_RECURSION } from "./scorecard.mjs";
const SC = join(dirname(fileURLToPath(import.meta.url)), "scorecard.mjs");

test("checkArgs flags missing --base/--head", () => {
  assert.match(checkArgs([]), /missing required --base and --head/);
  assert.match(checkArgs(["--base", "x"]), /missing required --head/);
  assert.match(checkArgs(["--base", "--head", "y"]), /missing required --base/);
  assert.equal(checkArgs(["--base", "x", "--head", "y"]), null);
});
test("CLI without args exits 2 with usage, no stack trace", () => {
  const r = spawnSync(process.execPath, [SC], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage: node scorecard\.mjs --base DIR --head DIR/);
  assert.doesNotMatch(r.stderr, /TypeError/);
});
test("safeScore degrades a throwing scorer to UNKNOWN", () => {
  const v = safeScore(() => { throw new Error("gh missing"); }, UNKNOWN_RECURSION);
  assert.equal(v.status, "UNKNOWN"); assert.equal(v.value, null);
});
test("compare reports UNKNOWN recursion_rate without failing the scorecard", () => {
  const ok = { value: 1, noise_band: 0 };
  const res = compare({ a: ok, recursion_rate: { ...UNKNOWN_RECURSION } }, { a: ok, recursion_rate: { ...UNKNOWN_RECURSION } });
  assert.equal(res.rows.find((r) => r.name === "recursion_rate").verdict, "UNKNOWN");
  assert.equal(res.verdict, "PASS");
});
test("compare still FAILs a real regression alongside UNKNOWN", () => {
  const res = compare({ a: { value: 1, noise_band: 0 }, recursion_rate: { ...UNKNOWN_RECURSION } }, { a: { value: 0.5, noise_band: 0 }, recursion_rate: { ...UNKNOWN_RECURSION } });
  assert.equal(res.verdict, "FAIL");
});
