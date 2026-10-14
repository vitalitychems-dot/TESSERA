# TESSERA

Launch checkout of the canonical vitalitychems-dot/TESSERA application. vitalitychems-dot/Gitbook supplies the launch instructions; this workspace is not a replacement source-of-truth repository.

## Run & Operate

- Start the managed `artifacts/tessera: web` and `artifacts/api-server: API Server` workflows. They supply the correct ports and base paths.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `DATABASE_URL` — PostgreSQL connection, managed by Replit. No old application data was imported.
- `TESSERACT_ADMIN_KEY` — owner unlock key, at least 16 characters, supplied through Secrets only.
- `SOVEREIGN_SESSION_SECRET` — production cookie signing secret, at least 32 characters. The launch adapter uses the existing secure `SESSION_SECRET` if the dedicated name is absent.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: Vite static frontend and esbuild ESM API bundles

## Where things live

- `artifacts/tessera` — canonical web application.
- `artifacts/api-server` — canonical API and session gates.
- `lib/db` — canonical schema; migrations are explicit and separate from builds.
- `docs/REPLIT-LAUNCH-EVIDENCE.md` — source checkpoint, verification, and remaining blockers.
- `scripts/replit-runtime-env.mjs` — launch-only environment adapter; never logs credentials.

## Architecture decisions

- Static web and API remain separate services, as instructed by Gitbook.
- Application source is imported unchanged. Local launch adaptations are confined to runtime metadata, the environment adapter, and workspace toolchain configuration.
- Protected archives, prior runtime state, and secret files are excluded.

## Product

The existing TESSERA application is owner-session gated. Do not bypass the unlock screen or claim full operation from an open health endpoint alone.

## User preferences

Launch the existing TESSERA repository using Gitbook's current instructions. Both repositories are public.

## Gotchas

- Gitbook's current mesh start-here document governs deployment-lane overlap checks, evidence, review, and release gates. No direct main pushes, unauthorized merges, or publication past outstanding gates.
- Keep `TESSERA_ENABLE_*` disabled and preserve existing diagnostics/session protections.
- Managed development commands run with the artifact directory as their working directory.
- Runtime audit/state directories are excluded from source and deploy uploads; production persistence still needs review before publication.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
