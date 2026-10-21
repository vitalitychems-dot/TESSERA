import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as R2 from "../src/opt/round2.mjs";
import { runBench } from "../src/opt/bench.mjs";

const bench = await runBench();
const gains = (n) => { const r = bench.find((x) => x.n === n); assert.ok(r.improved, JSON.stringify(r)); };
const buildLog = readFileSync(new URL("../../../docs/v2/BUILD-LOG.md", import.meta.url), "utf8");
const memRows = readFileSync(new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url), "utf8").trim().split("\n");

test("R2-1 prefix-legend round-trips exactly and saves tokens", () => {
  const p = R2.prefixLegend(buildLog); assert.equal(R2.expandPrefix(p), buildLog); assert.equal(R2.prefixLegend("a § b"), "a § b"); gains(27);
});
test("R2-2 key-hoist round-trip (opt-in decode)", () => {
  const rows = memRows.slice(0, 200).map((r) => JSON.stringify(JSON.parse(r)));
  assert.deepEqual(R2.unhoist(R2.keyHoist(rows)), rows);
  const mixed = [{ a: 1, b: "x" }, { c: [1, 2] }, { a: 2, b: "y" }, { "a,b": 3 }].map((o) => JSON.stringify(o));
  assert.deepEqual(R2.unhoist(R2.keyHoist(mixed)), mixed);
  assert.throws(() => R2.unhoist("[]")); gains(28);
});
test("R2-3 resonate-chain output verifies against dedupe+ws text", () => {
  const b = R2.resonateChain(buildLog); assert.ok(b.chain.length > 0); assert.ok(R2.chainVerifier(buildLog)(b.out)); gains(29);
});
test("R2-4 coincide refuses on 2 of 3", () => {
  assert.equal(R2.coincide([true, true, false]).act, false); assert.equal(R2.coincide([true, true, true]).act, true); gains(30);
});
test("R2-5 phase never exceeds ceil(n/K) per tick", () => {
  for (const [n, K] of [[12, 4], [13, 4], [5, 3]]) assert.ok(R2.peakStarts(R2.phaseStarts(n, K)) <= Math.ceil(n / K)); gains(31);
});
test("R2-6 valve refuses rewrites, allows append", () => {
  const v = R2.valveLog(); v.append("a"); assert.equal(v.write(0, "x"), false); assert.equal(v.write(5, "x"), false); assert.equal(v.write(1, "b"), true); assert.deepEqual(v.lines(), ["a", "b"]); gains(32);
});
test("R2-7 bifilar finds unmatched opens", () => {
  assert.deepEqual(R2.bifilar([["open", 1], ["open", 2], ["close", 1], ["close", 3]]), [2]);
  assert.deepEqual(R2.bifilar([["open", 1], ["open", 1], ["close", 1]]), [1]); gains(33);
});
test("R2-8 earth-return round-trip (opt-in decode)", () => {
  const e = R2.createEarthStore(); const m = e.send(buildLog); assert.match(m.ref, /^[0-9a-f]{16}$/);
  assert.equal(e.receive(JSON.parse(JSON.stringify(m))), buildLog); assert.equal(e.receive("plain"), "plain");
  assert.throws(() => e.receive({ ref: "0000000000000000" })); gains(34);
});
test("R2-9 tuned-clip keeps every match under the cap", () => {
  const text = memRows.slice(0, 200).join("\n"); const want = text.split("\n").filter((l) => l.toLowerCase().includes("relation")).length;
  const out = R2.tunedClip(text, "relation"); assert.equal(out.split("\n").filter((l) => l.toLowerCase().includes("relation")).length, want);
  assert.ok(out.split("\n").length <= 41); gains(35);
});
