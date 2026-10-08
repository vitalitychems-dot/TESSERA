# Chronological source review and functional merge decisions

## Version order reviewed

The remaining repositories were refreshed on 2026-10-05 and reviewed in the requested historical direction:

1. `TESS` / `1` / `T44` / `5t` — repeated Tessera workspace snapshots with branch notes, audit data, runtime state, and older dependency manifests.
2. `Zz` — a later source-index/import repository containing a separate `z-app` workspace plus nested imported trees and data.
3. `Grok-ready` — the later redacted application/migration baseline; its current tree is already represented by the canonical TESSERA code and Gitbook review records.
4. `olive-giant-ever-glade` — a separate `app-builder-workspace` application exported from Grok, with independent auth, PGlite/Postgres, migrations, storefront/UI, and Vercel deployment output.
5. Handoff/archive repositories — chunked ZIP parts, screenshots, OCR inputs, coordination records, and migration notes.

## Functional merge result

The active `TESSERA` application is the canonical reviewed workspace. Its current typecheck, tests, build, production audit, and smoke test pass. The old snapshots do not provide a safe drop-in feature delta: their repeated package manifests, route trees, app shells, auth systems, and database migrations belong to alternate workspace contracts.

`Zz` is especially important to keep distinct. Its unique `artifacts/z-app` paths are not a later copy of the active `artifacts/tessera` app; they are a separate application with its own data/import structure. Copying them into the active pnpm workspace would create duplicate applications and conflicting auth/database/deployment behavior. The old theme images and generated Vercel output were intentionally omitted.

`olive-giant-ever-glade` is likewise a separate app, not a safe patch set. It remains retained because its unique code, assets, and runtime data are not fully represented in the destinations.

## Safe material moved now

Readable, non-runtime source records were moved to Gitbook under `history/recovered/`, including chronology notes, handoff records, coordination cards, migration instructions, source indexes, and exact historical versions of selected `tessera-unified` documentation/scripts. These records are historical evidence, not active agent instructions.

## Deliberately not moved

The following remain in their source repositories because moving them into an active destination would either preserve unsafe redundancy or falsely claim functional integration:

- alternate application source trees and package contracts;
- raw data, local runtime stores, browser/session material, private records, and secret-shaped files;
- chunked archives and raw screenshot/media payloads without a required visual-review decision;
- old/generated Vercel/Nitro output and build artifacts;
- duplicate or superseded theme images;
- branch-only work, unresolved PR changes, and unreviewed agent-memory notes;
- the protected `1T` vault content.

## Deletion status

Repositories are deleted only when every currently tracked file is represented in `TESSERA` or `Gitbook` by exact content, or when the repository is empty. Under that rule, eight repositories were deleted. The remaining 11 repositories are retained because their tracked content is not 100% represented.

A future deletion requires another exact coverage scan after any selected feature recovery. No source repository should be deleted merely because its application code appears old; unique data or history must also be covered or intentionally retained.
