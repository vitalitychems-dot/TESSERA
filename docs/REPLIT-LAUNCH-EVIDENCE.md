# TESSERA launch verification

Status: **PREPARED / BLOCKED — not published.**

## Canonical checkpoint

- TESSERA: `vitalitychems-dot/TESSERA`, commit `4c82ce7a64b836c85695f7d14461506210b0ccf4`.
- Instructions reviewed: `vitalitychems-dot/Gitbook`, commit `fe5e86d101a7235247bb277b302443f9cbbb6847`, including the mesh start-here and SITE-005 serving guidance.
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
- Proxied `GET /api/admin/session/status`: HTTP 200, `configured:false`, `authenticated:false`.
- Browser screenshot shows the canonical locked setup screen reporting missing `TESSERACT_ADMIN_KEY`, not a substituted mockup.
- Subsequent setup-mode verification: three launch-adapter tests passed; API logs confirm the readiness gate is open and DB-backed startup is skipped. `/api/healthz` returns HTTP 200 with `db:not-configured`, owner session status remains unconfigured, and `/api/diagnostics` returns explicit HTTP 503 `database not configured`. These are setup-mode results, not proof of full system operation.

## BLOCKED / not verified

- This project has no `TESSERACT_ADMIN_KEY`. Owner unlock and real signed-in operation cannot be verified until the owner supplies it through Secrets.
- In the first DB-backed startup with no owner key, the route watchdog exited the process after repeated protected-route 503s. The API is now stable in database-optional setup mode. DB-backed readiness must be checked again after owner provisioning; the health endpoint alone does not prove full application readiness.
- Production runtime/persistence, production database behavior, and actual published URL have not been verified. No deployment exists for this project.
- Gitbook's provenance/security review and exact release approval remain outstanding. No merge or publication occurred.
- The full multi-application test suite was not run; only the active launch build and the selected canonical boot/access-control suite are reported here.
- GitHub CI and secret-scan jobs on the checkpoint did not execute because of a GitHub account billing/spending restriction. This is not passing CI or secret-scan evidence.
