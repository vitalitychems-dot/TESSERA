/**
 * Approve-only merge gate. A dirty main branch is refused even when
 * someone has approved. Agents do not merge on their own.
 */
import { git } from "./worktree.mjs";

export function reviewMerge({ approved = false, testsPassed = false, mainDirty = false } = {}) {
  if (mainDirty) return { ok: false, reason: "dirty-main" };
  if (!approved) return { ok: false, reason: "not-approved" };
  if (!testsPassed) return { ok: false, reason: "tests-failed" };
  return { ok: true, reason: "approved" };
}

export function mainIsDirty(repoDir) {
  const status = git(repoDir, ["status", "--porcelain"]);
  if (status.status !== 0) throw new Error(status.stderr || "git status failed");
  return status.stdout.trim().length > 0;
}

export function attemptMerge(repoDir, { approved = false, testsPassed = false, branch }) {
  const decision = reviewMerge({
    approved,
    testsPassed,
    mainDirty: mainIsDirty(repoDir),
  });
  if (!decision.ok) return decision;
  const merged = git(repoDir, ["merge", "--no-ff", "--no-edit", "-m", "approve merge", branch]);
  if (merged.status !== 0) return { ok: false, reason: "merge-failed", detail: merged.stderr };
  return { ok: true, reason: "merged" };
}
