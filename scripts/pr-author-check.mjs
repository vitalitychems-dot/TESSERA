/**
 * Fail a pull request when a commit identity is not the repository owner.
 *
 * Each commit in base..head is checked. The job fails when the author name or
 * the committer name is Tessera, or when either email is not
 * 332565808+vitalitychems-dot@users.noreply.github.com.
 *
 * Attribution: a commit authored as the shared owner account, or whose
 * committer differs from its author, or that carries a bot/app identity, must
 * name the real author in an `Original-Author:` or `Co-authored-by:` trailer.
 * The trailer may not name the owner account or Tessera. When AUTHOR_AGENTS
 * (comma-separated names) is set, the trailer name must be on that list.
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

export const OWNER_LOGIN = "vitalitychems-dot";
const TRAILER = /^(?:Original-Author|Co-authored-by):[ \t]*(.+?)[ \t]*$/gim;

export function isBotIdentity(person) {
  const name = String(person?.name ?? "").trim().toLowerCase();
  const email = String(person?.email ?? "").trim().toLowerCase();
  return name.endsWith("[bot]") || email.includes("[bot]") || email === "noreply@github.com" || name === "github";
}

export function attributionTrailers(message) {
  return [...String(message ?? "").matchAll(TRAILER)].map((m) => m[1].replace(/\s*<[^>]*>\s*$/, "").trim());
}

export function parseAgents(value) {
  return String(value ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function attributionFlags(commit, agents = []) {
  const a = commit.author ?? {};
  const c = commit.committer ?? {};
  const ownerAuthored = String(a.email ?? "") === OWNER_EMAIL || String(a.name ?? "").trim().toLowerCase() === OWNER_LOGIN;
  const differs = String(a.name ?? "") !== String(c.name ?? "") || String(a.email ?? "") !== String(c.email ?? "");
  const bot = isBotIdentity(a) || isBotIdentity(c);
  if (!ownerAuthored && !differs && !bot) return [];
  const why = [ownerAuthored && "owner-author", differs && "committer-differs", bot && "bot-identity"].filter(Boolean).join("+");
  const raw = [...String(commit.message ?? "").matchAll(TRAILER)].map((m) => m[1]);
  const names = attributionTrailers(commit.message);
  const valid = names.filter((n, i) => {
    const k = n.toLowerCase();
    if (!k || k === OWNER_LOGIN || isTesseraName(k) || raw[i].toLowerCase().includes(OWNER_LOGIN)) return false;
    return agents.length === 0 || agents.includes(k);
  });
  if (valid.length > 0) return [];
  return [{ code: names.length ? "bad-original-author" : "missing-original-author", detail: why }];
}

export function evaluateAuthorCommit(commit, agents = parseAgents(process.env.AUTHOR_AGENTS)) {
  return {
    sha: commit.sha,
    flags: [
      ...identityFlags("author", commit.author),
      ...identityFlags("committer", commit.committer),
      ...attributionFlags(commit, agents),
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
    "Owner-authored, re-committed or bot commits must name the real author in an `Original-Author:` or `Co-authored-by:` trailer.",
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
