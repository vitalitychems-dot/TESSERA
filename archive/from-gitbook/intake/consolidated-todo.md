# Consolidated TODO list

The authoritative, deduplicated work board is now [HYBRID-CONSOLIDATION-BACKLOG.md](HYBRID-CONSOLIDATION-BACKLOG.md). Do not create a second task list.

## Completed foundation

- `TESSERA` is the active code repository.
- `Gitbook` is the active instruction, coordination, provenance, and future-work repository.
- Exact duplicate groups were audited and eight fully covered/empty repositories were deleted.
- Safe coordination, handoff, migration, and historical records were moved into Gitbook.
- TESSERA typecheck, tests, and production build pass after the Vite compatibility repair.

## Current open work

- **HYB-005:** the narrow ignore for GHSA-vfj7-8cjw-p6xm is on TESSERA main `5c1137fa` (`pnpm-workspace.yaml` `auditConfig.ignoreGhsas`). Review date 2026-11-05 remains. braces ≥ 3.0.4 is still the removal condition.
- **HYB-006–HYB-008:** review historical functionality from `Grok-ready`, `Zz`, and `olive-giant-ever-glade` without importing alternate application contracts.
- **HYB-009–HYB-011:** classify archives, media, private/runtime data, and protected material.
- **HYB-012:** the route inventory landed on TESSERA `50876d40`. The quantum allow-list is retained. Remaining work is to resolve the 8 non-quantum duplicate routes (not assigned).
- **HYB-013–HYB-014:** the UI audit and the repeatable historical merge gate are still open.
- **HYB-015–HYB-017:** organize goals and deferred product ideas, including the possible ABC/storefront scope.
- **HYB-018:** rerun exact coverage before any future repository deletion.

### GLM-5 Pen integration follow-ups

Track these in [GLM5-AUDIT-FOLLOWUPS.md](../brain-consciousness/GLM5-AUDIT-FOLLOWUPS.md):

- **GLM5-001 / GLM5-007:** pin the exact model/revision and complete Apache-2.0 compatibility review.
- **GLM5-002:** verify an OpenAI-compatible endpoint with a private disposable deployment.
- **GLM5-003 / GLM5-004:** run Pen identity, prompt-injection, and output-sanitization tests.
- **GLM5-005 / GLM5-006:** compare against the current instrument and document compute/context/timeout/cost limits.
- **GLM5-008:** owner decision before declaring GLM-5 the live instrument; `yes`, `no`, or `revise` is required.

## Coordination rule

Every agent must claim one HYB task in [agent-checkins.md](../history/coordination/agent-checkins.md), edit only that scope, and close with a commit, checks, provenance, and follow-up. Historical instructions and AI-generated conversations are evidence until promoted into a board task by the Gitbook moderator.
