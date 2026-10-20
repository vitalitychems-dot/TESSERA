import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEval, gate } from "./eval-gate.mjs";
const GATE = join(dirname(fileURLToPath(import.meta.url)), "eval-gate.mjs");
const out = (g, p) => `  Grade:       \x1b[31m\x1b[1m${g}\x1b[0m\n  Score:       390 / 2900 (${p}th percentile)\n`;
const base = { grade: "F", percentile: 13 };
const run = (text) => { const d = mkdtempSync(join(tmpdir(), "evalgate-")), f = join(d, "o.txt"), b = join(d, "b.json"); writeFileSync(f, text); writeFileSync(b, JSON.stringify(base)); return spawnSync(process.execPath, [GATE, "--input", f, "--baseline", b], { encoding: "utf8" }); };

test("parseEval reads grade and percentile through ANSI colors", () => {
  assert.deepEqual(parseEval(out("F", 13)), { grade: "F", percentile: 13 });
  assert.deepEqual(parseEval(out("B+", 76)), { grade: "B+", percentile: 76 });
  assert.equal(parseEval("garbage"), null);
});
test("gate passes at and above baseline", () => {
  assert.equal(gate({ grade: "F", percentile: 13 }, base).pass, true);
  assert.equal(gate({ grade: "D", percentile: 41 }, base).pass, true);
});
test("gate fails on percentile drop", () => {
  const r = gate({ grade: "F", percentile: 12 }, base);
  assert.equal(r.pass, false); assert.match(r.reasons[0], /p12 < baseline p13/);
});
test("gate fails on grade drop", () => {
  assert.equal(gate({ grade: "C", percentile: 60 }, { grade: "B", percentile: 50 }).pass, false);
});
test("CLI: passing case exits 0", () => { const r = run(out("F", 13)); assert.equal(r.status, 0); assert.match(r.stdout, /EVAL-GATE PASS/); });
test("CLI: forced-failing case exits 1", () => { const r = run(out("F", 9)); assert.equal(r.status, 1); assert.match(r.stdout, /EVAL-GATE FAIL/); });
test("CLI: unparseable output exits 2", () => { assert.equal(run("no summary").status, 2); });
