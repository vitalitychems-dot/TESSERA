import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, appendFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { verifyManifest, score, baselinePreds, goldPreds, normNum } from "./run.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));

test("manifest matches committed data", () => assert.equal(verifyManifest().ok, true));
test("manifest detects tampering", () => {
  const d = mkdtempSync(join(tmpdir(), "ho-"));
  try {
    cpSync(join(HERE, "data"), d, { recursive: true });
    appendFileSync(join(d, "gsm8k.jsonl"), "\n");
    const r = verifyManifest(d, join(HERE, "MANIFEST.sha256"));
    assert.equal(r.ok, false); assert.ok(r.bad.some((l) => l.includes("gsm8k")));
  } finally { rmSync(d, { recursive: true, force: true }); }
});
test("gold answers score 100% on every suite (harness is sound)", () => {
  const r = score(goldPreds());
  for (const [k, s] of Object.entries(r.suites)) assert.equal(s.score, 1, k);
});
test("baseline is below gold and deterministic", () => {
  const a = score(baselinePreds()), b = score(baselinePreds());
  assert.deepEqual(a, b); assert.ok(a.macro < 1); assert.equal(a.suites.gsm8k.score, 0);
});
test("wrong code fails", () => {
  const p = goldPreds(); for (const k of Object.keys(p)) if (k.startsWith("HumanEval")) p[k] = "    return None\n";
  assert.equal(score(p).suites.humaneval.score, 0);
});
test("normNum takes the last number", () => assert.equal(normNum("so 1,234 then 18"), 18));
