# Tessera Unified

A consolidated monorepo containing the reviewed Tessera web/API, UI preview, and shared workspace sources. It provides one dependency lockfile, suite-wide checks, and one command to start the active apps together. Historical storefront and supply-app material is documented in Gitbook but is not present as an active workspace in this staged repository.

> **No live credentials are included.** Configure secrets in the ignored `.env.local` file or in each hosting provider’s secret manager. Never commit API keys, passwords, tokens, personal records, browser profiles, or runtime databases.

## Applications

| App | Location | Local URL | Notes |
| --- | --- | --- | --- |
| Tessera web | `artifacts/tessera` | `http://localhost:3000` | Main platform UI |
| Tessera API | `artifacts/api-server` | `http://localhost:5000` | Optional; the suite launcher starts it only for a loopback `DATABASE_URL` |
| UI preview sandbox | `artifacts/mockup-sandbox` | `http://localhost:5173` | Component preview |

## Install and run

Requirements: Node.js 22.13+ and the pnpm version declared in the root `package.json` `packageManager` field.

```bash
cp .env.example .env.local   # values remain local; .env.local is Git-ignored
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` starts the two user-facing apps above. It starts the Tessera API only when `DATABASE_URL` points to a loopback/local database; non-local database URLs are intentionally ignored by the suite launcher. The launcher reads `.env.local` without printing values.

Port overrides: `TESSERA_WEB_PORT`, `TESSERA_API_PORT`, and `MOCKUP_SANDBOX_PORT`. Base-path overrides: `TESSERA_BASE_PATH` and `MOCKUP_SANDBOX_BASE_PATH`.

Some identical app files are shared through tracked symlinks to canonical copies (52 UI primitives, 147 duplicate image contents, eight repeated SQL migrations, and five identical utility modules). Git symlink support is required; enable it when cloning on Windows. The detailed SHA-256 disposition ledger records removed, linked, and deliberately retained copies.

## Workspace checks

```bash
pnpm run typecheck
pnpm test
pnpm run build
pnpm audit
```

The root test runner isolates the store test environments and runs database-backed Tessera API tests only when the dedicated `TESSERA_TEST_DATABASE_URL` points to a loopback test database. It never reuses the app’s `DATABASE_URL` as a test database. If needed, a synthetic chart fixture can be supplied as `TESSERA_TEST_FATHER_NATAL_CHART_JSON`; do not use personal chart data for tests. `pnpm run build` builds all workspace apps and does **not** run database migrations. Migrations remain explicit app-specific operations and must only target the intended database.

## Repository organization

- `lib/` — shared workspace libraries.
- `artifacts/` — active Tessera web/API and UI-preview apps.
- `modal/` and `scripts/` — GPU tasks and suite utilities.
- `archives/source-variants/` and `archives/drive-export/` — reviewed historical code/text variants that are not active workspace packages by default.
- `docs/` — project map, secrets guidance, image-to-text transcriptions, provenance, deduplication, and validation records.

The source repository and Drive inputs are listed in [`docs/migration-review/source-manifest.csv`](docs/migration-review/source-manifest.csv). Current unmerged branch and open-PR gaps are disclosed in [`docs/migration-review/SOURCE-BRANCH-REVIEW.md`](docs/migration-review/SOURCE-BRANCH-REVIEW.md); not every branch-only payload is represented as merged. The protected `1T` vault was deliberately not inspected or copied. This repo uses fresh Git history; it does not import or replace original histories, branches, open reviews, or forks. All original source repositories remain unchanged. See the [consolidation record](docs/CONSOLIDATION.md) and [migration review](docs/migration-review/README.md).

## Images and text

Text-bearing source screenshots were deduplicated and OCR-transcribed where readable; the transcription is lossy and untrusted. Runtime/product images remain at the canonical paths required by the apps. The user-attached repository-switcher screenshot is represented as text in [`docs/image-text/repository-screenshot-transcription.md`](docs/image-text/repository-screenshot-transcription.md); its raw copy was not needed in the repo.

## Credentials and deployment

See [`.env.example`](.env.example) and [`docs/SECRETS.md`](docs/SECRETS.md). The example file contains variable names with blank values only. Rotate credentials that may have appeared in older public repositories or histories; publishing this fresh-history repo does not remove old content from public history, caches, forks, or open refs.
