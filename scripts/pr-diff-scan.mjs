/**
 * Report-only diff scan for protected pull request changes.
 *
 * A pull request is flagged when it changes any of these and the pull request
 * author is not the repository owner:
 *   - a path with a `rules` segment
 *   - a path segment that names a gate (`merge-gate.mjs`, `KeyGate.tsx`)
 *   - a file named CODEOWNERS
 *   - permission lines in `.github/workflows/*.yml`
 *
 * DIFF_SCAN_ENFORCE=1 makes a flagged diff exit 1. Any other value, including
 * unset, stays report-only and exits 0. This script never pushes, reverts, or
 * rewrites history.
 *
 * Usage:
 *   node scripts/pr-diff-scan.mjs
 *   node scripts/pr-diff-scan.mjs --fixture scripts/fixtures/pr-diff-scan.json
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/;
const GATE_TOKEN = /(?:^|[^A-Za-z])gates?(?:[^A-Za-z]|$)/i;
const CAMEL_GATE = /[a-z]Gates?(?:[^A-Za-z]|$)/;

export function isRulesPath(path) {
  return String(path).split("/").includes("rules");
}

export function isCodeownersPath(path) {
  return String(path).split("/").at(-1) === "CODEOWNERS";
}

export function isGateSegment(segment) {
  return GATE_TOKEN.test(String(segment)) || CAMEL_GATE.test(String(segment));
}

export function isGatePath(path) {
  return String(path).split("/").some((segment) => isGateSegment(segment));
}

export function isWorkflowPath(path) {
  return WORKFLOW.test(String(path));
}

export function permissionLines(text) {
  if (text == null) return [];
  const lines = String(text).split("\n");
  const found = [];
  for (let i = 0; i < lines.length; i += 1) {
    const header = lines[i].match(/^(\s*)permissions\s*:\s*(.*?)\s*$/);
    if (!header) continue;
    found.push(lines[i].trim());
    if (header[2] !== "" && header[2] !== "|" && header[2] !== ">") continue;
    const indent = header[1].length;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() === "" || lines[j].trim().startsWith("#")) continue;
      const child = lines[j].match(/^(\s*)/);
      if (!child || child[1].length <= indent) break;
      found.push(lines[j].trim());
      i = j;
    }
  }
  return found;
}

export function permissionLinesChanged(before, after) {
  const left = permissionLines(before).join("\n");
  const right = permissionLines(after).join("\n");
  return left !== right;
}

export function pathReasons(path) {
  const reasons = [];
  if (isRulesPath(path)) reasons.push("rules");
  if (isGatePath(path)) reasons.push("gates");
  if (isCodeownersPath(path)) reasons.push("codeowners");
  return reasons;
}

export function isOwnerAuthor(authorLogin, ownerLogin) {
  const author = String(authorLogin ?? "").trim().toLowerCase();
  const owner = String(ownerLogin ?? "").trim().toLowerCase();
  return author !== "" && owner !== "" && author === owner;
}

export function evaluateDiff({ files, authorLogin, ownerLogin }) {
  const touches = [];
  for (const file of files) {
    const reasons = pathReasons(file.path);
    if (file.permissionLinesChanged) reasons.push("workflow-permissions");
    if (reasons.length > 0) touches.push({ path: file.path, reasons });
  }
  const ownerAuthored = isOwnerAuthor(authorLogin, ownerLogin);
  const flagged = touches.length > 0 && !ownerAuthored;
  return { touches, ownerAuthored, flagged };
}

export function renderReport(result, { enforce, authorLogin, ownerLogin }) {
  const lines = [
    "pr-diff-scan",
    `enforce: ${enforce ? "on" : "off"}`,
    `author: ${authorLogin || "(missing)"}`,
    `owner: ${ownerLogin || "(missing)"}`,
    `owner-authored: ${result.ownerAuthored ? "yes" : "no"}`,
    `touches: ${result.touches.length}`,
    `flagged: ${result.flagged ? "yes" : "no"}`,
  ];
  const annotations = [];
  for (const touch of result.touches) {
    const detail = `${touch.path} ${touch.reasons.join(",")}`;
    lines.push(detail);
    const level = enforce && result.flagged ? "error" : "warning";
    annotations.push(`::${level}::${detail}`);
  }
  const summary = [
    "## Pull request diff scan",
    "",
    `Enforce: ${enforce ? "on" : "off"}`,
    "",
    `Author \`${authorLogin || "(missing)"}\`. Owner \`${ownerLogin || "(missing)"}\`. Owner-authored: ${result.ownerAuthored ? "yes" : "no"}.`,
    "",
    result.touches.length === 0
      ? "No protected paths or workflow permission lines changed."
      : ["| Path | Reasons |", "| --- | --- |", ...result.touches.map((touch) => `| \`${touch.path}\` | ${touch.reasons.join(", ")} |`)].join("\n"),
    "",
  ].join("\n");
  return {
    text: `${lines.join("\n")}\n`,
    summary,
    annotations,
    ok: !result.flagged,
    exitCode: enforce && result.flagged ? 1 : 0,
  };
}

function assertSha(value, label) {
  if (!/^[0-9a-f]{40}$/i.test(String(value ?? ""))) throw new Error(`unexpected ${label}`);
}

function gitShow(cwd, sha, path) {
  const result = spawnSync("git", ["show", `${sha}:${path}`], { cwd, encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout;
}

export function readDiff(base, head, cwd = root) {
  assertSha(base, "base sha");
  assertSha(head, "head sha");
  const listed = spawnSync("git", ["diff", "--name-status", "--find-renames", base, head], {
    cwd,
    encoding: "utf8",
  });
  if (listed.status !== 0) throw new Error(listed.stderr || "git diff failed");
  const files = [];
  for (const line of listed.stdout.split("\n")) {
    if (line === "") continue;
    const parts = line.split("\t");
    const status = parts[0];
    if (status.startsWith("R") || status.startsWith("C")) {
      const oldPath = parts[1];
      const newPath = parts[2];
      const workflow = isWorkflowPath(oldPath) || isWorkflowPath(newPath);
      files.push({
        path: newPath,
        permissionLinesChanged: workflow && permissionLinesChanged(gitShow(cwd, base, oldPath), gitShow(cwd, head, newPath)),
      });
      if (oldPath !== newPath) files.push({ path: oldPath, permissionLinesChanged: false });
      continue;
    }
    const path = parts[1];
    const before = status.startsWith("A") ? null : gitShow(cwd, base, path);
    const after = status.startsWith("D") ? null : gitShow(cwd, head, path);
    files.push({
      path,
      permissionLinesChanged: isWorkflowPath(path) && permissionLinesChanged(before, after),
    });
  }
  return files;
}

function filesFromFixture(files) {
  return files.map((file) => ({
    path: file.path,
    permissionLinesChanged: Boolean(file.permissionLinesChanged) || (
      isWorkflowPath(file.path) && permissionLinesChanged(file.before ?? null, file.after ?? null)
    ),
  }));
}

function enforceEnabled(env = process.env) {
  return env.DIFF_SCAN_ENFORCE === "1";
}

function writeReport(report) {
  process.stdout.write(report.text);
  if (process.env.GITHUB_ACTIONS === "true") {
    for (const line of report.annotations) process.stdout.write(`${line}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.summary);
}

function invokedDirectly() {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

function main() {
  const enforce = enforceEnabled();
  const fixtureIndex = process.argv.indexOf("--fixture");
  let authorLogin;
  let ownerLogin;
  let files;
  if (fixtureIndex >= 0) {
    const fixture = JSON.parse(readFileSync(process.argv[fixtureIndex + 1], "utf8"));
    authorLogin = fixture.authorLogin ?? "";
    ownerLogin = fixture.ownerLogin ?? "";
    files = filesFromFixture(fixture.files ?? []);
  } else {
    authorLogin = process.env.PR_AUTHOR ?? "";
    ownerLogin = process.env.REPO_OWNER ?? "";
    files = readDiff(process.env.BASE_SHA, process.env.HEAD_SHA);
  }
  const report = renderReport(evaluateDiff({ files, authorLogin, ownerLogin }), {
    enforce,
    authorLogin,
    ownerLogin,
  });
  writeReport(report);
  process.exit(report.exitCode);
}

if (invokedDirectly()) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`pr-diff-scan-error: ${error.message}\n`);
    process.exit(enforceEnabled() ? 1 : 0);
  }
}
