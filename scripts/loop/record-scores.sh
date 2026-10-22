#!/usr/bin/env bash
# Record scores.json and findings.json on the gate-scores branch.
# When that branch exists, the new commit's parent is its current tip, so a
# normal push fast-forwards. The first publish is an orphan commit. A rejected
# push refetches and retries once. This script never force-pushes.
set -euo pipefail

keep="${SCORE_KEEP:-90}"
remote="${SCORE_REMOTE:-origin}"
branch="${SCORE_BRANCH:-gate-scores}"
sha="${GITHUB_SHA:?GITHUB_SHA is required}"
short="${sha:0:8}"

git config user.name vitalitychems-dot
git config user.email 332565808+vitalitychems-dot@users.noreply.github.com

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
cp scores.json findings.json "$stage/"

materialize_scores() {
  local value
  if value="$(git config --get core.sparseCheckout)"; then
    if [[ "$value" == "true" ]]; then
      git sparse-checkout add scores
    fi
  fi
}

prune_snapshots() {
  local files=()
  local path
  shopt -s nullglob
  for path in scores/2*.json; do
    files+=("$path")
  done
  shopt -u nullglob
  if ((${#files[@]} <= keep)); then
    return 0
  fi
  local sorted=()
  local line
  while IFS= read -r line; do
    sorted+=("$line")
  done < <(printf '%s\n' "${files[@]}" | sort)
  local drop=$((${#sorted[@]} - keep))
  # scores/ is outside the scripts/loop cone until materialize_scores. git rm
  # then deletes the worktree file, so git add cannot stage it again.
  # --ignore-unmatch covers only a path that is not in the index.
  git rm -q --ignore-unmatch -- "${sorted[@]:0:drop}"
}

write_scores() {
  mkdir -p scores
  cp "$stage/scores.json" scores/latest.json
  cp "$stage/scores.json" "scores/$(date -u +%Y%m%dT%H%M)-${short}.json"
  jq -n --arg sha "$sha" --arg at "$(date -u +%FT%TZ)" --slurpfile f "$stage/findings.json" \
    '{sha:$sha, at:$at, findings:($f[0]|length)}' > scores/heartbeat.json
  prune_snapshots
  git add --sparse scores
  git commit -m "scores: ${short}"
}

on_tip() {
  git fetch --depth 1 "$remote" "refs/heads/${branch}"
  git switch --detach FETCH_HEAD
  materialize_scores
  write_scores
}

on_orphan() {
  git switch --orphan gate-scores-new
  materialize_scores
  write_scores
}

remote_has_branch() {
  local status
  set +e
  git ls-remote --exit-code "$remote" "refs/heads/${branch}" >/dev/null
  status=$?
  set -e
  if [[ "$status" -eq 0 ]]; then
    return 0
  fi
  if [[ "$status" -eq 2 ]]; then
    return 1
  fi
  exit "$status"
}

push_head() {
  git push "$remote" "HEAD:refs/heads/${branch}"
}

if remote_has_branch; then
  on_tip
else
  on_orphan
fi

set +e
push_out="$(push_head 2>&1)"
push_status=$?
set -e
if [[ "$push_status" -ne 0 ]]; then
  if [[ "$push_out" != *non-fast-forward* && "$push_out" != *"[rejected]"* && "$push_out" != *"fetch first"* && "$push_out" != *"remote rejected"* ]]; then
    printf 'gate-scores push failed\n' >&2
    exit "$push_status"
  fi
  printf 'gate-scores push was not a fast-forward; refetching and retrying once\n' >&2
  on_tip
  push_head
fi
