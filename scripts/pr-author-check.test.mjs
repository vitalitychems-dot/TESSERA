import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  OWNER_EMAIL,
  authorLogArgs,
  evaluateAuthorCommit,
  readAuthorCommits,
  renderAuthorReport,
} from "./pr-author-check.mjs";

const fixturePath = fileURLToPath(new URL("./fixtures/pr-author-check.json", import.meta.url));

function person(name, email = OWNER_EMAIL) {
  return { name, email };
}

function commit(sha, author, committer = author) {
  return { sha, author, committer };
}

test("the owner email with a non-Tessera name passes", () => {
  const result = evaluateAuthorCommit(commit(
    "a".repeat(40),
    person("vitalitychems-dot"),
    person("vitalitychems-dot"),
  ));
  assert.deepEqual(result.flags, []);
});

test("the name Tessera fails for the author or the committer", () => {
  const author = evaluateAuthorCommit(commit(
    "b".repeat(40),
    person("Tessera"),
    person("vitalitychems-dot"),
  ));
  assert.deepEqual(author.flags, [{ code: "tessera-name", detail: "author" }]);

  const committer = evaluateAuthorCommit(commit(
    "c".repeat(40),
    person("vitalitychems-dot"),
    person("  TESSERA  "),
  ));
  assert.deepEqual(committer.flags, [{ code: "tessera-name", detail: "committer" }]);

  const nearby = evaluateAuthorCommit(commit(
    "d".repeat(40),
    person("Tessera Bot"),
    person("Tessera Bot"),
  ));
  assert.equal(nearby.flags.some((flag) => flag.code === "tessera-name"), false);
});

test("any other email fails even when the name is allowed", () => {
  const author = evaluateAuthorCommit(commit(
    "e".repeat(40),
    person("Einstein (Grok Bot)", "vitalitychems-dot@users.noreply.github.com"),
    person("vitalitychems-dot"),
  ));
  assert.deepEqual(author.flags, [{ code: "email", detail: "author" }]);

  const committer = evaluateAuthorCommit(commit(
    "f".repeat(40),
    person("vitalitychems-dot"),
    person("GitHub", "noreply@github.com"),
  ));
  assert.deepEqual(committer.flags, [{ code: "email", detail: "committer" }]);

  const cursor = evaluateAuthorCommit(commit(
    "1".repeat(40),
    person("Cursor Agent", "cursoragent@cursor.com"),
  ));
  assert.deepEqual(cursor.flags.map((flag) => flag.code), ["email", "email"]);
});

test("a flagged commit fails the report", () => {
  const bad = renderAuthorReport([evaluateAuthorCommit(commit("a".repeat(40), person("Tessera")))]);
  assert.equal(bad.exitCode, 1);
  assert.match(bad.text, /tessera-name author/);
  assert.match(bad.summary, /## Pull request author check/);
  const good = renderAuthorReport([
    evaluateAuthorCommit(commit("b".repeat(40), person("vitalitychems-dot"))),
  ]);
  assert.equal(good.exitCode, 0);
  assert.match(good.text, /flagged: 0/);
});

test("cli fixture exits 1 and an unknown range fails closed", () => {
  const script = fileURLToPath(new URL("./pr-author-check.mjs", import.meta.url));
  const summaryDir = mkdtempSync(join(tmpdir(), "tessera-author-"));
  const summary = join(summaryDir, "summary.md");
  writeFileSync(summary, "");
  const flagged = spawnSync(process.execPath, [script, "--fixture", fixturePath], {
    encoding: "utf8",
    env: { ...process.env, GITHUB_ACTIONS: "true", GITHUB_STEP_SUMMARY: summary },
  });
  assert.equal(flagged.status, 1, flagged.stdout);
  assert.match(flagged.stdout, /tessera-name author/);
  assert.equal(readFileSync(summary, "utf8").includes(OWNER_EMAIL), true);

  const dir = mkdtempSync(join(tmpdir(), "tessera-author-repo-"));
  const git = (args, env) => {
    const result = spawnSync("git", args, { cwd: dir, encoding: "utf8", env: { ...process.env, ...env } });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(["init", "-b", "main"]);
  const ownerEnv = {
    GIT_AUTHOR_NAME: "vitalitychems-dot",
    GIT_AUTHOR_EMAIL: OWNER_EMAIL,
    GIT_COMMITTER_NAME: "vitalitychems-dot",
    GIT_COMMITTER_EMAIL: OWNER_EMAIL,
  };
  writeFileSync(join(dir, "README.md"), "base\n");
  git(["add", "README.md"], ownerEnv);
  git(["commit", "-m", "base"], ownerEnv);
  const base = git(["rev-parse", "HEAD"]);
  writeFileSync(join(dir, "README.md"), "head\n");
  git(["add", "README.md"], ownerEnv);
  git(["commit", "-m", "head"], ownerEnv);
  const head = git(["rev-parse", "HEAD"]);
  const commits = readAuthorCommits(base, head, dir);
  assert.equal(commits.length, 1);
  assert.deepEqual(evaluateAuthorCommit(commits[0]).flags, []);
  const args = authorLogArgs(base, head);
  assert.equal(args.includes("push"), false);
  assert.equal(args[0], "log");

  const clean = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, BASE_SHA: base, HEAD_SHA: head },
    cwd: dir,
  });
  // The script reads the workspace repository, not cwd. The library call above
  // already covered the temp repository. This invocation checks a missing range
  // fails closed.
  assert.equal(clean.status, 1);
});
