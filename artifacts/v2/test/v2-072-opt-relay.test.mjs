import assert from "node:assert/strict";
import test from "node:test";
import * as R from "../src/opt/relay.mjs";
import { runBench } from "../src/opt/bench.mjs";

const bench = await runBench();
const gains = (n) => { const r = bench.find((x) => x.n === n); assert.ok(r.improved, JSON.stringify(r)); };

test("OPT-22 relay refetches only after the TTL", async () => {
  let t = 0, n = 0; const r = R.createRelay(async () => ++n, { ttlMs: 100, now: () => t });
  await r.get("k"); await r.get("k"); t = 150; await r.get("k"); assert.equal(n, 2); gains(22);
});
test("OPT-23 bucket at burst 1 never exceeds the rate", () => {
  let t = 0; const b = R.createBucket({ ratePerSec: 2, burst: 1, now: () => t });
  assert.equal(b.take(), 0); assert.ok(b.take() > 0); t = 500; assert.equal(b.take(), 0); gains(23);
});
test("OPT-24 polite fetch waits Retry-After and gives up at the cap", async () => {
  const waits = []; const out = await R.politeFetch(async () => ({ status: 429, retryAfter: 3 }), { maxTries: 2, sleep: async (ms) => waits.push(ms) });
  assert.equal(out.res.status, 429); assert.deepEqual(waits, [3000, 3000]); gains(24);
});
test("OPT-25 concurrent asks share one fetch and the same value", async () => {
  let n = 0; const r = R.createRelay(async () => { n++; await new Promise((x) => setTimeout(x, 5)); return "v"; });
  const vals = await Promise.all([r.get("k"), r.get("k"), r.get("k")]); assert.deepEqual(vals, ["v", "v", "v"]); assert.equal(n, 1); gains(25);
});
test("OPT-26 hash store dedupes and delta sync sends only changes", () => {
  const s = R.createCasStore(); s.put("a", "same"); s.put("b", "same"); assert.equal(s.bytes(), 4); assert.equal(s.get("b"), "same");
  assert.deepEqual(R.deltaSync({ a: "1", b: "2" }, R.manifest({ a: "1", b: "x" })), { b: "2" }); gains(26); gains(26.1);
});
