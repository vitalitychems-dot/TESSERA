import test from "node:test";
import assert from "node:assert/strict";
import { collect, compare, parseTestLog } from "./scores.mjs";
import { metrics } from "./meta.mjs";
import { extractCode, changedLines, parseIssue } from "./worker.mjs";
const b = (p50) => ({ paths: { "v2.router": { p50 } } });
const LOG = "# pass 12\n# fail 0\n# pass 3\n# fail 1\nnot ok 4 - rejects bad sha\n";
test("parses node:test logs", () => assert.deepEqual(parseTestLog(LOG), { pass: 15, fail: 1, failing: ["rejects bad sha"] }));
test("median of bench runs", () => assert.equal(collect("", 0, [b(1), b(3), b(2)]).bench["v2.router"].p50_median_ms, 2));
test("failing tests -> finding", () => assert.equal(compare(null, collect(LOG, 1, [b(1)]))[0].key, "tests-failing"));
test("bench regression beyond tolerance -> finding; noise does not", () => {
  const prev = collect("# pass 5\n", 0, [b(1.0)]);
  assert.equal(compare(prev, collect("# pass 5\n", 0, [b(1.05)])).length, 0);
  assert.equal(compare(prev, collect("# pass 5\n", 0, [b(1.5)]))[0].key, "bench-v2.router");
});
test("pass-count drop and missing bench path -> findings", () => {
  const prev = collect("# pass 9\n", 0, [b(1)]);
  assert.deepEqual(compare(prev, collect("# pass 8\n", 0, [])).map((f) => f.key).sort(), ["bench-broken", "bench-missing-v2.router", "pass-count-drop"]);
});
test("empty scores fail closed", () => assert.equal(compare(null, {})[0].key, "scorer-broken"));
test("meta-loop metrics and proposals", () => {
  const now = Date.parse("2026-10-13T12:00:00Z");
  const r = metrics([{ createdAt: "2026-10-10T00:00:00Z", closedAt: "2026-10-11T00:00:00Z", body: "tokens-used: 900" },
    { createdAt: "2026-10-12T00:00:00Z", closedAt: null, body: "" }, { createdAt: "2026-10-12T00:00:00Z", closedAt: null, body: "" }], 7, now);
  assert.deepEqual(r.metrics, { days: 7, opened: 3, fixed: 1, open: 2, medianHoursToFix: 24, tokensPerFix: 900 });
  assert.ok(r.proposals.some((p) => /Fix rate/.test(p)));
});
test("worker helpers", () => {
  assert.equal(extractCode("x\n```js\nA\n```"), "A\n");
  assert.equal(changedLines("a\nb", "a\nc"), 2);
  assert.deepEqual(parseIssue("file: lib/a.mjs\ntest: node lib/a.test.mjs"), { file: "lib/a.mjs", test: "node lib/a.test.mjs" });
});
import { selectRunner } from "./runner-select.mjs";
test("mesh runners: off by default, owner off-switch wins", () => {
  assert.equal(selectRunner({}), "ubuntu-latest");
  assert.equal(selectRunner({ TESSERA_MESH_RUNNERS: "0" }), "ubuntu-latest");
  assert.deepEqual(selectRunner({ TESSERA_MESH_RUNNERS: "1" }), ["self-hosted", "linux", "tessera-mesh"]);
  assert.equal(selectRunner({ TESSERA_MESH_RUNNERS: "1", TESSERA_MESH_OWNER_OFF: "1" }), "ubuntu-latest");
  assert.equal(selectRunner({ TESSERA_MESH_RUNNERS: "true" }), "ubuntu-latest");
});
test("vitest summary parsing", () => assert.deepEqual(parseTestLog(" Tests  2 failed | 9 passed (11)\n"), { pass: 9, fail: 2, failing: [] }));
test("spec reporter parsing", () => assert.deepEqual(parseTestLog("ℹ pass 7\nℹ fail 1\n✖ failing tests:\n\n✖ snapshot p95 (1.5ms)\n  Error: x\n"), { pass: 7, fail: 1, failing: ["snapshot p95"] }));
