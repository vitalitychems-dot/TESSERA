import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { attemptMerge, reviewMerge } from "../src/studio/merge-gate.mjs";
import { git, initFixtureRepo } from "../src/studio/worktree.mjs";

test("merge is refused without approval and when main is dirty", () => {
  assert.deepEqual(reviewMerge({ approved: false, testsPassed: true, mainDirty: false }), {
    ok: false,
    reason: "not-approved",
  });
  assert.deepEqual(reviewMerge({ approved: true, testsPassed: true, mainDirty: true }), {
    ok: false,
    reason: "dirty-main",
  });
  assert.deepEqual(reviewMerge({ approved: true, testsPassed: true, mainDirty: false }), {
    ok: true,
    reason: "approved",
  });
});

test("a fixture repo merges a task branch only after approval on a clean main", () => {
  const root = mkdtempSync(join(tmpdir(), "v2-merge-"));
  const repo = join(root, "repo");
  mkdirSync(repo);
  try {
    initFixtureRepo(repo);
    git(repo, ["checkout", "-q", "-b", "task/draft"]);
    writeFileSync(join(repo, "note.txt"), "task\n");
    git(repo, ["add", "note.txt"]);
    git(repo, ["commit", "-qm", "task"]);
    git(repo, ["checkout", "-q", "main"]);
    writeFileSync(join(repo, "dirty.txt"), "unsaved\n");
    const dirty = attemptMerge(repo, { approved: true, testsPassed: true, branch: "task/draft" });
    assert.deepEqual(dirty, { ok: false, reason: "dirty-main" });
    rmSync(join(repo, "dirty.txt"), { force: true });
    const held = attemptMerge(repo, { approved: false, testsPassed: true, branch: "task/draft" });
    assert.deepEqual(held, { ok: false, reason: "not-approved" });
    const merged = attemptMerge(repo, { approved: true, testsPassed: true, branch: "task/draft" });
    assert.deepEqual(merged, { ok: true, reason: "merged" });
    const log = git(repo, ["log", "--oneline"]);
    assert.match(log.stdout, /approve merge/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
