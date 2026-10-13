# Self-improve loop (0-token by default)

| Piece | File | Tokens | Default |
|---|---|---|---|
| Daily scorer + issue opener | `.github/workflows/self-improve.yml`, `scripts/loop/scores.mjs`, `findings.mjs` | 0 | on (cron 09:17 UTC) |
| Weekly meta-loop (measures the loop, proposes tuning) | `.github/workflows/meta-loop.yml`, `scripts/loop/meta.mjs` | 0 | on (Mon 10:41 UTC) |
| In-runner worker (local open model) | `.github/workflows/worker.yml`, `scripts/loop/worker.mjs` | 0 paid | **off** (`TESSERA_WORKER=0`) |
| Mesh runners | `scripts/loop/runner-select.mjs` | 0 | **off** (`TESSERA_MESH_RUNNERS=0`) |
| Moderator lock | `.github/workflows/moderator-lock.yml`, `gate/` | 0 | on, fails closed |
| Dependency bumps | `.github/dependabot.yml` | 0 | on (weekly, capped) |

Agents spend tokens **only** when an open `needs-agent` issue exists. `gate-scores:scores/heartbeat.json` is the input for the dead man's switch (`deadman.yml` belongs to another lane). Scores come from the real test log and bench output in the runner, never from agent-written files.

## Loop
1. `self-improve` runs `pnpm test` and the bench 5 times, then takes the median p50.
2. It compares against `gate-scores:scores/latest.json`. A finding is a failing test, a drop in the pass count, a bench p50 more than `BENCH_TOLERANCE` (default 10%) **and** more than 0.02 ms worse, a bench path that disappeared, or a broken scorer (fail closed).
3. Each finding gets one issue, keyed by a hidden marker: created, refreshed or auto-closed when fixed.
4. `meta-loop` reads all `needs-agent` issues weekly (opened, fixed, median hours to fix, `tokens-used:` per fix) and opens or refreshes a `loop-tuning` issue with proposals. That issue is how the loop tunes itself.

## Worker
The worker picks the oldest `needs-agent` issue that has `file:` and `test:` lines, then:
- runs llama.cpp `b11583` with Qwen2.5-Coder-1.5B-Instruct Q4_K_M (1.1 GB), cached with `actions/cache`;
- falls back to GitHub Models when `WORKER_ENDPOINT` is set;
- makes best-of-4 attempts that are checked by the test, refuses locked paths, caps changes at 60 lines, and opens a PR only.

**Measured on the box** (8 CPU, 5 seeded one-line bugs, SYNTHETIC-ONLY, so not a win claim):
- Fixed 1/5, 1/5, 0/5 and 1/5 across 4 runs (best-of-1 and best-of-4, 2 reps each).
- 10–33 s per batch of 5 issues; about 350 prompt tokens per try; $0.
- Verdict: 1.5B is too weak to earn its keep. Next step: try the 7B Q4 (about 4.7 GB cache) and measure again. Stays off until it beats 3/5 on a held-out set.

## Mesh runners (design, dry-run only)
- **Default:** `ubuntu-latest`.
- **Opt in:** a mesh-node owner registers a self-hosted runner with labels `self-hosted,linux,tessera-mesh` (repo Settings → Actions → Runners) **and** Father sets `TESSERA_MESH_RUNNERS=1`.
- **Owner off-switch:**
  - per node: stop the runner service (`./svc.sh stop`); jobs then fall back to queued and time out with no work done;
  - fleet-wide: `TESSERA_MESH_OWNER_OFF=1`, which forces GitHub-hosted.
- **Queue-puller alternative (no runner registration):** a node polls `gh issue list --label needs-agent` read-only, runs `worker.mjs` locally and pushes a branch with a Build App token. Same lock, cap and gates.
- Safety: self-hosted runners must never run `pull_request` jobs from forks (Settings → Actions → "Require approval for all outside collaborators").
- Dry-run: `runner-select.mjs` → `"ubuntu-latest"` (default), `["self-hosted","linux","tessera-mesh"]` (=1), `"ubuntu-latest"` (=1 with owner off).

## Zero-token tricks: built (✅) and listed (☐)
1. ✅ `concurrency` cancel-in-progress on PR CI and moderator-lock: superseded pushes stop burning minutes.
2. ✅ Actions cache: pnpm store (`setup-node cache: pnpm`) and model cache (`actions/cache`).
3. ✅ Sparse checkout of only `gate/` or `scripts/loop/` for policy jobs: about 1 MB fetched instead of the full repo.
4. ✅ Dependabot for npm and actions, weekly, grouped, PR cap 3. Every bump runs CI automatically.
5. ✅ SHA-pinned actions (Rick #6), with Dependabot keeping the pins fresh.
6. ✅ Policy is read from the base ref, so a PR can't edit its own judge.
7. ✅ The issue marker dedupes findings into one issue each, which is auto-closed when fixed. No agent triage tokens.
8. ✅ Heartbeat file for the dead man's switch.
9. ✅ Scores are stored on an orphan branch (`gate-scores`) with the last 90 snapshots kept; main history stays clean.
10. ☐ Path filters (`paths:`) per workspace package. Not built: ci.yml is a required check, and path-filtered required checks stay "pending". Do it with a `changes` job plus a skip-success job (Build's lane, item 2).
11. ☐ Skip docs-only PRs: same caveat; use a `dorny/paths-filter`-style job output rather than `paths-ignore`.
12. ☐ Renovate (free GitHub App): better grouping and automerge-off scheduling than Dependabot. Needs Father to install the app.
13. ☐ `gh run rerun --failed` on flaky jobs only (cheap flake detection) and log flake rates into scores.
14. ☐ The test-impact map: `node --test --experimental-test-coverage` once a week to map files to tests, then run only impacted tests on PRs.
15. ☐ Ollama-free GitHub Models for the meta-loop's prose summary (free tier, `models: read`).
16. ☐ Issue forms (`.github/ISSUE_TEMPLATE`) with `file:`/`test:` fields so human-filed issues are worker-ready.
17. ☐ `workflow_run`-chained jobs instead of polling crons.
18. ✅ Artifact retention set to 7 days (self-improve) to save storage.
19. ☐ Weekly `git gc`-style compaction of `gate-scores` (squash snapshots older than 90 days into one JSONL.gz).
20. ☐ A GitHub Pages dashboard built from `gate-scores` (static, 0 tokens) for Father.
