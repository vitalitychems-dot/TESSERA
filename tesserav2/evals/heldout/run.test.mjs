// Tests use a tiny synthetic fixture built in a temp dir; the real held-out data never enters this repo.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { verifyManifest, manifestLines, score, baselinePreds, goldPreds, normNum, resolveDir } from "./run.mjs";
import { sandboxAvailable, runPySandboxed } from "./sandbox.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ho-fx-")); mkdirSync(join(root, "data"));
  const w = (f, rows) => writeFileSync(join(root, "data", f), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  w("gsm8k.jsonl", [{ id: "g1", question: "1+1?", answer: "2" }]);
  w("humaneval.jsonl", [{ id: "H/0", prompt: "def f(x):\n", canonical_solution: "    return x + 1\n", entry_point: "f", test: "def check(c):\n    assert c(1) == 2\n" }]);
  w("mbpp.jsonl", [{ id: "m1", text: "double", code: "def d(x): return 2*x", test_list: ["assert d(2) == 4"], test_setup_code: "" }]);
  w("pr-outcomes.jsonl", [{ id: "p1", outcome: "pass" }, { id: "p2", outcome: "fail" }]);
  writeFileSync(join(root, "MANIFEST.sha256"), manifestLines(root).join("\n") + "\n");
  return root;
}
const fake = (c) => !c.includes("return None"); // used where sandbox may be missing

test("requires an explicit private data dir", () => assert.throws(() => resolveDir([], {}), /HELDOUT_DIR/));
test("manifest matches and detects tampering / missing manifest", () => {
  const r = fixture();
  try {
    assert.equal(verifyManifest(r).ok, true);
    appendFileSync(join(r, "data", "gsm8k.jsonl"), "\n");
    const v = verifyManifest(r); assert.equal(v.ok, false); assert.ok(v.bad.some((l) => l.includes("gsm8k")));
    rmSync(join(r, "MANIFEST.sha256")); assert.equal(verifyManifest(r).ok, false);
  } finally { rmSync(r, { recursive: true, force: true }); }
});
test("gold scores 1.0, baseline lower and deterministic", () => {
  const r = fixture();
  try {
    for (const [k, s] of Object.entries(score(r, goldPreds(r), { run: fake }).suites)) assert.equal(s.score, 1, k);
    const a = score(r, baselinePreds(r), { run: fake });
    assert.deepEqual(a, score(r, baselinePreds(r), { run: fake })); assert.ok(a.macro < 1);
  } finally { rmSync(r, { recursive: true, force: true }); }
});
test("normNum takes the last number", () => assert.equal(normNum("so 1,234 then 18"), 18));

const sbx = sandboxAvailable() ? {} : { skip: "bwrap unavailable here" };
test("sandbox: correct code passes, wrong code fails", sbx, () => {
  assert.equal(runPySandboxed("assert 1 + 1 == 2").ok, true);
  assert.equal(runPySandboxed("assert False").ok, false);
});
test("sandbox: no network", sbx, () => {
  assert.equal(runPySandboxed("import socket\nsocket.create_connection(('1.1.1.1', 80), 2)").ok, false);
});
test("sandbox: timeout kills runaway code", sbx, () => {
  const r = runPySandboxed("while True: pass", { timeoutMs: 1500 });
  assert.equal(r.ok, false); assert.equal(r.timedOut, true);
});
test("sandbox: no env secrets, cwd is a throwaway temp dir", sbx, () => {
  process.env.GH_TOKEN_TEST_LEAK = "x";
  try {
    assert.equal(runPySandboxed("import os\nassert 'GH_TOKEN_TEST_LEAK' not in os.environ\nassert 'heldout-sbx-' in os.getcwd()").ok, true);
  } finally { delete process.env.GH_TOKEN_TEST_LEAK; }
});
test("sandbox: filesystem is read-only outside the temp dir; home is hidden", sbx, () => {
  assert.equal(runPySandboxed("open('/usr/x-heldout','w')").ok, false);
  assert.equal(runPySandboxed("open('ok.txt','w').write('1')").ok, true);
  assert.equal(runPySandboxed("import os\nassert not os.path.exists('/home') or not os.listdir('/home')").ok, true);
});
test("sandbox: allowlist root, sensitive paths absent", sbx, () => {
  for (const p of ["/opt", "/var/lib", "/etc/passwd", "/home", "/workspace", "/cursor", "/root"])
    assert.equal(runPySandboxed(`import os\nassert not os.path.exists(${JSON.stringify(p)}) or not os.listdir(${JSON.stringify(p)})`).ok, true, p);
});
