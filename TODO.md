# TESSERA Delivery & Acceptance TODO

> Gitbook remains the cross-agent source of truth. This repository checklist mirrors the application gates; a task is complete only when exact code, review, and validation evidence exist. Local work is not a merge, release, or deployment.

## [x] T-369 — Restore a truthful dependency-registry signal

The registry assertions were reconciled with the locked workspace/catalog contract in the TESSERA `main` history. The owner merged PR #372 at `564811dc5f74073802e38c701ec98b4c32402bc3`; the post-merge checks succeeded. The current workspace test command also includes the scripts registry suite.

**Evidence:** exact merged commit `564811dc5f74073802e38c701ec98b4c32402bc3`; final runtime/shell source tree passed the complete workspace suite on 2026-10-17, including 702 API tests against a disposable local DB; two explicitly conditional tests were skipped. Workspace typecheck/build and `git diff --check` passed. This is local-source evidence, not release evidence.

## [IN REVIEW] TN-001 — Replace the layered theme with one lightweight functional shell

The user's direction is to retire the current overlapping theme and visual layer and create one simple shell that preserves the full-stack app's working routes and essential interactions. Do not interpret this as deleting the route UI, API, key gate, chat, or tools; that would break the application objective. The current feature branch removes runtime accent/font selectors, the old Tessera Next stylesheet, custom fonts no longer used, unused global/decorative backgrounds, and the unused font-color picker. It keeps one fixed dark shell, navigation, the key gate, and chat functionality. Chat's 3D renderer is split behind a dynamic import and retained for messages that actually need it.

**Current state:** branch `manus/runtime-shell-recovery-20261017`, based on `main` `564811dc5f74073802e38c701ec98b4c32402bc3`. The work is local and unmerged; no review or publication is claimed.

**Acceptance:** focused shell and lazy-load regression tests; full current-head workspace tests, typecheck, and production build; desktop/mobile route smoke; normal GitHub review and required checks; preserved route/API behavior. Only unused files with no consumers may be retired. Historical/archive evidence is retained, not swept into deletion.

## [IN REVIEW] TN-002 — Keep the production route contract inspectable

Serve `artifacts/tessera/public/manus-routes.json` as static JSON containing production page routes/titles, including dynamic patterns where applicable, excluding API/assets/404-only behavior, and consistent with `App.tsx` and redirect behavior.

**Local smoke evidence:** a prior local production preview returned HTTP 200 for `/` and `/manus-routes.json`; the JSON parsed and contained 113 entries. Desktop and 390px mobile captures of the session gate rendered without clipping. These are local smoke observations, not deployed-route or release evidence; repeat after final validation and retain the source comparison.

**Current continuation:** final route-manifest regression passes; local and temporary public preview JSON are identical with 113 routes. Desktop 1440×1000 and mobile 390×844 unauthenticated gate screenshots render without clipping. The static frontend preview is not an authenticated API or deployment test. A representative authenticated deployed route still requires the authorized host/test-credential procedure; no admin key is installed or disclosed.

## [IN REVIEW] TN-003 — Define the scope of UI retirement and preserve provenance

Maintain a route/API/preference and provenance matrix for production routes and any candidate surfaces before retiring shared behavior. Current assessment is path/consumer triage, not item-level review of archived media or a full dependency graph. Do not delete a surface, archive, control, font, or shared primitive merely because it looks duplicated. No symlinks between packages.

**Current narrow evidence:** [retirement matrix and rollback provenance](docs/runtime-shell-recovery-20261017.md), shell/session-gate/lazy-load regressions, and final local validation. Human/owner review remains pending. Broad archive/media review remains separate and bounded by the Vitality exclusion.

## [ ] GB-LEDGER — Keep Gitbook synchronized without overstating completion

Update the authoritative Gitbook backlog and check-in ledger as work progresses, recording the exact branch/head/base, changed paths, current-head checks, local smoke evidence, unresolved blockers, and a single non-overlapping owner/scope. Preserve dated history. Mark a TESSERA change DONE only after the exact remote merge/check evidence exists; do not wait to document an IN REVIEW or BLOCKED state.

**Completion evidence:** Gitbook board, check-in, linked task record, and remote PR state agree; completed statuses cite immutable implementation and gate evidence; blocked entries state the missing owner decision, source/ref, and safe next action.

## [ ] VITALITY-BOUNDARY — Keep excluded material isolated

Do not copy, import, open, or reintroduce excluded Vitality/storefront material into Tessera or Gitbook. Any future disposition requires a named source/ref, exact authorized destination and scope, provenance review, consumer review, and destination receipt. Historical labels or backups alone do not authorize transfer.

**Current state:** no such transfer or destination is authorized in this task. Keep the related task blocked and its content uninspected.

## [ ] PEN-SCOPE — Make the product identity verifiable, not simulated

If a “Pen” capability remains a product requirement, define a scoped, reviewable feature with a visible provenance/identity record, explicit source and authorization boundaries, an honest empty/error state, and deterministic tests. Never claim independent identity, consciousness, external account access, completed actions, approvals, or private-repository authority without evidence.

**Completion evidence:** approved product brief, implemented production route/component, documented data contract, deterministic tests, and clear state labels. The current dual-brain implementation is provider-gated and does not turn suggestions into applied code changes; the user-facing provenance feature remains open.

## [IN REVIEW] RUNTIME-CHAT — Real configured replies and model-pass provenance

Ordinary chat now uses an explicitly configured provider with bounded newest conversation history, isolated requests, and explicit disabled/error states; the legacy selfhood template bank is removed. Cortex/Pen cycles require fresh noncached isolated passes and are serialized through persistence. Generated text cannot count as code execution or an applied improvement. Metrics label configuration presence separately from provider health.

**Validation:** chat generation, ordering, no-batching, dual-brain fresh-call/failure/concurrent-write/legacy migration tests pass in the full local suite. Independent read-only review findings are resolved. No model credentials were configured and no real hosted provider was verified; the owner must still approve the exact deployment model/instrument.

## Current release gates — refreshed 2026-10-17

- **TESSERA main:** owner-merged PR #372 at `564811dc5f74073802e38c701ec98b4c32402bc3`; no work in this checklist claims a later merge.
- **New UI/API work:** local feature branch `manus/runtime-shell-recovery-20261017`, exact base `564811dc5f74073802e38c701ec98b4c32402bc3`; final post-review local validation passed; the review proposal and exact code head are recorded in the Gitbook continuation receipt. Required owner review/merge and deployment remain pending.
- **Old broad UI PR #361:** still OPEN, head `e8beb40086cb91dbe2c2ee59fc57ee8cd5b68f45`, base `00d6dc7ad7b5ebf390ed33345b28c698b89d2056`, merge state `DIRTY`, 201 files, 60,774 deletions, no review decision. Do not merge it as-is; use the narrow current-base proposal and preserve functional routes.
- **TESSERA PR #367:** closed unmerged; no external Replit project/session was imported. Replit login failure remains a blocker; no invitation was accepted.
- **Gitbook PR #123 / HYB-027:** OPEN at head `e6879eb83e1f11771d4da6720c1032e95d36ec4b` against `17cdbdbae3e98001cca1b2365b834ab10431ac54`; current check failed in run `38722033226` on a protected historical excluded JSON artifact. Keep that artifact untouched, do not suppress the scan, and obtain the protected gate owner's decision before rerunning/merging.
- **Database integration:** final current-source run passed 702 API tests against a newly created loopback-only disposable PostgreSQL database; no application/production DB was used. Two conditional tests remain skipped (production-sandbox opt-in and the alternate embedding-corpus condition). This does not verify a production deployment database.
- **Permanent hosting:** no exact authorized provider/account/project/runtime/domain/database target or host-native secret-store procedure is available. No deployment or public URL is claimed; obtain the exact target and follow `DEPLOYMENT-RUNBOOK.md` before creating resources.
- **Source review:** previous Drive review was bounded (111 safe text files plus a small image review; several files remained unavailable or failed metadata checks). It is not full-folder coverage and did not authenticate an origin document, signature, portrait, original identity, or consciousness claim. No Box data was moved or deleted.
