# TESSERA launch verification

Status: **PREPARED / BLOCKED — not published.**

## Canonical checkpoint

- TESSERA: `vitalitychems-dot/TESSERA`, commit `4c82ce7a64b836c85695f7d14461506210b0ccf4`.
- Instructions reviewed: `vitalitychems-dot/Gitbook`, commit `fe5e86d101a7235247bb277b302443f9cbbb6847`, including the mesh start-here and SITE-005 serving guidance.
- Rechecked current public Gitbook main at `59727301a1fc05303d82d820e73a49715f51e6f1`; the current start-here requires one owned task, an overlap check, branch/PR-only changes, and Gitbook's merge freeze.
- Both repositories are public, confirmed through anonymous GitHub API and git access.
- Sparse import selected the active web, API, shared libraries, and scripts. Protected vaults, archives, secret files, and prior runtime state were not imported.
- Git blob verification: **871 / 871 active source files match the canonical checkpoint**, excluding managed artifact metadata. No canonical application-source file was modified.
- Deployment-lane claim and overlap check: https://github.com/vitalitychems-dot/Gitbook/issues/2#issuecomment-6159727956

## Local launch adaptations

- Managed web service at `/`; API routes at `/api`; mesh WebSocket route at `/ws`.
- Static frontend output: `artifacts/tessera/dist/public`.
- API runtime: `node --import ../../scripts/replit-runtime-env.mjs --enable-source-maps ./dist/index.mjs`, with the API artifact as the working directory.
- Node 24.13.0 and the available pnpm 10.26.1 are used. The upstream pnpm 11.25.0 self-bootstrap failed in this environment; the local package-manager declaration was adjusted. Dependency installation still passed with the upstream frozen lockfile.
- Runtime adapter preserves an explicitly supplied sovereign session secret, otherwise maps the existing Replit session secret to the canonical required variable name without logging or persisting its value.
- `TESSERA_ENABLE_RICK_LOOP=0`, `TESSERA_ENABLE_COLONIAL_FALLBACK=0`, and port fallback is disabled.
- Read-only inspection found no public tables in the fresh development database; the canonical Drizzle schema was then initialized. No historical private records were migrated.
- Runtime-generated audit/state directories are excluded from source control and deployment uploads.
- Before a valid owner key is provisioned, the launch adapter omits the database connection from the API process only. This uses the canonical database-optional boot path so the setup gate stays available without starting DB-backed engines. The managed database and its secret remain intact.

## TESTED

- `pnpm install --frozen-lockfile`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed, including frontend and API production bundles. Vite reported large-bundle warnings; these were not build failures.
- Selected canonical API boot/session/security tests, with the application database environment removed from the test process: **12 files / 201 tests passed**.
  - Database-optional boot, sensitive-route gates, sovereign-engine session gates, conversation deletion owner gates, legacy engine gates, sigil authentication/chart/tool gates, colonial fail-closed behavior, Rick/Gitbook capability gates, sovereign fetch guard, and shadow-route gates.
  - Authenticated test cases use test credentials. They do not verify this project's real owner login.
- Proxied frontend: HTTP 200.
- Proxied `GET /api/healthz`: HTTP 200, `{"status":"ok","db":"configured"}`.
- After the owner set `TESSERACT_ADMIN_KEY` in Secrets, `GET /api/admin/session/status` returns HTTP 200, `configured:true`, `authenticated:false`. The secret value was not accessed or shown.
- The entry gate and “My Father Code in LUS” now accept the stable, reversible, case-preserving LUS rendering as the same single credential. Tests confirm the raw and encoded forms match the same key, another key is rejected, and malformed LUS is rejected. The display form is not encryption.
- After the first gate, the chat now prompts the owner to re-enter the same current sigil before issuance. The API verifies it in an authenticated, same-origin, rate-limited request and returns one fresh 256-bit code in LUS. The UI keeps the output out of model prompts and conversation history; the owner still must save it as the single `TESSERACT_ADMIN_KEY` and restart the API.
- The attachment-list response is now read from its actual `{ok, attachments}` envelope and validated before rendering; a rejected or malformed attachment response leaves chat available instead of taking down the page.
- The screenshot after workflow restart verifies the signed-out entry gate, not the signed-in chat or rotation prompt. A real owner session and completed rotation remain unverified.
- Initial setup-mode verification before the owner secret was supplied: three launch-adapter tests passed; API logs confirmed the database-optional boot path. These are historical setup-mode results, not proof of full system operation.
- After the final restart, all **565 / 565 startup route probes passed** and the watchdog opened the readiness gate. `/api/healthz` returns HTTP 200 with the database configured; session status returns `configured:true, authenticated:false`. Anonymous `POST /api/sigil/father/issue-code` returns HTTP 401, as required. The full diagnostics endpoint is protected and returns HTTP 401 without an owner session.

Verification after the rotation confirmation flow: three API test files / 19 tests passed, including missing/wrong/current-sigil checks, owner-session enforcement, same-origin enforcement, cross-origin rejection, and LUS-as-secret equivalence in admin-session, Father-key, and mesh token checks. API typecheck/build and frontend typecheck/build passed. An earlier five-file / 61-test run also passed.

## BLOCKED / not verified

- The Secret is configured, but its value was never read or entered by the agent. Owner unlock and live signed-in operation remain unverified. No real owner-triggered replacement was issued in this workspace.
- Gitbook currently has five open issues, plus active TESSERA PRs including a theme-cleanup PR. No issue was closed, no PR opened, and no task marked complete: the required per-task overlap/check-in and review gates have not been completed.
- Storage-backed upload/download endpoints are not verified. Their fake object-ID probes were removed from readiness checks because they do not test whether a real object exists; storage availability itself still needs testing/configuration before relying on file features.
- Production runtime/persistence, production database behavior, and actual published URL have not been verified. No deployment exists for this project.
- Gitbook's provenance/security review and exact release approval remain outstanding. Its current policy requires branches/PRs, green CI, a TESSERA build pass, Security PASS, and Moderator PASS before merge. No merge or publication occurred.
- The full multi-application test suite was not run; only the active launch build and the selected canonical boot/access-control suite are reported here.
- GitHub CI and secret-scan jobs on the checkpoint did not execute because of a GitHub account billing/spending restriction. This is not passing CI or secret-scan evidence.

## Local world-interface implementation — 2026-10-14

- `/` and `/c/:id` now use one responsive World surface: the Eye shows the authenticated API health pulse and public repository activity, the Brain shows live knowledge-corpus totals, and the existing ChatArea remains the conversation surface. The primary mobile bar is World / Board / More; the existing Universe route remains under More.
- Data sources and stated refresh cadence: `/api/healthz` every 30 seconds; `/api/knowledge-corpus/stats` every 60 seconds; public GitHub repository metadata and events for `vitalitychems-dot/TESSERA` and `vitalitychems-dot/Gitbook` every 5 minutes. The UI shows freshness, stale/error states, and does not describe GitHub snapshots as instantaneous.
- Public GitHub smoke checks returned HTTP 200 for metadata and event feeds for both repositories. At the time checked, metadata reported 8 and 9 open items respectively; GitHub's `open_issues_count` includes pull requests, so the UI labels this “open issues + PRs.”
- Verification: Tessera TypeScript check passed; production Vite build passed with the artifact's required `PORT=18514` and `BASE_PATH=/`; the web workflow restarted and Vite reported ready. The build retains the existing large-chunk advisory. Anonymous public GitHub calls succeeded.
- The screenshot browser is not signed in. Desktop and mobile captures show the Tesseract entry gate, not the signed-in World surface; one unauthorized session-status request is expected before login. The signed-in World UI and post-login rotation prompt therefore remain unverified in-browser.
- Key issuance returns a one-time LUS-form candidate only. The owner must replace the single `TESSERACT_ADMIN_KEY` Replit Secret and restart the API workflow; the existing key remains active until that restart. The agent did not read the secret value or perform an owner-triggered rotation.
- No code was pushed, no GitHub PR or issue was changed, and nothing was published. The GitBook checklist and merge gates remain outstanding; this local implementation is not a completed GitBook release.
