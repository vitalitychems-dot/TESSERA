import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { formatFindings, runGitleaks } from "./gitleaks-scan.mjs";
import { workflowPath } from "./workflow-path.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

test("finding lines are file, line, and rule id", () => {
  const lines = formatFindings([
    { File: "src/app.ts", StartLine: 12, RuleID: "github-pat", Secret: "hidden-value", Match: "hidden-value" },
  ]);
  assert.deepEqual(lines, ["src/app.ts:12 github-pat"]);
  assert.equal(lines.join("\n").includes("hidden-value"), false);
});

test("a scanner finding fails and does not print the secret", () => {
  const dir = mkdtempSync(join(tmpdir(), "tessera-gitleaks-fake-"));
  const binary = join(dir, "gitleaks");
  writeFileSync(
    binary,
    `#!/usr/bin/env node
const report = process.argv[process.argv.indexOf("--report-path") + 1];
const fs = require("fs");
fs.writeFileSync(report, JSON.stringify([{ File: "leak.txt", StartLine: 4, RuleID: "github-pat", Secret: "SHOULD_NOT_PRINT", Match: "SHOULD_NOT_PRINT" }]));
process.exit(1);
`,
  );
  chmodSync(binary, 0o755);
  const result = runGitleaks({ binary, source: dir, noGit: true });
  assert.equal(result.status, 1);
  assert.deepEqual(result.lines, ["leak.txt:4 github-pat"]);
  assert.equal(`${result.lines.join("\n")}\n${result.stderr}`.includes("SHOULD_NOT_PRINT"), false);
});

test("a clean scanner report passes", () => {
  const dir = mkdtempSync(join(tmpdir(), "tessera-gitleaks-clean-"));
  const binary = join(dir, "gitleaks");
  writeFileSync(
    binary,
    `#!/usr/bin/env node
const report = process.argv[process.argv.indexOf("--report-path") + 1];
require("fs").writeFileSync(report, "[]");
process.exit(0);
`,
  );
  chmodSync(binary, 0o755);
  const result = runGitleaks({ binary, source: dir, noGit: true });
  assert.equal(result.status, 0);
  assert.deepEqual(result.lines, []);
});

test("a scanner error with no report fails closed", () => {
  const dir = mkdtempSync(join(tmpdir(), "tessera-gitleaks-error-"));
  const binary = join(dir, "gitleaks");
  writeFileSync(binary, "#!/bin/sh\nexit 2\n");
  chmodSync(binary, 0o755);
  const result = runGitleaks({ binary, source: dir, noGit: true });
  assert.equal(result.status, 2);
  assert.deepEqual(result.lines, []);
  assert.match(result.stderr, /gitleaks-error: exit 2/);
});

test("gitleaks config allowlists exact secrets only", () => {
  const text = readFileSync(join(root, ".gitleaks.toml"), "utf8");
  assert.match(text, /useDefault = true/);
  assert.doesNotMatch(text, /^\s*paths\s*=/m);
  assert.match(text, /\^synthetic-colonial-secret-32xxxx\$/);
  assert.match(text, /\^synthetic-colonial-secret-32yyyy\$/);
  assert.match(text, /\^fe05a71d3e4ed7d10bf68aa4eda6dd995ec070f4\$/);
  assert.match(text, /\^phase-7-untraceable\$/);
});

test("secret-scan workflow is pinned, read-only, and secretless", () => {
  const text = readFileSync(workflowPath("secret-scan.yml"), "utf8");
  const installer = readFileSync(join(root, "scripts/install-gitleaks.sh"), "utf8");
  assert.equal(text.includes("pull_request_target"), false);
  assert.match(text, /pull_request:\n\s+branches: \[main\]/);
  assert.match(text, /push:\n\s+branches: \[main\]/);
  assert.match(text, /contents: read/);
  assert.doesNotMatch(text, /contents: write/);
  assert.doesNotMatch(text, /\$\{\{\s*secrets\./);
  assert.doesNotMatch(text, /gitleaks-action/);
  assert.match(text, /persist-credentials: false/);
  assert.match(text, /fetch-depth: 0/);
  assert.match(text, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\.0\.1/);
  assert.doesNotMatch(text, /uses:\s+\S+@v\d/);
  assert.match(installer, /VERSION=8\.30\.1/);
  assert.match(installer, /SHA256=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb/);
  assert.match(text, /551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb/);
  assert.match(installer, /sha256sum -c -/);
});

test("cli exits non-zero when the scanner is missing", () => {
  const script = fileURLToPath(new URL("./gitleaks-scan.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script, "--source", tmpdir(), "--no-git"], {
    encoding: "utf8",
    env: { ...process.env, GITLEAKS_BIN: join(tmpdir(), "missing-gitleaks-binary"), PATH: "" },
  });
  assert.notEqual(result.status, 0);
  assert.equal((result.stdout || "").includes("AKIA"), false);
});
