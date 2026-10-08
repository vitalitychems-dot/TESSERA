# Source merge report

Generated: 2026-10-03T14:23:32.715721+00:00

## Result
- Imported 5613 safe source-file references into `artifacts/z-app/imports/trees/`.
- Stored 2339 unique content objects; 2965 exact-content duplicates share those objects, and 309 exact duplicates already exist in the active Z App.
- Integrity-checked 11 ZIP sources; 2 exact duplicate ZIP snapshots were not re-imported.
- Split archives were reconstructed from `main` and CRC-checked. Image-only and screenshot-supplement ZIPs were integrity-checked but withheld pending visual review (3 archive instances).
- Retrieved the shared LFS ZIP once from repository `1`; the same pointer is listed in `1`, `5t`, `T44`, and `TESS. Only filtered source/config files were considered for import.
- Repository `1T` was not fetched.
- The active Z App was not overwritten; API Server and Canvas were left unchanged.

## Safety and exclusions
- Private/local data, ingest snapshots, vaults, credentials, generated dependencies/build output, and unreviewed media were excluded.
- Secret scanning records paths and reasons only. No secret values are stored in this report or the manifest.
- `imports/manifest.json` records source paths, hashes, deduplication targets, archive checks, and exclusion counts. Source trees use relative symlinks to one content object per SHA-256.
- In the published GitHub tree, two nested `.gitattributes` entries are regular files referencing their existing content-object blobs; this avoids GitHub's symlink restriction without changing their bytes. The other 5,302 imported source-tree links remain relative symlinks.

### Sensitive or secret-shaped paths excluded (51 recorded)
- `tessera-unified-main:.env.example` — private-path
- `tessera-unified-main:.github/workflows/ci.yml` — secret-scan
- `tessera-unified-main:archives/migration-review/legacy-ui/KnowledgeSecretsPage.tsx` — secret-scan
- `tessera-unified-main:archives/migration-review/legacy-ui/SovereignHubPage.tsx` — secret-scan
- `tessera-unified-main:archives/migration-review/legacy-ui/TesseractAGIPage.tsx` — secret-scan
- `tessera-unified-main:artifacts/api-server/scripts/convene-natal-key-conference.mjs` — secret-scan
- `tessera-unified-main:artifacts/api-server/src/lib/father-natal.ts` — secret-scan
- `tessera-unified-main:artifacts/api-server/src/lib/sovereign-session.ts` — secret-scan
- `tessera-unified-main:artifacts/tessera/src/components/KnowledgeSearch.tsx` — secret-scan
- `tessera-unified-main:artifacts/vitality-supply/src/lib/auth/server.ts` — secret-scan
- `tessera-unified-main:artifacts/vitality-supply/src/routes/login.tsx` — secret-scan
- `tessera-unified-main:docs/SECRETS.md` — private-path
- `tessera-unified-main:projects/vitality-chems-storefront/src/lib/store-api.ts` — secret-scan
- `tessera-unified-main:projects/vitality-chems-storefront/src/lib/auth/server.ts` — secret-scan
- `tessera-unified-main:projects/vitality-chems-storefront/src/routes/login.tsx` — secret-scan
- `tessera-complete-archives--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_libs/@better-auth/core+[...].mjs` — secret-scan
- `tessera-complete-archives--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_libs/pg.mjs` — secret-scan
- `tessera-complete-archives--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_ssr/login-DlC9PphP.mjs` — secret-scan
- `tessera-complete-archives--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_ssr/server-ltczWI8E.mjs` — secret-scan
- `tessera-complete-archives--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_ssr/store-api-GrUjrpd-.mjs` — secret-scan
- `tessera-complete-archives--grok-workspace_1789591148371:.vercel/output/static/assets/index-x-oBT1q4.js` — secret-scan
- `tessera-complete-archives--grok-workspace_1789591148371:.vercel/output/static/assets/routes-RWaLuMdQ.js` — secret-scan
- `tessera-complete-archives--grok-workspace_1789591148371:src/lib/auth/server.ts` — secret-scan
- `tessera-complete-archives--grok-workspace_1789591148371:src/lib/store-api.ts` — secret-scan
- `tessera-complete-archives--grok-workspace_1789591148371:src/routes/login.tsx` — secret-scan
- `tessera-grok-handoff--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_libs/@better-auth/core+[...].mjs` — secret-scan
- `tessera-grok-handoff--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_libs/pg.mjs` — secret-scan
- `tessera-grok-handoff--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_ssr/login-DlC9PphP.mjs` — secret-scan
- `tessera-grok-handoff--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_ssr/server-ltczWI8E.mjs` — secret-scan
- `tessera-grok-handoff--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_ssr/store-api-GrUjrpd-.mjs` — secret-scan
- `tessera-grok-handoff--grok-workspace_1789591148371:.vercel/output/static/assets/index-x-oBT1q4.js` — secret-scan
- `tessera-grok-handoff--grok-workspace_1789591148371:.vercel/output/static/assets/routes-RWaLuMdQ.js` — secret-scan
- `tessera-grok-handoff--grok-workspace_1789591148371:src/lib/auth/server.ts` — secret-scan
- `tessera-grok-handoff--grok-workspace_1789591148371:src/lib/store-api.ts` — secret-scan
- `tessera-grok-handoff--grok-workspace_1789591148371:src/routes/login.tsx` — secret-scan
- `tessera-grok-handoff-complete--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_libs/@better-auth/core+[...].mjs` — secret-scan
- `tessera-grok-handoff-complete--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_libs/pg.mjs` — secret-scan
- `tessera-grok-handoff-complete--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_ssr/login-DlC9PphP.mjs` — secret-scan
- `tessera-grok-handoff-complete--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_ssr/server-ltczWI8E.mjs` — secret-scan
- `tessera-grok-handoff-complete--grok-workspace_1789591148371:.vercel/output/functions/__server.func/_ssr/store-api-GrUjrpd-.mjs` — secret-scan
- `tessera-grok-handoff-complete--grok-workspace_1789591148371:.vercel/output/static/assets/index-x-oBT1q4.js` — secret-scan
- `tessera-grok-handoff-complete--grok-workspace_1789591148371:.vercel/output/static/assets/routes-RWaLuMdQ.js` — secret-scan
- `tessera-grok-handoff-complete--grok-workspace_1789591148371:src/lib/auth/server.ts` — secret-scan
- `tessera-grok-handoff-complete--grok-workspace_1789591148371:src/lib/store-api.ts` — secret-scan
- `tessera-grok-handoff-complete--grok-workspace_1789591148371:src/routes/login.tsx` — secret-scan
- `shared-lfs-zip:3/artifacts/api-server/src/lib/ingestion/apis.ts` — secret-scan
- `shared-lfs-zip:3/artifacts/tessera/src/components/KnowledgeSearch.tsx` — secret-scan
- `shared-lfs-zip:3/artifacts/tessera/src/pages/CredentialsPage.tsx` — secret-scan
- `shared-lfs-zip:3/artifacts/tessera/src/pages/KnowledgeSecretsPage.tsx` — secret-scan
- `shared-lfs-zip:3/artifacts/tessera/src/pages/SovereignHubPage.tsx` — secret-scan
- `shared-lfs-zip:3/artifacts/tessera/src/pages/TesseractAGIPage.tsx` — secret-scan

### Other exclusions
- `generated-or-local`: 35218
- `media-pending-review`: 782
- `not-source-or-config`: 54
- `runtime-data`: 1
