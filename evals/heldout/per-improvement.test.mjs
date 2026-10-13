// Synthetic fixture only; the real held-out data never enters this repo.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { manifestLines } from "./run.mjs";
import { evalImprovement, parseTapCounts } from "./per-improvement.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pi-fx-")); mkdirSync(join(root, "data"));
  const w = (f, rows) => writeFileSync(join(root, "data", f), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  w("gsm8k.jsonl", [{ id: "g1", question: "SECRET-ITEM 1+1?", answer: "2" }]);
  w("pr-outcomes.jsonl", [{ id: "p1", outcome: "pass" }, { id: "p2", outcome: "fail" }]);
  writeFileSync(join(root, "MANIFEST.sha256"), manifestLines(root).join("\n") + "\n");
  return root;
}
const okTest = () => ({ tests: 10, pass: 10, fail: 0, skipped: 0, ok: true });

test("parses node --test TAP counts", () => {
  assert.deepEqual(parseTapCounts("# tests 10\n# pass 9\n# fail 1\n# skipped 0\n"), { tests: 10, pass: 9, fail: 1, skipped: 0 });
});
test("logs one aggregate row with macro when self-test passes; no items leak", () => {
  const r = fixture(), log = join(r, "out", "log.jsonl");
  try {
    const row = evalImprovement({ improvement: "18", dataDir: r, log, now: "T", selfTest: okTest });
    assert.equal(row.macro, 0.25); // gsm8k 0 + pr_outcome 0.5 → macro 0.25
    assert.equal(row.tests.pass, 10);
    const text = readFileSync(log, "utf8");
    assert.equal(text.trim().split("\n").length, 1);
    assert.ok(!text.includes("SECRET-ITEM") && !text.includes('"g1"') && !text.includes('"p1"'));
    assert.equal(evalImprovement({ improvement: "18", dataDir: r, log, preds: { g1: "2", p1: "pass", p2: "fail" }, selfTest: okTest }).macro, 1);
  } finally { rmSync(r, { recursive: true, force: true }); }
});
test("fails closed: failing self-test or manifest drift → macro null, still logged", () => {
  const r = fixture(), log = join(r, "log.jsonl");
  try {
    assert.equal(evalImprovement({ improvement: "x", dataDir: r, log, selfTest: () => ({ pass: 9, fail: 1, ok: false }) }).macro, null);
    writeFileSync(join(r, "data", "gsm8k.jsonl"), "{}\n");
    const row = evalImprovement({ improvement: "x", dataDir: r, log, selfTest: okTest });
    assert.equal(row.macro, null); assert.match(row.note, /manifest/);
    assert.equal(readFileSync(log, "utf8").trim().split("\n").length, 2);
    assert.throws(() => evalImprovement({ dataDir: r, log, selfTest: okTest }), /improvement/);
  } finally { rmSync(r, { recursive: true, force: true }); }
});
