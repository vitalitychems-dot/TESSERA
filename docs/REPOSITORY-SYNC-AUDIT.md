# Repository synchronization and cleanup review

Date: 2026-10-19

Status: **local source reconciliation, approved upload cleanup, and a successful Replit publish completed. Application build and targeted checks pass; the full repository suite is not green.** No source was pushed or merged. Gitbook help was requested; no Gitbook release approval is claimed.

## Scope and source authority

The owner requested information from Gitbook, GitMesh, TESSERA, combined, and repository 2, followed by deduplication and cleanup. Gitai was also inventoried because it belongs to the existing coordination topology.

The configured GitHub connection exposed 12 owner repositories. Six relevant repositories were inspected at the pinned commits below. Four zero-size placeholders (`1`, `3`, `4`, `5`) have no application tree to integrate. The private box backup was retained without importing its contents. The separate Vitality product was excluded.

Repository inventories contain paths, Git blob identities, sizes, and modes; they are not a claim that every file body was reviewed. All six recursive tree responses reported `truncated: false`. The inventory initially read selected guidance/handoff documents; the subsequent reconciliation imported active canonical source as described below. No protected archive bodies, credential files, private runtime records, or release asset bodies were imported.

| Repository | Branch and pinned commit | Disposition |
| --- | --- | --- |
| TESSERA | `main` — `55adbac2775cb75c0c559ef777117fcf94f1f729` | Canonical application source; reconcile changes without removing local features. |
| Gitbook | `main` — `25b59f78f7a1cd04bfd89cc7dccbabfba589c53c` | Documentation, intake, coordination, and review authority; retain links rather than copying historical trees. |
| GitMesh | `main` — `9a928e573fac9765318ce887ce853d6fa69d0076` | Reference only. No remote writes, network joining, or private-mesh ingress enabled. |
| combined | `main` — `b33c495ee4feac657fb4478123dd04f92f0e6915` | Private archive. Metadata and README inspected; contents remain separate. |
| 2 | `replit-agent` — `c5af8b40f65b109c942b7498b50ef0ff18b03e92` | Alternate runtime/handoff source; not a drop-in replacement for this application's authentication or API. |
| Gitai | `main` — `cfb7e8af9ab15738056d3889bfbbb79250ecdd99` | Separate application. Do not overwrite TESSERA's API schemas, database contracts, or routes with it. |

GitHub reported TESSERA and Gitbook as **public**, even though TESSERA's repository description calls its destination private. `combined` is private. Recheck actual visibility before any import; descriptions are not a privacy control.

## Initial canonical application comparison

Scope: files under `artifacts/tessera`, `artifacts/api-server`, `lib`, and `scripts`, excluding selected generated/import/runtime directories. These are comparison candidates, not a safety allowlist.

| Result | Files |
| --- | ---: |
| Same path and identical Git blob | 686 |
| Existing path changed upstream | 159 |
| Additional upstream path | 75 |
| Local-only path that must be preserved | 83 |

The 234 upstream differences require reconciliation, not wholesale replacement. They include application source, tests, dependency manifests, generated API files, and artifact metadata. Artifact metadata must go through its schema validator, dependency changes need their own review, and generated contracts must remain consistent.

The 83 local-only files include the custom keyboard, local theme and fonts, owner-session-related work and tests, live repository/world functionality, the Moltbook owner handoff, and the Replit runtime adapter. Their absence upstream is **not** evidence they are obsolete.

The exact 317-row decision list is generated locally as `generated-artifacts/repository-audit/canonical-source-differences.csv`. It includes all 234 upstream candidates and 83 explicit preserve decisions. It contains paths and hashes, not source bodies.

## Approved source reconciliation

The owner approved reconciliation while preserving local features. The original import checkpoint, `4c82ce7a64b836c85695f7d14461506210b0ccf4`, was used as the three-way comparison base. The final canonical source pin is `7624b8b7b6a98ca44cbd185b168ab901c559ba34`; its active-source difference from the inventory pin is three author-attribution script/fixture files.

- Imported or merged **151 active source paths** through an isolated Git index, leaving the working branch and normal index intact.
- Retained **all 83 local-only paths**. The **12 overlapping local interface files** remain local, including the owner gate, keyboard, theme, chat surface, and responsive navigation.
- Reconciled backend overlaps with cookie-only owner access, private chat-sigil behavior, local source provenance, external-provider consent, and truthful agent/model labels retained.
- Integrated seven canonical identity-evidence metadata files. Their pending owner decisions remain pending; manifest integrity does not independently verify historical claims.
- Kept dependency versions and the existing lockfile. Added only a local production-startup regression command to the scripts package.
- Kept the external coordination graph as a **test-only fixture**, not runtime configuration or permission for outside agents to join the private mesh.
- Updated the API production command through artifact schema validation after deployment logs proved that publishing starts it from the workspace root. Development still starts from the API artifact directory.
- Added a 64 KiB incoming WebSocket message limit and sanitized mesh database-enrichment error logs.
- Corrected chat history selection to load the newest 40 messages before restoring chronological order.

The final **329-row** path/hash decision report is `generated-artifacts/repository-audit/source-reconciliation-decisions.csv`; the concise result is `generated-artifacts/repository-audit/reconciliation-result.json`. The earlier comparison remains as the original inventory/approval evidence.

## Gitbook help request

Help was requested from Grok/Grok bots, Cursor Project, Manus/release steward, and the moderator on the existing [coordination issue](https://github.com/vitalitychems-dot/Gitbook/issues/2#issuecomment-6278300560). The request is not evidence that any role accepted or completed work. No separate identities or live replies are invented. Cursor's existing cleanup lane remains separate; its unmerged deletion work was not applied.

## Duplicate decisions

- **51 exact duplicate groups in active source areas**, representing 133,870 excess bytes. These are sandbox/app UI, hook, and utility copies. Retain them: the packages import their own paths, and the canonical layout explicitly preserves these boundaries. Removing one copy is not a safe deduplication.
- **10 duplicate-content groups among uploads**: nine image groups and one text group. After the owner approved the exact-path report, **11 redundant copies—10 images and one text file—were removed**, totaling **9,243,264 bytes**. Each candidate was compared byte-for-byte with its retained original; no active code/document references were found. Every original remains. The initial description of all eleven as images was incorrect; this is the corrected classification.
- Same filename alone is not a duplicate test. Shared Git blob identity is evidence of equal stored content, not permission to remove a file.

Detailed reports:

- `generated-artifacts/repository-audit/local-exact-duplicates.csv`
- `generated-artifacts/repository-audit/uploaded-duplicate-candidates.csv`
- `generated-artifacts/repository-audit/source-snapshot.json`
- `generated-artifacts/repository-audit/combined-release-coverage.json`
- `generated-artifacts/repository-audit/approved-upload-cleanup.json`

## Safe cleanup performed

The initial cleanup removed an abandoned, unreferenced temporary Git pack and regenerable tooling caches:

- `.git/objects/pack/tmp_pack_PColSu`: 3,277,848,575 bytes; last modified 2026-10-14, no open file holders, no active Git process observed.
- `.cache/pnpm/metadata-ff-v1.3`: 183,819,478 bytes.
- `.cache/pnpm/metadata-v1.3`: 3,801,261 bytes.
- `.cache/typescript`: 7,203,157 bytes.

Total removed: **3,472,672,471 bytes** (approximately 3.47 GB / 3.23 GiB). These caches can regenerate.

The subsequently approved upload deduplication removed another **9,243,264 bytes**. Gross removal across both passes is **3,481,915,735 bytes**, approximately **3.48 GB**; this is not a net-free-space measurement because builds can regenerate caches.

`git fsck --connectivity-only` passed before and after the initial cleanup. Indexed pack count and indexed pack size were unchanged by that removal; Git reported zero garbage afterward. No history rewrite, reflog expiry, broad Git clean, application-source deletion, repository deletion, or dependency removal was performed.

Root runtime audit output is now excluded from new Git tracking and deployment uploads. Existing tracked audit evidence is retained; ignore rules do not untrack it. The publishing exclusions for Git history, dependencies, caches, and private inputs remain in place.

## Verification and limits

- Git connectivity passed before and after temporary-pack removal; indexed history was retained.
- `git diff --check` passed.
- Initial comparison assertions passed: 159 changed, 75 additional, and 83 local-only paths. Subsequent checks confirmed all 83 local-only paths and every retained upload original still exist, while all 11 approved redundant paths are absent.
- The running API health endpoint returned HTTP 200, and the session-status endpoint returned HTTP 200 with authentication still required.
- A 402 × 874 preview capture showed the owner-entry screen and custom keyboard loading without browser errors.
- Workspace type checks and the complete application production build passed. Vite's existing large-chunk advisories remain warnings, not build errors.
- Across the targeted offline API regression pass and narrow fixes, **225 checks passed and three were skipped**. Coverage includes owner-session privacy, cookie-only mesh access/revocation, rate limits, factual citations, model/agent honesty, forum evidence workers, and fetch guards.
- Three production-entry regression checks passed. The **actual configured production command**, launched from the workspace root with a clean synthetic environment and no database/owner credentials, returned HTTP 200 from `/api/healthz`.
- Refreshed development workflows are running. API health returned 200; unauthenticated provider and conversation requests returned 401. The mobile owner-entry preview and keyboard loaded without browser errors.
- **The full root repository suite failed**, including checks that require absent `.github` governance files, gate support, and sibling runtime/registry checkout inputs. They were not silently skipped or described as passing. Separate applications and archived trees were not imported just to satisfy these checks.
- Real owner sign-in, production database read/write behavior, restart durability of private data, and actual object-storage upload/download are not verified. `/api/healthz` returns HTTP 200 with the database configured; that health check does not establish durable data behavior. No database migration was performed.
- The Replit republish at `2026-10-20T00:00:24Z` succeeded, and the public `/api/healthz` endpoint returned HTTP 200. Both startup errors found during the failed publishing attempts were fixed: incorrect workspace-root-relative launch paths, then an externalized `@google-cloud/storage` import missing after publishing pruned installed packages.
- Background logs still contain disabled-subsystem heartbeat and unavailable external-feed warnings. These do not prevent the verified health endpoint or entry screen from loading, but they are not evidence that those integrations work.

## Retained and unresolved material

- The private combined repository exposes four releases. Two archive sets are each approximately 12.8 GB, with additional evidence/compliance assets. These are metadata observations, not independently verified archive integrity or unique-content counts. They were not downloaded, extracted, or deduplicated.
- Gitbook's approximately 6.85 GB tree includes historical and protected material. Its existence is accounted for; its bodies were not copied into the application.
- Older consolidation documents disagree about the number of repositories and whether sources were deleted. The live repository inventory takes precedence for existence, but does not authorize deleting any repository.
- Gitbook's [source map](https://github.com/vitalitychems-dot/Gitbook/blob/25b59f78f7a1cd04bfd89cc7dccbabfba589c53c/merge/source-map.md), [duplicate policy](https://github.com/vitalitychems-dot/Gitbook/blob/25b59f78f7a1cd04bfd89cc7dccbabfba589c53c/merge/duplicate-disposition.md), and [Replit guidance](https://github.com/vitalitychems-dot/Gitbook/blob/25b59f78f7a1cd04bfd89cc7dccbabfba589c53c/mesh/replit-agents-start-here.md) require source attribution, overlap checks, reviewed branches/PRs, and exact-path owner approval before destructive cleanup.
- Full canonical-monorepo gate coverage, signed-in regression testing, archive review, production persistence review, and a successful republish remain outstanding. Only the exact approved upload duplicates were deleted.
