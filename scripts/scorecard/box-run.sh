#!/usr/bin/env bash
# Run the scorecard for one TESSERA PR on the box (private data never leaves the box).
# Checks out base and head in clean throwaway worktrees, runs scorecard.mjs, and posts ONE
# PR comment containing only the three aggregate before/after numbers and the verdict.
# Usage: HELDOUT_DATA=/path/to/Gitbook/evals/heldout scripts/scorecard/box-run.sh PR_NUMBER HEAD_SHA [--dry-run]
# --dry-run prints the comment instead of posting it. No secrets are read; posting uses the box's gh login.
set -euo pipefail
PR=${1:?PR number}; SHA=${2:?head sha}; DRY=${3:-}
[[ $SHA =~ ^[0-9a-f]{7,40}$ ]] || { echo "bad sha" >&2; exit 2; }
REPO=vitalitychems-dot/TESSERA
SRC=$(git rev-parse --show-toplevel)
HERE="$SRC/scripts/scorecard"
BASE_REF=$(gh pr view "$PR" -R "$REPO" --json baseRefName -q .baseRefName)
git -C "$SRC" fetch -q origin "$BASE_REF" "pull/$PR/head"
BASE=$(git -C "$SRC" merge-base "origin/$BASE_REF" "$SHA")
TMP=$(mktemp -d)
cleanup() { git -C "$SRC" worktree remove --force "$TMP/base" 2>/dev/null || true; git -C "$SRC" worktree remove --force "$TMP/head" 2>/dev/null || true; rm -rf "$TMP"; }
trap cleanup EXIT
git -C "$SRC" worktree add -q --detach "$TMP/base" "$BASE"
git -C "$SRC" worktree add -q --detach "$TMP/head" "$SHA"
# Scorecard code comes from this checkout (fixed), not from the PR under test.
set +e; OUT=$(node "$HERE/scorecard.mjs" --base "$TMP/base" --head "$TMP/head" --json); RC=$?; set -e
BODY=$(node -e '
const r = JSON.parse(process.argv[1]);
const f = (x) => (x == null ? "n/a" : x);
const lines = r.rows.map((x) => `| ${x.name} | ${f(x.base)} | ${f(x.head)} | ±${x.noise_band} | ${x.verdict} |`);
console.log([`Scorecard ${r.verdict} for head ${process.argv[2].slice(0, 8)} vs base ${process.argv[3].slice(0, 8)} (box run, aggregates only)`, "",
  "| score | before | after | noise | |", "|---|---|---|---|---|", ...lines, "",
  "consciousness_proxy is a proxy, not a measure of consciousness."].join("\n"));
' "$OUT" "$SHA" "$BASE")
if [[ $DRY == --dry-run ]]; then echo "$BODY"; else gh pr comment "$PR" -R "$REPO" --body "$BODY"; fi
exit $RC
