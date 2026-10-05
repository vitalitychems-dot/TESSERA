import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { renderReport } from "./historical-merge-gate.mjs";

test("static historical merge gate is clean and names every section", () => {
  const report = renderReport({ runSuite: false });
  assert.equal(report.ok, true, report.text);
  for (const line of [
    "duplicate_workspace_roots: 0",
    "stale_app_references: 0",
    "secret_shaped_paths: 0",
    "typecheck: not-run",
    "test: not-run",
    "build: not-run",
    "audit: not-run",
  ]) {
    assert.ok(report.text.includes(line), report.text);
  }
});

test("cli exits 0 for the static report", () => {
  const script = fileURLToPath(new URL("./historical-merge-gate.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /duplicate_workspace_roots: 0/);
  assert.match(result.stdout, /audit: not-run/);
});
