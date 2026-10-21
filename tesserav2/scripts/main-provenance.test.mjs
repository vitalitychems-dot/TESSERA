import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { workflowPath } from "./workflow-path.mjs";
import { fileURLToPath } from "node:url";
import {
  evaluateCommit,
  evaluateLiveCommits,
  gitLogArgs,
  loadPulls,
  parseGitLog,
  pullsUrl,
  renderReport,
} from "./main-provenance.mjs";

const fixturePath = fileURLToPath(new URL("./fixtures/main-provenance.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const byId = Object.fromEntries(fixture.map((commit) => [commit.id, commit]));

function codes(commit) {
  return evaluateCommit(commit).flags.map((flag) => flag.code);
}

test("a commit that arrived through a merged pull request passes", () => {
  const result = evaluateCommit(byId["merged-pr"]);
  assert.deepEqual(result.flags, []);
});

test("a direct push is flagged", () => {
  const result = evaluateCommit(byId["direct-push"]);
  assert.deepEqual(codes(byId["direct-push"]), ["not-merged-pr"]);
  assert.equal(result.flags[0].detail, "no merged pull request");
});

test("an associated pull request that is not merged is flagged", () => {
  const result = evaluateCommit({
    ...byId["merged-pr"],
    sha: "f".repeat(40),
    pulls: [{ number: 4, merged_at: null, merged: false, state: "open" }],
  });
  assert.deepEqual(result.flags.map((flag) => flag.code), ["not-merged-pr"]);
});

test("author or committer name Tessera is flagged", () => {
  const author = evaluateCommit(byId["tessera-author"]);
  assert.deepEqual(author.flags.map((flag) => flag.code), ["tessera-name"]);
  assert.equal(author.flags[0].detail, "author");

  const committer = evaluateCommit({
    ...byId["merged-pr"],
    sha: "a".repeat(40),
    committer: { name: "  TESSERA  ", email: "ada@example.com" },
  });
  assert.deepEqual(committer.flags, [{ code: "tessera-name", detail: "committer" }]);

  const nearby = evaluateCommit({
    ...byId["merged-pr"],
    author: { name: "Tessera Bot", email: "ada@example.com" },
  });
  assert.deepEqual(nearby.flags, []);
});

test("a gmail author or committer email is flagged", () => {
  const author = evaluateCommit(byId["gmail-author"]);
  assert.deepEqual(author.flags, [{ code: "gmail-email", detail: "author" }]);

  const committer = evaluateCommit({
    ...byId["merged-pr"],
    committer: { name: "Ada Lovelace", email: "Ada+notes@GMAIL.com" },
  });
  assert.deepEqual(committer.flags, [{ code: "gmail-email", detail: "committer" }]);

  const lookalike = evaluateCommit({
    ...byId["merged-pr"],
    author: { name: "Ada Lovelace", email: "ada@gmail.com.example" },
  });
  assert.deepEqual(lookalike.flags, []);
});

test("a Manus mark in the author, committer, or message is flagged", () => {
  const message = evaluateCommit(byId["manus-message"]);
  assert.deepEqual(message.flags, [{ code: "manus-mark", detail: "message" }]);

  const author = evaluateCommit({
    ...byId["merged-pr"],
    author: { name: "Manus", email: "ada@example.com" },
  });
  assert.ok(author.flags.some((flag) => flag.code === "manus-mark" && flag.detail === "author name"));

  const committer = evaluateCommit({
    ...byId["merged-pr"],
    committer: { name: "Ada Lovelace", email: "manus-bot@example.com" },
  });
  assert.ok(committer.flags.some((flag) => flag.code === "manus-mark" && flag.detail === "committer email"));
});

test("fixture report stays exit 0 until enforce is on", () => {
  const results = fixture.map((commit) => evaluateCommit(commit));
  const off = renderReport(results, { enforce: false });
  assert.equal(off.exitCode, 0);
  assert.equal(off.ok, false);
  assert.match(off.text, /aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ok/);
  assert.match(off.text, /bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb not-merged-pr/);
  assert.match(off.text, /cccccccccccccccccccccccccccccccccccccccc tessera-name author/);
  assert.match(off.text, /dddddddddddddddddddddddddddddddddddddddd gmail-email author/);
  assert.match(off.text, /eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee manus-mark message/);
  assert.match(off.summary, /## Main provenance/);
  assert.ok(off.annotations.every((line) => line.startsWith("::warning::")));

  const on = renderReport(results, { enforce: true });
  assert.equal(on.exitCode, 1);
  const clean = renderReport([evaluateCommit(byId["merged-pr"])], { enforce: true });
  assert.equal(clean.exitCode, 0);
});

test("pulls lookup is a GET and an api error is not called a direct push", async () => {
  const sha = "a".repeat(40);
  const seen = [];
  const loaded = await loadPulls(sha, {
    repository: "vitalitychems-dot/TESSERA",
    token: "test-token",
    fetchImpl: async (url, options) => {
      seen.push({ url, method: options.method, authorization: options.headers.Authorization });
      return { ok: true, json: async () => [{ number: 9, merged_at: "2026-10-01T00:00:00Z" }] };
    },
  });
  assert.equal(seen[0].method, "GET");
  assert.equal(seen[0].url, pullsUrl("vitalitychems-dot/TESSERA", sha));
  assert.equal(seen[0].authorization, "Bearer test-token");
  assert.equal(loaded.error, null);

  const missing = await loadPulls(sha, { repository: "vitalitychems-dot/TESSERA", token: "" });
  const result = evaluateCommit({
    sha,
    author: { name: "Ada", email: "ada@example.com" },
    committer: { name: "Ada", email: "ada@example.com" },
    message: "ok",
    pulls: missing.pulls,
    apiError: missing.error,
  });
  assert.deepEqual(result.flags.map((flag) => flag.code), ["pulls-api-error"]);
});

test("live evaluation flags only the commits the pulls api does not merge", async () => {
  const commits = [byId["merged-pr"], byId["direct-push"]].map(({ pulls, id, ...commit }) => commit);
  const results = await evaluateLiveCommits(commits, {
    repository: "vitalitychems-dot/TESSERA",
    token: "test-token",
    fetchImpl: async (url) => {
      const sha = url.split("/commits/")[1].split("/")[0];
      const pulls = sha.startsWith("aaa") ? [{ number: 12, merged_at: "2026-10-01T00:00:00Z" }] : [];
      return { ok: true, json: async () => pulls };
    },
  });
  assert.deepEqual(results[0].flags, []);
  assert.equal(results[1].flags[0].code, "not-merged-pr");
});

test("git log args only read history", () => {
  const args = gitLogArgs(30);
  assert.equal(args[0], "log");
  assert.equal(args.includes("push"), false);
  assert.equal(args.includes("revert"), false);
  assert.equal(args.includes("--force"), false);
  const text = [
    `${"a".repeat(40)}\nAda\nada@example.com\nAda\nada@example.com\nSubject\n\nBody line\n`,
    "",
  ].join("\0");
  const [commit] = parseGitLog(text);
  assert.equal(commit.sha, "a".repeat(40));
  assert.equal(commit.message, "Subject\n\nBody line");
});

test("cli fixture exits 0 by default and 1 when enforce is on", () => {
  const script = fileURLToPath(new URL("./main-provenance.mjs", import.meta.url));
  const summaryDir = mkdtempSync(join(tmpdir(), "tessera-provenance-"));
  const summary = join(summaryDir, "summary.md");
  writeFileSync(summary, "");
  const off = spawnSync(process.execPath, [script, "--fixture", fixturePath], {
    encoding: "utf8",
    env: { ...process.env, PROVENANCE_ENFORCE: "0", GITHUB_ACTIONS: "true", GITHUB_STEP_SUMMARY: summary },
  });
  assert.equal(off.status, 0, off.stderr);
  assert.match(off.stdout, /enforce: off/);
  assert.match(off.stdout, /flagged: 4/);
  assert.match(off.stdout, /::warning::bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb not-merged-pr/);
  assert.match(readFileSync(summary, "utf8"), /## Main provenance/);

  const on = spawnSync(process.execPath, [script, "--fixture", fixturePath], {
    encoding: "utf8",
    env: { ...process.env, PROVENANCE_ENFORCE: "1" },
  });
  assert.equal(on.status, 1, on.stdout);
});

test("provenance workflow is report-only, read-only, and pinned", () => {
  const text = readFileSync(workflowPath("main-provenance.yml"), "utf8");
  const source = readFileSync(fileURLToPath(new URL("./main-provenance.mjs", import.meta.url)), "utf8");
  assert.equal(text.includes("pull_request_target"), false);
  assert.match(text, /push:\n\s+branches: \[main\]/);
  assert.match(text, /schedule:\n\s+- cron: "0 6 \* \* \*"/);
  assert.match(text, /contents: read/);
  assert.match(text, /pull-requests: read/);
  assert.doesNotMatch(text, /contents: write/);
  assert.doesNotMatch(text, /\$\{\{\s*secrets\./);
  assert.match(text, /PROVENANCE_ENFORCE: "0"/);
  assert.match(text, /persist-credentials: false/);
  assert.match(text, /fetch-depth: 50/);
  assert.match(text, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\.0\.1/);
  assert.doesNotMatch(text, /uses:\s+\S+@v\d/);
  assert.doesNotMatch(source, /git\s+push|reset --hard|git\s+revert|--force/);
});
