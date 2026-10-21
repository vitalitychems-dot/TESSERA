import { test } from "node:test";
import assert from "node:assert/strict";
import { features } from "../src/brain/affect-model.mjs";
import { benchAffectModel } from "../src/brain/bench3.mjs";
import { locateTest, proposeAndVerify, APPROVER_LANE } from "../src/brain/selfscan.mjs";
import { enabled, FLAG } from "../src/brain/selfpatch.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
test("B3-02 affect reader: negation, intensity and cue features", () => {
  const f = features("This is NOT working again!!");
  assert.ok(f.includes("NEG") && f.includes("not_working") && f.includes("INTENS") && f.includes("BANG") && f.includes("CAPS"));
});
test("B3-02 learned affect beats the lexicon on nested held-out folds (F1 and accuracy)", () => {
  const b = benchAffectModel(); assert.equal(b.n, 218);
  assert.ok(b.after.f1 > b.before.f1 && b.after.acc > b.before.acc, JSON.stringify(b));
});
test("B3-03 proposals get a located test ref, a fresh run, and the Build approver; flag stays off", () => {
  assert.equal(locateTest("B3-02 affect reader: negation, intensity and cue features", join(ROOT, "test")), "test/v2-077-brain-r3.test.mjs");
  const log = "✔ B3-02 affect reader: negation, intensity and cue features (1500.0ms)\n";
  const r = proposeAndVerify(log, { root: ROOT, run: () => ({ passed: 2, failed: 0 }) });
  assert.equal(r.items.length, 1); assert.equal(r.items[0].approver, APPROVER_LANE); assert.equal(r.items[0].testRef, "test/v2-077-brain-r3.test.mjs");
  assert.equal(r.passed, 1); assert.equal(r.withChange, 0);
  assert.equal(enabled({}), false); assert.equal(FLAG, "TESSERA_BRAIN_SELFPATCH");
});
