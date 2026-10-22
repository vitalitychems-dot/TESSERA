# Dry-run measurement

One real dry run of `scripts/selfbuild/selfbuild.mjs` against `fixtures/NEXT.md`. `DRY_RUN` was unset, so the runner stayed on its default. No pull request was opened and nothing was merged.

Started `2026-10-13T14:06:28.175Z`. The checkout was `/workspace`, which already had a `.git` directory. `git config --get remote.origin.partialclonefilter` printed nothing, so this checkout is not a partial clone. The runner reused it and did not clone.

GitHub `direction/NEXT.md` is not in `vitalitychems-dot/Gitbook` yet. The one `gh api` call returned `gh: Not Found (HTTP 404)`. The runner then used the local sample. The top unfinished goal was `SB-1` (rank 2). Finished item `SB-0` was skipped. `SB-2` was left queued.

## Command

```bash
env -u DRY_RUN -u SELFBUILD_BUILDER -u SELFBUILD_OFFLINE -u SELFBUILD_GOALS \
  -u SELFBUILD_DAY -u SELFBUILD_REPO -u SELFBUILD_PLAN \
  node scripts/selfbuild/selfbuild.mjs \
  --goals scripts/selfbuild/fixtures/NEXT.md \
  --repo /workspace \
  --plan /tmp/selfbuild-dry-plan.md \
  --metrics /tmp/selfbuild-metrics.json
```

Exit status 0. Stdout:

```text
dry_run=1 goal=SB-1 rank=2 api_calls=1 bytes_written=648 elapsed_ms=240 prs_opened=0 clone=reuse clone_disk_bytes=0 goals_source=local
```

## Per run

| Measure | Value |
| --- | --- |
| Time inside the runner | 240 ms |
| Wall clock around the process | 0.267077 s |
| GitHub API calls (`gh api`) | 1 |
| Plan file written | 648 bytes |
| Clone disk added | 0 bytes |
| Repository tree change | none (`git status --porcelain` matched before and after) |
| Draft pull requests opened | 0 |

The optional `--metrics` file was 564 bytes. It is the measurement record, not the plan. With that file included, this invocation wrote 1,212 bytes, all outside the repository (`/tmp`). Tests and `tools/pregate` were not run because this was a dry run. A live run (`DRY_RUN=0`) would run `pnpm test` before and after the builder, then `tools/pregate` if that file exists, and would open at most one draft pull request.
