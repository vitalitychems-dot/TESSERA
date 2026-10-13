# Self-build runner

`scripts/selfbuild/selfbuild.mjs` takes the top unfinished goal from a ranked list and, only when `DRY_RUN=0`, opens one draft pull request. The default is dry-run. A dry run writes a plan file and stops.

The goal file is `direction/NEXT.md` in `vitalitychems-dot/Gitbook`, read with `gh api`. When that call fails, or when `--offline` is set, the runner reads a local file: `--goals`, `SELFBUILD_GOALS`, `<repo>/direction/NEXT.md`, then `./direction/NEXT.md`. A sample list is `fixtures/NEXT.md`.

Goal text is data. The runner does not turn it into a shell command. The only builder command is `SELFBUILD_BUILDER`, which the operator sets. When that variable is unset, the builder is the plan writer.

## What a live run does

`DRY_RUN=0` is the live switch. Anything else, including an unset variable, stays a dry run.

1. Pick the first unchecked goal. Later goals wait for another run.
2. Reuse the checkout at `--repo` (default: this repository). If that path is already a git checkout, it is not cloned again. If the path is missing or empty, clone once with `git clone --filter=blob:none --no-tags`. If the path exists and is not a git checkout, stop. Nothing is deleted.
3. Create or reuse `selfbuild/<goal-id>-<YYYYMMDD>`. An existing branch is checked out. It is not deleted or reset.
4. Run `SELFBUILD_BUILDER` when it is set. Otherwise write the plan file only.
5. Refuse the run when the builder changes a locked path. Locked paths stay on disk and are not committed.
6. Run `pnpm test` (or `SELFBUILD_TEST_CMD`) before and after the builder. Then run `tools/pregate`, `tools/pregate.mjs`, `tools/pregate.js`, or `tools/pregate.sh` when one of those files is already present.
7. Commit as `vitalitychems-dot <332565808+vitalitychems-dot@users.noreply.github.com>`, push the branch, and open one draft pull request. The body has the before and after test counts. A second `gh pr create` in the same run is refused.

The runner never merges and never deletes a branch, a checkout, or a file.

## Locked paths

A change under any of these is refused:

- `.github/workflows/`
- `CODEOWNERS` or `.github/CODEOWNERS`
- a `rules/` or `gates/` directory
- `tools/pregate` and other gate scripts (`pregate`, `merge-gate`, a file whose name is a gate script)

## Cron line for Father

This change does not add a workflow file or a timer file. The line below is for Father to review. It is not installed.

```cron
17 4 * * * cd /srv/tessera && /usr/bin/node scripts/selfbuild/selfbuild.mjs >>/var/log/tessera-selfbuild.log 2>&1
```

Unset `DRY_RUN` keeps the job on the dry-run default, so the installed line above would only write a plan. A live draft, still with no merge, would need Father to set `DRY_RUN=0` on that line after review:

```cron
17 4 * * * cd /srv/tessera && DRY_RUN=0 /usr/bin/node scripts/selfbuild/selfbuild.mjs >>/var/log/tessera-selfbuild.log 2>&1
```

## Run

```bash
node scripts/selfbuild/selfbuild.mjs \
  --goals scripts/selfbuild/fixtures/NEXT.md \
  --repo . \
  --plan /tmp/selfbuild-plan.md \
  --metrics /tmp/selfbuild-metrics.json
```

`--offline` skips the GitHub fetch. Tests cover the offline fallback, the one-draft cap, locked-path refusal, and the dry-run default.

## Environment

| Variable | Role |
| --- | --- |
| `DRY_RUN` | Default on. Only `0` runs the live path. |
| `SELFBUILD_BUILDER` | Shell command for the live builder. Unset writes the plan only. |
| `SELFBUILD_GOALS` | Local goal file used when the GitHub fetch fails. |
| `SELFBUILD_REPO` | Checkout to reuse. |
| `SELFBUILD_REMOTE` | Clone URL used only when no checkout exists. |
| `SELFBUILD_GITBOOK_REPO` | Default `vitalitychems-dot/Gitbook`. |
| `SELFBUILD_GOALS_PATH` | Default `direction/NEXT.md`. |
| `SELFBUILD_TEST_CMD` | Default `pnpm test`. |
| `SELFBUILD_DAY` | Branch date `YYYYMMDD`. Default is the UTC day. |
| `SELFBUILD_BASE` | Pull request base. Default `main`. |
| `SELFBUILD_OFFLINE` | `1` skips `gh api`. |
