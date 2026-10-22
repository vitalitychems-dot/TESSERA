import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createTaskWorktree, git, initFixtureRepo, pushFromWorktree, removeTaskWorktree } from "../src/studio/worktree.mjs";

test("a task worktree can be created and removed, and git push fails in its hook", () => {
  const root = mkdtempSync(join(tmpdir(), "v2-wt-"));
  const repo = join(root, "repo");
  mkdirSync(repo);
  try {
    initFixtureRepo(repo);
    const created = createTaskWorktree(repo, "draft");
    assert.equal(existsSync(join(created.path, "README.md")), true);
    const pushed = pushFromWorktree(created.path);
    assert.notEqual(pushed.status, 0);
    assert.match(pushed.stderr, /v2 agents cannot git push/);
    removeTaskWorktree(repo, "draft");
    assert.equal(existsSync(created.path), false);
    const list = git(repo, ["worktree", "list"]);
    assert.equal(list.status, 0);
    assert.equal(list.stdout.includes("draft"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
