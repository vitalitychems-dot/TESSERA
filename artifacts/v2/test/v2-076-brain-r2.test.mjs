import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecognizer, SCHEDULES } from "../src/brain/learn.mjs";
import { MESHLOG } from "../src/brain/meshlog-labels.mjs";
import { scanTestLog, propose, summarize } from "../src/brain/selfscan.mjs";
import { gate } from "../src/brain/selfpatch.mjs";
import { benchLearning, benchAnatomy } from "../src/brain/bench2.mjs";
test("B2-01 learning loop: error-driven recognizer beats the lexicon on the fresh hidden split (intent)", () => {
  const b = benchLearning();
  assert.equal(b.hidden, 50);
  assert.ok(b.intent.after.acc > b.intent.before.acc, JSON.stringify(b.intent));
  const R = createRecognizer("intent", ["instruct", "inform"]); SCHEDULES.spaced(R, [{ text: "push the branch now", intent: "instruct" }, { text: "the branch was pushed", intent: "inform" }], "intent");
  assert.equal(R.predict("the branch was pushed"), "inform");
});
test("B2-02 human parcels sit at real HCP-MMP1 centroids", () => {
  const a = benchAnatomy(); assert.equal(a.parcels, 360); assert.equal(a.placedAtCentroid, 360); assert.ok(a.spearmanDistVsStrength < 0);
});
test("B2-03 self-scan turns a real test log into gated, suggest-only proposals", () => {
  const log = "✖ product copy (3.1ms)\n  Error: ENOENT: no such file\n✔ the 3D floor renders (6262.1ms)\n✔ quick (1.0ms)\n";
  const P = propose(scanTestLog(log)); assert.equal(P.length, 2); assert.ok(P.every((p) => p.mode === "suggest" && !p.verdict.ok));
  assert.ok(summarize(P).failedBy["no-self-approve"] >= 1);
  const real = { title: "skip 3D layout in B1-06", testRef: "test/v2-075-brain-view.test.mjs", testResult: { passed: 3, failed: 0 }, files: ["artifacts/v2/src/brain/http.mjs"], diff: "+ layout = true", mode: "suggest", author: "tessera", approver: null };
  assert.deepEqual(gate(real).failed, ["no-self-approve"]);
});
test("B2-04 mesh-log empathy set is 150+ real, PII-stripped lines", () => {
  assert.ok(MESHLOG.length >= 150);
  assert.ok(MESHLOG.every((x) => !/@\w+\.\w+|https?:\/\/|gh[opsu]_\w{10}/.test(x.text)));
});
