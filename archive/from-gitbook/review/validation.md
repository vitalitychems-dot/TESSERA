# Validation report — staged TESSERA build

**Checked:** 2026-10-05, against the staged two-repository build. The earlier 2026-10-02 report remains in the source repository as historical provenance; this page records the current rerun.

## Environment and dependency checks

- Validation ran on Node.js 22 with pnpm 11.25.0. `pnpm install --frozen-lockfile --ignore-scripts` completed for all 9 staged workspace projects.
- `pnpm audit --prod --audit-level=high` is clean. Full-tree audit reports one high-severity transitive `braces@3.0.3` advisory through the dev-only `fast-glob` path in `@workspace/mockup-sandbox`; the advisory reports no patched version. Production dependency exposure is not affected; the advisory remains a TODO for dependency replacement or upstream remediation. **Current (TESTED 2026-10-05):** TESSERA main `5c1137fa` `pnpm-workspace.yaml` sets `auditConfig.ignoreGhsas` to GHSA-vfj7-8cjw-p6xm only, with review date 2026-11-05. That commit does not change the lockfile. The file comment still says to remove the ignore once braces ≥ 3.0.4 ships.
- The `.github/workflows/ci.yml` file parses as YAML and contains push/PR checks with read-only `contents` permission. GitHub-hosted CI has been configured but has not yet run on GitHub. **Current:** TESSERA main is `5c1137fa` (TESTED via the GitHub commit API). [Issue #2 comment 6004461185](https://github.com/vitalitychems-dot/Gitbook/issues/2#issuecomment-6004461185) reports CI run 37382015797 green on that main (REPORTED here; this page did not re-fetch the Actions log).

## Build, test, and runtime checks

- `pnpm run typecheck` passed across the active libraries, Tessera web/API, UI preview, and scripts. The absent historical `projects/*` workspace filter was removed from the root command.
- `pnpm run build` passed for the active Tessera web/API and UI preview packages. No database migrations were run by the build.
- `pnpm test` completed without failures; the suite-policy tests reported **6 passed** and the optional API integration tests were skipped because no dedicated local `TESSERA_TEST_DATABASE_URL` was configured. Historical supply/storefront packages are not active in this staged tree, so no tests for them were claimed.
- Database-backed API tests used a fresh disposable sandbox-local PostgreSQL database and a synthetic chart fixture. The runner received the dedicated `TESSERA_TEST_DATABASE_URL`; it did not reuse an app `DATABASE_URL` or production records.
- A clean `pnpm dev` smoke test has not yet been rerun after removing absent historical supply/storefront entries; run it as the next validation step. The expected active user-facing ports are 3000 and 5173; the API remains opt-in.
- Non-blocking build/dependency warnings remain: Vite reports large client chunks (the largest is about 1 MB) and the legacy Vite/Nitro build warns that module-level `use client` directives may not be preserved. Some upstream packages also emit deprecation notices; these are not current `pnpm audit` advisories and did not fail tests or builds.

## Redundancy and image-text checks

- The SHA-256 audit records 52 shared UI components and 160 repeated-store path links (147 duplicate image contents, eight SQL migrations, and five identical utility modules). Fourteen byte-identical handoff copies were removed.
- No broken symlinks were found. Six groups of duplicate regular-file content are deliberately retained for standalone licenses/source notices, editable templates, structural markers, and app-local TypeScript configs; reasons are in [`redundancy-ledger.csv`](../merge/redundancy-ledger.csv).
- OCR covers **494 unique image contents**: 466 yielded text, 17 had no confident text, six personal-record-indicator images were omitted, five small decorative images were skipped, and 98 line/item occurrences were redacted. The new 5t branch sync screenshot is represented as sanitized OCR text and a source hash; its raw image was not copied. OCR is lossy and should not be treated as authoritative.

## Credential and privacy checks

- A value-redacted high-confidence scan found no GitHub/AWS/Stripe/OpenAI/Google/Slack token patterns or private-key headers. Thirteen generic key-assignment matches were classified as environment/example placeholders; no candidate values were printed. This is a pattern scan, not a guarantee that historical credentials have been purged.
- `.env.example` values are blank; populated environment files and common key/credential files are ignored. `.env.local` is not tracked.
- Existing public business-contact fields remain unchanged as previously approved; they are not runtime keys. Rotate any credential that may have appeared in older public source or history.
- Browser profile/session data, runtime databases, unreviewed user-pasted content, path-level personal-media inventories, and protected `1T` vault content were not staged.

## Source scope and limits

The current default-branch deltas, non-main branches, and three open unreviewed `Grok-ready` PRs are enumerated in [`SOURCE-BRANCH-REVIEW.md`](source-branch-review.md). They are not claimed as integrated; the source repositories remain unchanged and undeleted pending the owner's decision. The protected `1T` repository remains uninspected. Validation does not cover every historical branch, external deployment, credential store, fork, cache, or prior public history.
