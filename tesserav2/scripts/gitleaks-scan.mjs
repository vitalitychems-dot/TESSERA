/**
 * Fail-closed gitleaks wrapper.
 *
 * Stdout is only `file:line rule-id` lines. The secret and the match are never printed.
 * Any finding, missing report, or scanner error exits non-zero.
 *
 * Usage: node scripts/gitleaks-scan.mjs [--source dir] [--config file] [--no-git]
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function formatFindings(findings) {
  return findings.map((item) => `${item.File}:${item.StartLine} ${item.RuleID}`);
}

export function runGitleaks({ binary = "gitleaks", source, config, noGit = false }) {
  const dir = mkdtempSync(join(tmpdir(), "tessera-gitleaks-report-"));
  const report = join(dir, "report.json");
  const args = [
    "detect",
    "--source",
    source,
    "--redact",
    "--no-banner",
    "--no-color",
    "--exit-code",
    "1",
    "--report-format",
    "json",
    "--report-path",
    report,
  ];
  if (config) args.push("--config", config);
  if (noGit) args.push("--no-git");

  try {
    const result = spawnSync(binary, args, { encoding: "utf8" });
    if (result.error) {
      return { status: 127, lines: [], stderr: "gitleaks-error: scanner could not start" };
    }
    const status = result.status ?? 1;
    let findings = null;
    try {
      const parsed = JSON.parse(readFileSync(report, "utf8") || "[]");
      if (Array.isArray(parsed)) findings = parsed;
    } catch {
      findings = null;
    }
    if (!findings) {
      const exitStatus = status === 0 ? 1 : status;
      return { status: exitStatus, lines: [], stderr: `gitleaks-error: exit ${exitStatus}` };
    }
    const lines = formatFindings(findings);
    const exitStatus = findings.length > 0 ? (status === 0 ? 1 : status) : status;
    return {
      status: exitStatus,
      lines,
      stderr: findings.length === 0 && status !== 0 ? `gitleaks-error: exit ${status}` : `gitleaks findings: ${findings.length}`,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function argValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function invokedDirectly() {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (invokedDirectly()) {
  const args = process.argv.slice(2);
  const result = runGitleaks({
    binary: process.env.GITLEAKS_BIN || "gitleaks",
    source: argValue(args, "--source") || root,
    config: argValue(args, "--config") || join(root, ".gitleaks.toml"),
    noGit: args.includes("--no-git"),
  });
  if (result.lines.length > 0) process.stdout.write(`${result.lines.join("\n")}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exit(result.status);
}
