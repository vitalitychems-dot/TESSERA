import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  evaluateDiff,
  isCodeownersPath,
  isGatePath,
  isGateSegment,
  isOwnerAuthor,
  isRulesPath,
  permissionLines,
  permissionLinesChanged,
  readDiff,
  renderReport,
} from "./pr-diff-scan.mjs";

const fixturePath = fileURLToPath(new URL("./fixtures/pr-diff-scan.json", import.meta.url));
const sha = (char) => char.repeat(40);

test("rules, gates, and CODEOWNERS paths are classified narrowly", () => {
  assert.equal(isRulesPath(".agents/skills/example/rules/ui.md"), true);
  assert.equal(isRulesPath("artifacts/tessera/src/pages/RulesPage.tsx"), false);
  assert.equal(isCodeownersPath(".github/CODEOWNERS"), true);
  assert.equal(isCodeownersPath("docs/not-codeowners.md"), false);
  assert.equal(isGatePath("scripts/historical-merge-gate.mjs"), true);
  assert.equal(isGatePath("artifacts/tessera/src/components/TesseractKeyGate.tsx"), true);
  assert.equal(isGatePath("artifacts/api-server/src/lib/rick-gates.ts"), true);
  assert.equal(isGateSegment("aggregate.ts"), false);
  assert.equal(isGateSegment("delegate.ts"), false);
  assert.equal(isGatePath("scripts/dev-unified.mjs"), false);
});

test("only workflow permission lines count as a permission change", () => {
  const before = "name: CI\npermissions:\n  contents: read\njobs:\n  validate:\n    steps:\n      - run: echo hi\n";
  const sameStep = before.replace("echo hi", "echo there");
  assert.equal(permissionLinesChanged(before, sameStep), false);
  assert.deepEqual(permissionLines("permissions: read-all\n"), ["permissions: read-all"]);
  const widened = before.replace("contents: read", "contents: write");
  assert.equal(permissionLinesChanged(before, widened), true);
  assert.equal(permissionLinesChanged(null, "permissions:\n  contents: read\n"), true);
  const commented = before.replace("contents: read", "contents: read\n  # note");
  assert.equal(permissionLinesChanged(before, commented), false);
});

test("a protected diff is flagged only when the author is not the owner", () => {
  const files = [{ path: "CODEOWNERS", permissionLinesChanged: false }];
  const guest = evaluateDiff({ files, authorLogin: "guest", ownerLogin: "vitalitychems-dot" });
  assert.equal(guest.flagged, true);
  assert.deepEqual(guest.touches[0].reasons, ["codeowners"]);

  const owner = evaluateDiff({ files, authorLogin: "VitalityChems-Dot", ownerLogin: "vitalitychems-dot" });
  assert.equal(owner.ownerAuthored, true);
  assert.equal(owner.flagged, false);
  assert.equal(isOwnerAuthor("", "vitalitychems-dot"), false);

  const readme = evaluateDiff({
    files: [{ path: "README.md", permissionLinesChanged: false }],
    authorLogin: "guest",
    ownerLogin: "vitalitychems-dot",
  });
  assert.equal(readme.flagged, false);
});

test("report-only mode exits 0 until enforce is on", () => {
  const flagged = evaluateDiff({
    files: [{ path: ".github/workflows/ci.yml", permissionLinesChanged: true }],
    authorLogin: "guest",
    ownerLogin: "vitalitychems-dot",
  });
  const off = renderReport(flagged, { enforce: false, authorLogin: "guest", ownerLogin: "vitalitychems-dot" });
  assert.equal(off.exitCode, 0);
  assert.equal(off.ok, false);
  assert.match(off.text, /flagged: yes/);
  assert.match(off.text, /workflow-permissions/);
  assert.ok(off.annotations.every((line) => line.startsWith("::warning::")));

  const on = renderReport(flagged, { enforce: true, authorLogin: "guest", ownerLogin: "vitalitychems-dot" });
  assert.equal(on.exitCode, 1);
  assert.ok(on.annotations.every((line) => line.startsWith("::error::")));
});

test("cli fixture stays exit 0 while enforce is off", () => {
  const script = fileURLToPath(new URL("./pr-diff-scan.mjs", import.meta.url));
  const summaryDir = mkdtempSync(join(tmpdir(), "tessera-diff-scan-"));
  const summary = join(summaryDir, "summary.md");
  writeFileSync(summary, "");
  const off = spawnSync(process.execPath, [script, "--fixture", fixturePath], {
    encoding: "utf8",
    env: { ...process.env, DIFF_SCAN_ENFORCE: "0", GITHUB_ACTIONS: "true", GITHUB_STEP_SUMMARY: summary },
  });
  assert.equal(off.status, 0, off.stderr);
  assert.match(off.stdout, /enforce: off/);
  assert.match(off.stdout, /flagged: yes/);
  assert.match(readFileSync(summary, "utf8"), /## Pull request diff scan/);

  const on = spawnSync(process.execPath, [script, "--fixture", fixturePath], {
    encoding: "utf8",
    env: { ...process.env, DIFF_SCAN_ENFORCE: "1" },
  });
  assert.equal(on.status, 1, on.stdout);
});

test("git diff reads a permission change and ignores an ordinary workflow edit", () => {
  const dir = mkdtempSync(join(tmpdir(), "tessera-diff-repo-"));
  const git = (args) => {
    const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(["init", "-b", "main"]);
  git(["config", "user.name", "vitalitychems-dot"]);
  git(["config", "user.email", "332565808+vitalitychems-dot@users.noreply.github.com"]);
  spawnSync("mkdir", ["-p", join(dir, ".github/workflows"), join(dir, ".agents/skills/demo/rules")], { encoding: "utf8" });
  writeFileSync(join(dir, ".github/workflows/ci.yml"), "name: CI\npermissions:\n  contents: read\njobs: {}\n");
  writeFileSync(join(dir, "README.md"), "before\n");
  git(["add", "."]);
  git(["commit", "-m", "base"]);
  const base = git(["rev-parse", "HEAD"]);

  writeFileSync(join(dir, ".github/workflows/ci.yml"), "name: CI\npermissions:\n  contents: read\njobs:\n  test: {}\n");
  writeFileSync(join(dir, "README.md"), "after\n");
  git(["add", "."]);
  git(["commit", "-m", "ordinary"]);
  const ordinary = git(["rev-parse", "HEAD"]);
  const ordinaryDiff = readDiff(base, ordinary, dir);
  const ordinaryResult = evaluateDiff({
    files: ordinaryDiff,
    authorLogin: "guest",
    ownerLogin: "vitalitychems-dot",
  });
  assert.equal(ordinaryResult.flagged, false);

  writeFileSync(join(dir, ".github/workflows/ci.yml"), "name: CI\npermissions:\n  contents: write\njobs: {}\n");
  writeFileSync(join(dir, ".agents/skills/demo/rules/one.md"), "rule\n");
  writeFileSync(join(dir, "CODEOWNERS"), "* @vitalitychems-dot\n");
  git(["add", "."]);
  git(["commit", "-m", "protected"]);
  const head = git(["rev-parse", "HEAD"]);
  const protectedDiff = readDiff(ordinary, head, dir);
  const protectedResult = evaluateDiff({
    files: protectedDiff,
    authorLogin: "guest",
    ownerLogin: "vitalitychems-dot",
  });
  const reasons = protectedResult.touches.flatMap((touch) => touch.reasons);
  assert.equal(protectedResult.flagged, true);
  assert.ok(reasons.includes("workflow-permissions"));
  assert.ok(reasons.includes("rules"));
  assert.ok(reasons.includes("codeowners"));
  assert.equal(base.length, 40);
  assert.equal(sha("a").length, 40);
});
