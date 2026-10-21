# HEALTH

Real results from running the repo's own scripts on the box. Tracked in [issue #3](https://github.com/collink1007/tesserav2/issues/3).

Environment: Node v22.23.4 (nvm), pnpm 11.25.0 (corepack), Linux. No servers started. No `.env.local`, so the database-backed API suite is skipped by design.

## Baseline (2026-10-21 10:42 CT, commit 9f89b30)

| Step | Command | Result |
|---|---|---|
| Install | `pnpm install --frozen-lockfile --ignore-scripts` | PASS: 824 packages, lockfile up to date, 15 workspace projects |
| Typecheck | `pnpm run typecheck` | PASS: `tsc --build` plus 5 package typechecks (api-server, gitbook-mcp, mockup-sandbox, tessera, scripts), 0 errors |
| Tests | `pnpm test` | FAIL: 407 tests, 401 pass, 5 fail, 1 skipped; 2 of 7 suite commands fail |

Per suite:

| Suite | Tests | Pass | Fail | Skip |
|---|---|---|---|---|
| Suite safety policy (`@workspace/scripts`) | 166 | 162 | 3 | 1 |
| Tessera console | 3 | 3 | 0 | 0 |
| Gitbook MCP | 30 | 30 | 0 | 0 |
| TESSERA v2 (`@workspace/v2`) | 170 | 168 | 2 | 0 |
| GitAI | 28 | 28 | 0 | 0 |
| API boot without database | 5 | 5 | 0 | 0 |
| API integration (needs `TESSERA_TEST_DATABASE_URL`) | skipped | | | |
| Learning memory | 5 | 5 | 0 | 0 |

### Failure categories

1. **CI workflows moved to `.github/workflows-pending/`** (3 failures, ENOENT). The tests read `.github/workflows/*.yml`, which was moved because the box GitHub login lacks the `workflow` scope (see CHANGES #1).
   - `scripts/gitleaks-scan.test.mjs:77` reads `secret-scan.yml`
   - `scripts/main-provenance.test.mjs:198` reads `main-provenance.yml`
   - `scripts/ready-for-gate-comment.test.mjs:134` reads `pr-gates.yml`
2. **Excluded `archive/from-gitbook/`** (2 failures, ENOENT). The ~403 MB Gitbook archive was left out of v2 (see `docs/EXCLUDED.md`).
   - `artifacts/v2/test/v2-020-file-mesh.test.mjs:5`, via `artifacts/v2/src/offline/file-mesh.mjs:19`
   - `artifacts/v2/test/v2-029-offline-internet.test.mjs:5`

### Gaps (not failures)

- `artifacts/nextgen`, `artifacts/v3`, `research/mesh-moltbook` have test scripts but are not in `scripts/test-unified.mjs`, so `pnpm test` does not run them.
- `preview/src/lib/tessera/tessera-paths.ts` also points at `archive/from-gitbook`.

## After fixes (2026-10-21 10:44 CT, CHANGES #3 and #4)

| Step | Result |
|---|---|
| Install | PASS (unchanged) |
| Typecheck | PASS, 0 errors (unchanged) |
| Tests | **PASS**: 408 tests, 405 pass, 0 fail, 3 skipped; 7 of 7 suite commands pass |

Skips, all honest and labeled:
- `scripts/historical-merge-gate.test.mjs` (PR 315 check): PR 315 commits are not in this clone (was already skipped).
- `artifacts/v2/test/v2-020-file-mesh.test.mjs` and `v2-029-offline-internet.test.mjs`: `archive/from-gitbook` is excluded. They run again automatically if the archive is restored. A new test covers the no-archive path.

Not yet covered:
- **API integration suite** (`@workspace/api-server test:db`) needs a local Postgres in `TESSERA_TEST_DATABASE_URL`; it has not run.
- Outside `pnpm test`, run by hand: `@workspace/nextgen` 4/4, `@workspace/v3` 8/8, `research/mesh-moltbook` 20/20 pass.
- CI workflows still live in `.github/workflows-pending/` until the push login has the `workflow` scope.
