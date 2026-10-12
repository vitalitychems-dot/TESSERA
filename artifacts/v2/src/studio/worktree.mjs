/**
 * One git worktree per task. A pre-push hook refuses network push.
 * Clean-room of the AgentCraft worktree rule: agents do not push.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: "vitalitychems-dot",
  GIT_AUTHOR_EMAIL: "332565808+vitalitychems-dot@users.noreply.github.com",
  GIT_COMMITTER_NAME: "vitalitychems-dot",
  GIT_COMMITTER_EMAIL: "332565808+vitalitychems-dot@users.noreply.github.com",
};

export function git(cwd, args) {
  try {
    const stdout = execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? "",
    };
  }
}

function must(cwd, args) {
  const result = git(cwd, args);
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  return result.stdout;
}

export function initFixtureRepo(repoDir) {
  must(repoDir, ["init", "-q", "-b", "main"]);
  writeFileSync(join(repoDir, "README.md"), "fixture\n");
  must(repoDir, ["add", "README.md"]);
  must(repoDir, ["commit", "-qm", "init"]);
  const bare = join(dirname(repoDir), "origin.git");
  must(repoDir, ["init", "--bare", "-q", bare]);
  must(repoDir, ["remote", "add", "origin", bare]);
  return { bare };
}

export function createTaskWorktree(repoDir, taskId) {
  const path = join(repoDir, ".tessera-worktrees", taskId);
  const branch = `task/${taskId}`;
  mkdirSync(join(repoDir, ".tessera-worktrees"), { recursive: true });
  must(repoDir, ["worktree", "add", "-q", "-b", branch, path, "HEAD"]);
  const commonRaw = must(path, ["rev-parse", "--git-common-dir"]).trim();
  const common = resolve(path, commonRaw);
  const hookPath = join(common, "hooks", "pre-push");
  mkdirSync(dirname(hookPath), { recursive: true });
  writeFileSync(hookPath, "#!/bin/sh\necho \"v2 agents cannot git push\" >&2\nexit 1\n", { mode: 0o755 });
  return { path, branch, hookPath };
}

export function removeTaskWorktree(repoDir, taskId) {
  const path = join(repoDir, ".tessera-worktrees", taskId);
  must(repoDir, ["worktree", "remove", "--force", path]);
  must(repoDir, ["branch", "-D", `task/${taskId}`]);
}

export function pushFromWorktree(worktreePath) {
  return git(worktreePath, ["push", "-u", "origin", "HEAD"]);
}
