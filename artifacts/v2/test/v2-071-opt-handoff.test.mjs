import assert from "node:assert/strict";
import test from "node:test";
import * as H from "../src/opt/handoff.mjs";
import { createForeman } from "../src/studio/task-graph.mjs";
import { simPen } from "../src/studio/planner.mjs";
import { checkMessage, loadProtocol } from "../src/studio/protocol.mjs";
import { runBench } from "../src/opt/bench.mjs";

const bench = await runBench();
const gains = (n) => { const r = bench.find((x) => x.n === n); assert.ok(r.improved, JSON.stringify(r)); };

test("OPT-12 waves respect dependencies and catch cycles", () => {
  assert.deepEqual(H.waves([{ id: "a" }, { id: "b", dependsOn: ["a"] }, { id: "c" }]), [["a", "c"], ["b"]]);
  assert.throws(() => H.waves([{ id: "a", dependsOn: ["b"] }, { id: "b", dependsOn: ["a"] }]), /cycle/); gains(12);
});
test("OPT-13 capped retry stops at the cap", async () => {
  let n = 0; await assert.rejects(H.withRetry(async () => { n++; throw new Error("x"); }, { attempts: 2 })); assert.equal(n, 2); gains(13);
});
test("OPT-14 duplicate done is a no-op", () => {
  const f = createForeman(); f.addTask({ id: "x" }); f.start("x"); const done = H.idempotentComplete(f);
  assert.equal(done("x").duplicate, false); assert.equal(done("x").duplicate, true); gains(14);
});
test("OPT-15 protocol is parsed once and checks still work", () => {
  assert.equal(loadProtocol(), loadProtocol());
  assert.deepEqual(checkMessage({ type: "worker.event", taskId: "t", name: "n", detail: "" }), []); gains(15);
});
test("OPT-16 envelope carries every field of the prose handoff", () => {
  const h = { from: "A", to: "B", task: "T", status: "s", refs: ["r"], next: "n" };
  assert.deepEqual(JSON.parse(H.handoffEnvelope(h)), { f: "A", t: "B", k: "T", s: "s", r: ["r"], n: "n" }); gains(16);
});
test("OPT-17 registry routes to the one owner", () => {
  const r = H.createRegistry(); r.register("Sec", ["secrets"]); r.register("Build", ["gate"]);
  assert.deepEqual(r.route("gate"), { to: "Build", messages: 1 }); assert.equal(r.route("none").to, null); gains(17);
});
test("OPT-18 plan memo returns an equal, separate plan", async () => {
  const p = H.memoPen(simPen()); const a = await p.complete("Plan: x"); const b = await p.complete("plan: x ");
  assert.deepEqual(a, b); assert.notEqual(a, b); assert.equal(p.calls(), 1); gains(18);
});
test("OPT-19 batch decisions unblock every task", () => {
  const f = createForeman(); f.addTask({ id: "a" }); f.addTask({ id: "b" });
  const open = [f.requestDecision({ taskId: "a", question: "?" }), f.requestDecision({ taskId: "b", question: "?" })];
  H.batchDecisions(f, open, {}); assert.ok(f.snapshot().tasks.every((t) => t.status === "pending")); gains(19);
});
test("OPT-20 early quorum gives the same verdict as a full count", () => {
  for (const v of [[true, true, false], [false, false, true], [true, false, true]]) {
    const full = v.filter(Boolean).length >= 2; assert.equal(H.earlyQuorum(v, 3).passed, full);
  } gains(20);
});
test("OPT-21 a second lane cannot claim a held task; empty owner refused", () => {
  const c = H.createClaims(); assert.equal(c.claim("t", "A"), true); assert.equal(c.claim("t", "B"), false);
  c.release("t", "A"); assert.equal(c.claim("t", "B"), true); assert.throws(() => c.claim("u", "")); gains(21);
});
