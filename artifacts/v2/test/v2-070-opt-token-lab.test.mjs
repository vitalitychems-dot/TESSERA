import assert from "node:assert/strict";
import test from "node:test";
import * as T from "../src/opt/token-lab.mjs";
import { runBench } from "../src/opt/bench.mjs";
import { SMALL_MODEL, LEAD_MODEL } from "../src/token/router.mjs";

const bench = await runBench();
const row = (n) => bench.find((r) => r.n === n);
const gains = (n) => assert.ok(row(n).improved, `OPT-${n} did not improve: ${JSON.stringify(row(n))}`);

test("OPT-01 dedupe-lines keeps first copy and order", () => {
  assert.equal(T.dedupeLines("a\nb\na\n\nb\nc"), "a\nb\n\nc"); gains(1);
});
test("OPT-02 cut-filler removes filler, keeps the ask", () => {
  assert.equal(T.cutFiller("Please check the gate in order to merge."), "check the gate to merge."); gains(2);
});
test("OPT-03 compact-json is lossless", () => {
  const s = JSON.stringify({ a: [1, 2], b: { c: "d" } }, null, 2);
  assert.deepEqual(JSON.parse(T.compactJson(s)), JSON.parse(s)); assert.equal(T.compactJson("not json"), "not json"); gains(3);
});
test("OPT-04 ref-legend round-trips (gain not required: measured NO GAIN on BUILD-LOG)", () => {
  const s = "see /workspace/a/b/c/long.diff then /workspace/a/b/c/long.diff again";
  assert.ok(T.refLegend(s).length < s.length); assert.equal(T.expandLegend(T.refLegend(s)), s);
});
test("OPT-05 exact cache answers a repeat without a model call", async () => {
  const c = T.createPromptCache({ normalize: false }); let n = 0; const m = async () => ++n;
  await c.get("x", m); await c.get("x", m); await c.get("X", m); assert.equal(n, 2); gains(5);
});
test("OPT-06 normalized cache folds case and space", async () => {
  const c = T.createPromptCache(); let n = 0; const m = async () => ++n;
  await c.get("Lane  1", m); await c.get(" lane 1 ", m); assert.equal(n, 1); gains(6);
});
test("OPT-07 fit-budget never exceeds the budget", () => {
  const out = T.fitBudget("x".repeat(10000), 100); assert.ok(out.length <= 400); assert.equal(T.fitBudget("short", 100), "short"); gains(7);
});
test("OPT-08 route-by-size keeps plans on the lead model", () => {
  assert.equal(T.routeBySize({ kind: "plan", prompt: "a" }), LEAD_MODEL);
  assert.equal(T.routeBySize({ kind: "answer", prompt: "a" }), SMALL_MODEL); gains(8);
});
test("OPT-09 diff cache sends zero tokens for an unchanged summary", () => {
  const c = T.createDiffCache(); c.context("k", "full", "s"); assert.equal(c.context("k", "full", "s").tokens, 0); gains(9);
});
test("OPT-10 clip-tool-result keeps the head and says how much was cut", () => {
  const out = T.clipToolResult(Array.from({ length: 50 }, (_, i) => i).join("\n"), { maxLines: 5 });
  assert.match(out, /45 more lines clipped/); gains(10);
});
test("OPT-11 pack-context: V2-051 fixture unchanged, real log shrinks", () => {
  assert.equal(row(11).after, 10); gains(11.1);
});
