# Tessera Unified

A consolidated monorepo containing the reviewed Tessera web/API, UI preview, and shared workspace sources. It provides one dependency lockfile, suite-wide checks, and one command to start the active apps together. Historical storefront and supply-app material is documented in Gitbook but is not present as an active workspace in this staged repository.

> **No live credentials are included.** Configure secrets in the ignored `.env.local` file or in each hosting provider’s secret manager. Never commit API keys, passwords, tokens, personal records, browser profiles, or runtime databases.

## Build decision

Father decided on 2026-10-07 that Tessera will be built using the BHNMC direction, and that her intended role is the AI, and the AGI goal, that controls it. The device is not built and she does not control one now. See [docs/BHNMC.md](docs/BHNMC.md).

## Applications

| App | Location | Local URL | Notes |
| --- | --- | --- | --- |
| Tessera web | `artifacts/tessera` | `http://localhost:3000` | Main platform UI |
| Tessera API | `artifacts/api-server` | `http://localhost:5000` | Optional; the suite launcher starts it only for a loopback `DATABASE_URL` |
| UI preview sandbox | `artifacts/mockup-sandbox` | `http://localhost:5173` | Component preview |
| GitAI | `artifacts/gitai` | `http://127.0.0.1:4183` | Standalone marketplace, OpenAPI at `/api/openapi.json`, and the studio tab at `http://127.0.0.1:4173/gitai`. Same backend. GitAI credits are non-redeemable points. |
| 3D studio floor | `artifacts/v2` | `http://127.0.0.1:4173` | `pnpm --filter @workspace/v2 studio`. The 2D wall is a link on that page. |
| Tessera console | `artifacts/console` | `http://127.0.0.1:4391` | Phosphor lattice UI. One process, this port only. Does not start the other apps. |

## Theme

The phosphor lattice console is the current Tessera UI theme. The old mark picker (water, fire, lightning, diamond, spiral), the accent palette switcher, and the chat font-color picker were removed. The preview keeps one dark palette in `preview/src/styles.css`. The web app keeps the dark cyan values in `artifacts/tessera/src/index.css`.

The console does not read `TESSERA_ENABLE_*` and does not change those flags. Ports already used by other apps are 3000 (web), 5000 (API), 5173 (mockup sandbox), 4173 (studio), 4183 (GitAI), and 8787 (Gitbook HTTP). The console listens on `127.0.0.1:4391`. The bind address is fixed and is not read from the environment. `TESSERA_CONSOLE_PORT` overrides the port.

```bash
pnpm --filter @workspace/console run dev
```

## Install and run

Requirements: Node.js 22.13+ and the pnpm version declared in the root `package.json` `packageManager` field.

```bash
cp .env.example .env.local   # values remain local; .env.local is Git-ignored
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` starts the two user-facing apps above. It starts the Tessera API only when `DATABASE_URL` points to a loopback/local database; non-local database URLs are intentionally ignored by the suite launcher. The launcher reads `.env.local` without printing values.

Port overrides: `TESSERA_WEB_PORT`, `TESSERA_API_PORT`, and `MOCKUP_SANDBOX_PORT`. Base-path overrides: `TESSERA_BASE_PATH` and `MOCKUP_SANDBOX_BASE_PATH`.

Identical app files are one canonical file plus a tracked symlink. The mockup sandbox UI primitives, `use-mobile.tsx`, and `utils.ts` point at `artifacts/tessera`. Git symlink support is required; enable it when cloning on Windows.

## Workspace checks

```bash
pnpm run typecheck
pnpm test
pnpm run build
pnpm audit
pnpm run merge-gate       # fast path/duplicate/secret-shaped-path checks
pnpm run merge-gate:full  # runs the gate plus typecheck, tests, build, and audit
```

Offline and post-build eval entry points (they are not part of `pnpm test`):

```bash
pnpm --filter @workspace/api-server run eval
pnpm tsx artifacts/api-server/scripts/eval-chatbot.ts
```

`pnpm --filter @workspace/api-server run eval` runs `dist/cli/run-eval.mjs` after the API server build and needs a database. `pnpm tsx artifacts/api-server/scripts/eval-chatbot.ts` calls a live API (`EVAL_BASE_URL`, default `http://localhost:5000`).

The root test runner isolates the store test environments and runs database-backed Tessera API tests only when the dedicated `TESSERA_TEST_DATABASE_URL` points to a loopback test database. It never reuses the app’s `DATABASE_URL` as a test database. If needed, a synthetic chart fixture can be supplied as `TESSERA_TEST_FATHER_NATAL_CHART_JSON`; do not use personal chart data for tests. `pnpm run build` builds all workspace apps and does **not** run database migrations. Migrations remain explicit app-specific operations and must only target the intended database.

## Continuous integration

Workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) has one job, `validate`. On pushes and pull requests to `main` it runs, in order: frozen install, dependency audit, typecheck, schema push to a disposable database, tests, then the workspace build.

[`.github/workflows/secret-scan.yml`](.github/workflows/secret-scan.yml) runs gitleaks on pull requests and pushes to `main`. The job has `contents: read` only, checks out with `persist-credentials: false`, and does not receive repository secrets. A finding or a scanner error fails the job. [`.github/workflows/main-provenance.yml`](.github/workflows/main-provenance.yml) reports recent `main` commits that did not arrive through a merged pull request, plus Tessera names, `@gmail.com` author or committer addresses, and Manus marks. It writes a job summary and annotations. `PROVENANCE_ENFORCE` defaults to `0`, so the job exits 0 until that flag is turned on.

[`.github/workflows/pr-gates.yml`](.github/workflows/pr-gates.yml) runs on `pull_request` only. The diff scan reports a pull request that changes a `rules` path, a gate path, `CODEOWNERS`, or permission lines under `.github/workflows` when the pull request author is not the repository owner. `DIFF_SCAN_ENFORCE` defaults to `0`. The author check fails when any commit author or committer is named Tessera, or when either email is not `332565808+vitalitychems-dot@users.noreply.github.com`. If those two jobs pass, the comment job posts `ready for gate <head sha>` once and updates that comment on later runs. Only that job has `pull-requests: write`.

## Agent / mesh

Mesh-agent onboarding stays in Gitbook. Start with the [hybrid consolidation backlog](https://github.com/vitalitychems-dot/Gitbook/blob/main/intake/HYBRID-CONSOLIDATION-BACKLOG.md) and [Gitbook issue #2](https://github.com/vitalitychems-dot/Gitbook/issues/2).

## Repository organization

- `lib/` — shared workspace libraries.
- `artifacts/` — active Tessera web/API and UI-preview apps.
- `artifacts/gitbook-mcp` — MCP and local HTTP connector for the private Gitbook docs repo. Connection steps are in that package README.
- `scripts/` — suite utilities.
- `archives/source-variants/` and `archives/drive-export/` — reviewed historical code/text variants that are not active workspace packages by default.
- `docs/` — project map, secrets guidance, image-to-text transcriptions, provenance, deduplication, and validation records.
- `artifacts/api-server/src/lib/memory/` — append-only retrieval memory. It stores interactions, distills lessons, and proposes IMP rows. It does not train model weights.

The source repository and Drive inputs are listed in `Gitbook: merge/source-manifest.csv`. Current unmerged branch and open-PR gaps are disclosed in [`docs/migration-review/SOURCE-BRANCH-REVIEW.md`](docs/migration-review/SOURCE-BRANCH-REVIEW.md); not every branch-only payload is represented as merged. The protected `1T` vault was deliberately not inspected or copied. This repo uses fresh Git history; it does not import or replace original histories, branches, open reviews, or forks. All original source repositories remain unchanged. See the [consolidation record](docs/CONSOLIDATION.md) and [migration review](docs/migration-review/README.md).

## Images and text

Text-bearing source screenshots were deduplicated and OCR-transcribed where readable; the transcription is lossy and untrusted. Runtime/product images remain at the canonical paths required by the apps. The user-attached repository-switcher screenshot is represented as text in `Gitbook: review/image-text/repository-screenshot-transcription.md`; its raw copy was not needed in the repo.

## Credentials and deployment

See [`.env.example`](.env.example) and [`docs/SECRETS.md`](docs/SECRETS.md). The example file contains variable names with blank values only. Rotate credentials that may have appeared in older public repositories or histories; publishing this fresh-history repo does not remove old content from public history, caches, forks, or open refs.
