/**
 * Report-only provenance check for recent commits on main.
 *
 * Flags a commit when it has no merged pull request, when the author or
 * committer name is Tessera, when an author or committer email is @gmail.com,
 * or when the author, committer, or message contains a Manus mark.
 *
 * PROVENANCE_ENFORCE=1 makes flagged commits exit 1. Any other value, including
 * unset, stays report-only and exits 0. This script never pushes, reverts, or
 * rewrites history.
 *
 * Usage:
 *   node scripts/main-provenance.mjs
 *   node scripts/main-provenance.mjs --fixture scripts/fixtures/main-provenance.json
 */
import { spawnSync } from "node:child_process";
import { readFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RECENT_COMMIT_LIMIT = 30;

export function gitLogArgs(limit = RECENT_COMMIT_LIMIT) {
  return ["log", "-n", String(limit), "--format=%H%n%an%n%ae%n%cn%n%ce%n%B%x00"];
}

export function parseGitLog(text) {
  const commits = [];
  for (const chunk of text.split("\0")) {
    if (chunk.trim() === "") continue;
    const lines = chunk.replace(/^\n/, "").split("\n");
    const [sha, authorName, authorEmail, committerName, committerEmail, ...messageLines] = lines;
    commits.push({
      sha,
      author: { name: authorName ?? "", email: authorEmail ?? "" },
      committer: { name: committerName ?? "", email: committerEmail ?? "" },
      message: messageLines.join("\n").replace(/\n$/, ""),
    });
  }
  return commits;
}

export function pullsUrl(repository, sha) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("unexpected repository");
  }
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error("unexpected sha");
  return `https://api.github.com/repos/${repository}/commits/${sha}/pulls?per_page=100`;
}

function isTesseraName(name) {
  return String(name ?? "").trim().toLowerCase() === "tessera";
}

function isGmail(email) {
  const parts = String(email ?? "").trim().toLowerCase().split("@");
  return parts.length === 2 && parts[1] === "gmail.com";
}

function manusFields(commit) {
  const fields = [
    ["author name", commit.author?.name],
    ["author email", commit.author?.email],
    ["committer name", commit.committer?.name],
    ["committer email", commit.committer?.email],
    ["message", commit.message],
  ];
  return fields.filter(([, value]) => /\bmanus\b/i.test(String(value ?? ""))).map(([label]) => label);
}

function hasMergedPull(pulls) {
  return Array.isArray(pulls) && pulls.some((pull) => pull && (pull.merged_at || pull.merged === true));
}

export function evaluateCommit(commit) {
  const flags = [];
  if (commit.apiError) {
    flags.push({ code: "pulls-api-error", detail: String(commit.apiError) });
  } else if (!hasMergedPull(commit.pulls)) {
    flags.push({ code: "not-merged-pr", detail: "no merged pull request" });
  }
  if (isTesseraName(commit.author?.name)) flags.push({ code: "tessera-name", detail: "author" });
  if (isTesseraName(commit.committer?.name)) flags.push({ code: "tessera-name", detail: "committer" });
  if (isGmail(commit.author?.email)) flags.push({ code: "gmail-email", detail: "author" });
  if (isGmail(commit.committer?.email)) flags.push({ code: "gmail-email", detail: "committer" });
  for (const field of manusFields(commit)) {
    flags.push({ code: "manus-mark", detail: field });
  }
  return { sha: commit.sha, flags };
}

export function renderReport(results, { enforce }) {
  const flagged = results.filter((result) => result.flags.length > 0);
  const lines = [
    "main-provenance",
    `enforce: ${enforce ? "on" : "off"}`,
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
      annotations.push(`::warning::${result.sha} ${flag.code} ${flag.detail}`);
    }
  }
  const summary = [
    "## Main provenance",
    "",
    `Enforce: ${enforce ? "on" : "off"}`,
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
    exitCode: enforce && !ok ? 1 : 0,
  };
}

export async function loadPulls(sha, { repository, token, fetchImpl = globalThis.fetch }) {
  if (!token) return { pulls: [], error: "pulls api token missing" };
  const url = pullsUrl(repository, sha);
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "tessera-main-provenance",
    },
  });
  if (!response.ok) return { pulls: [], error: `pulls api status ${response.status}` };
  const pulls = await response.json();
  if (!Array.isArray(pulls)) return { pulls: [], error: "pulls api returned a non-array" };
  return { pulls, error: null };
}

export async function evaluateLiveCommits(commits, options) {
  const results = await Promise.all(commits.map(async (commit) => {
    const loaded = await loadPulls(commit.sha, options);
    return evaluateCommit({ ...commit, pulls: loaded.pulls, apiError: loaded.error });
  }));
  return results;
}

function enforceEnabled(env = process.env) {
  return env.PROVENANCE_ENFORCE === "1";
}

function readRecentCommits(limit) {
  const result = spawnSync("git", gitLogArgs(limit), { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || "git log failed");
  }
  return parseGitLog(result.stdout);
}

function writeReport(report) {
  process.stdout.write(report.text);
  if (process.env.GITHUB_ACTIONS === "true") {
    for (const line of report.annotations) process.stdout.write(`${line}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.summary);
  }
}

function invokedDirectly() {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

async function main() {
  const fixtureIndex = process.argv.indexOf("--fixture");
  const enforce = enforceEnabled();
  let results;
  if (fixtureIndex >= 0) {
    const commits = JSON.parse(readFileSync(process.argv[fixtureIndex + 1], "utf8"));
    results = commits.map((commit) => evaluateCommit(commit));
  } else {
    const limit = Number(process.env.PROVENANCE_COMMIT_LIMIT || RECENT_COMMIT_LIMIT);
    const commits = readRecentCommits(limit);
    results = await evaluateLiveCommits(commits, {
      repository: process.env.GITHUB_REPOSITORY,
      token: process.env.GITHUB_TOKEN || process.env.PROVENANCE_TOKEN || "",
    });
  }
  const report = renderReport(results, { enforce });
  writeReport(report);
  process.exit(report.exitCode);
}

if (invokedDirectly()) {
  main().catch((error) => {
    process.stderr.write(`main-provenance-error: ${error.message}\n`);
    process.exit(enforceEnabled() ? 1 : 0);
  });
}
