/**
 * Fail a pull request when a commit identity is not the repository owner.
 *
 * Each commit in base..head is checked. The job fails when the author name or
 * the committer name is Tessera, or when either email is not
 * 332565808+vitalitychems-dot@users.noreply.github.com.
 *
 * Usage:
 *   node scripts/pr-author-check.mjs
 *   node scripts/pr-author-check.mjs --fixture scripts/fixtures/pr-author-check.json
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseGitLog } from "./main-provenance.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const OWNER_EMAIL = "332565808+vitalitychems-dot@users.noreply.github.com";

export function isTesseraName(name) {
  return String(name ?? "").trim().toLowerCase() === "tessera";
}

export function identityFlags(role, person) {
  const flags = [];
  if (isTesseraName(person?.name)) flags.push({ code: "tessera-name", detail: role });
  if (String(person?.email ?? "") !== OWNER_EMAIL) flags.push({ code: "email", detail: role });
  return flags;
}

export function evaluateAuthorCommit(commit) {
  return {
    sha: commit.sha,
    flags: [
      ...identityFlags("author", commit.author),
      ...identityFlags("committer", commit.committer),
    ],
  };
}

export function renderAuthorReport(results) {
  const flagged = results.filter((result) => result.flags.length > 0);
  const lines = [
    "pr-author-check",
    `commits: ${results.length}`,
    `flagged: ${flagged.length}`,
  ];
  const annotations = [];
  for (const result of results) {
    if (result.flags.length === 0) {
      lines.push(`${result.sha} ok`);
      continue;
    }
    for (const flag of result.flags) {
      lines.push(`${result.sha} ${flag.code} ${flag.detail}`);
      annotations.push(`::error::${result.sha} ${flag.code} ${flag.detail}`);
    }
  }
  const summary = [
    "## Pull request author check",
    "",
    `Required email \`${OWNER_EMAIL}\`. The name Tessera fails the check.`,
    "",
    "| Commit | Result |",
    "| --- | --- |",
    ...results.map((result) => {
      const cell = result.flags.length === 0
        ? "ok"
        : result.flags.map((flag) => `${flag.code} (${flag.detail})`).join(", ");
      return `| \`${result.sha}\` | ${cell} |`;
    }),
    "",
  ].join("\n");
  const ok = flagged.length === 0;
  return {
    text: `${lines.join("\n")}\n`,
    summary,
    annotations,
    ok,
    exitCode: ok ? 0 : 1,
  };
}

function assertSha(value, label) {
  if (!/^[0-9a-f]{40}$/i.test(String(value ?? ""))) throw new Error(`unexpected ${label}`);
}

export function authorLogArgs(base, head) {
  assertSha(base, "base sha");
  assertSha(head, "head sha");
  return ["log", "--reverse", `${base}..${head}`, "--format=%H%n%an%n%ae%n%cn%n%ce%n%B%x00"];
}

export function readAuthorCommits(base, head, cwd = root) {
  const result = spawnSync("git", authorLogArgs(base, head), { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "git log failed");
  return parseGitLog(result.stdout);
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
  const fixtureIndex = process.argv.indexOf("--fixture");
  const commits = fixtureIndex >= 0
    ? JSON.parse(readFileSync(process.argv[fixtureIndex + 1], "utf8"))
    : readAuthorCommits(process.env.BASE_SHA, process.env.HEAD_SHA);
  const report = renderAuthorReport(commits.map((commit) => evaluateAuthorCommit(commit)));
  writeReport(report);
  process.exit(report.exitCode);
}

if (invokedDirectly()) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`pr-author-check-error: ${error.message}\n`);
    process.exit(1);
  }
}
