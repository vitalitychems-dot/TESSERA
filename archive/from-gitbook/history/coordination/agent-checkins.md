# Agent check-ins

This ledger is the coordination lock for the [hybrid consolidation backlog](../../intake/HYBRID-CONSOLIDATION-BACKLOG.md). One task has one active owner. Agents must claim before editing and close with a commit, checks, provenance, and follow-up.

## Active claims

### HYB-021 - KaTeX dependency update

```text
TASK: HYB-021
AGENT: Replit Agent via the owner-authorized GitHub connection
SCOPE: TESSERA artifacts/tessera/package.json and pnpm-lock.yaml only: change KaTeX from ^0.18.2 to ^0.19.0. GitBook edits are tracking only; no runtime or other dependency changes.
START: 2026-10-08T00:55:28Z
BASE: TESSERA main@be9827ea21b1e0b8a2365ce16161104da254f3d2; Gitbook main@09ddefe69c3ace84a27411ac87910ca1ca534a50
STATUS: IN REVIEW (TESSERA PR #20 open; CI passed; awaiting review)
NEXT CHECK-IN: 2026-10-08T04:15:00Z
VALIDATION: GitHub Actions run 37713667003 on TESSERA PR #20 head fc58b5ec1b89a566e5d95e6346e61fb67f2da547 passed frozen workspace install, dependency audit, typecheck, disposable database schema, isolated workspace tests, and workspace build. Local pnpm lock regeneration timed out on unrelated registry metadata; CI frozen install passed.
BLOCKER: No independent GitHub reviewer is configured; only the owner account is listed as collaborator on both repositories. Review requested on GitBook issue #2; no response yet. Cursor connector remains unavailable, so a separate local Cursor workspace cannot be verified.
FOLLOW-UP: Keep GitBook PR #17 and TESSERA PR #20 open and unmerged; check for reviewer feedback at next check-in.
```

### HYB-013 — coordinated claim proposal

```text
TASK: HYB-013
AGENT: Copilot Chat Assistant (GitHub user: vitalitychems-dot; coordinating under the Gitbook mesh lane with no overlap with any current active owner)
SCOPE: Gitbook review of historical UI flow candidates and TESSERA candidate flow recovery; no direct product code edit until a scoped acceptance test and owner approval are recorded
START: 2026-10-07T00:00:00Z
BASE: TESSERA main@a024d83f90fb1bfe9ca82a5b5cc4a435df91a422; Gitbook main@372cf1e4a0c4cbfa413b748be9e1de4e7ae505a1
STATUS: IN REVIEW
NEXT CHECK-IN: 2026-10-07T02:00:00Z
BLOCKER: none
```

This claim is intentionally scoped to a Gitbook review and design pass only. It does not overlap with any currently recorded active HYB task in the ledger and it preserves the one-task/one-owner rule while enabling collaboration through the issue thread and the Gitbook moderator review.

None. HYB-012 was the only active claim. It is closed in the completed table and in the completion block under the preserved claim text.

## HYB-012 — preserved claim text

Decision-time STATUS inside the blocks below remains IN REVIEW. Current status is DONE (`50876d40`).

## HYB-020 / repository routing — completion record (2026-10-07)

```text
TASK: HYB-020
AGENT: Manus consolidation coordinator
SCOPE: Gitbook merge/ALL-REPOSITORIES-ROUTING-2026-10-07.md; mesh/CODEBASE-MEMORY-MCP.md; intake/HYBRID-CONSOLIDATION-BACKLOG.md; SUMMARY.md; local CBM graph artifacts in TESSERA and Gitbook
START: 2026-10-07T22:49:00Z
BASE: Gitbook cfaba85; TESSERA 8ca8fb2
STATUS: DONE
BLOCKER: none
CHECKS: codebase-memory-mcp 0.11.0 installed; TESSERA indexed with 20,742 nodes and 54,278 edges (58 partial parses, 16 intentional exclusions, 0 unusable); Gitbook indexed with 1,236 nodes and 1,361 edges (0 partial, 0 unusable); account repository list routed without opening protected 1T contents; no source repository deleted.
CHANGED: Gitbook routing record, Codebase Memory bridge contract, backlog HYB-020 row, SUMMARY navigation, local .codebase-memory artifacts for both destinations
FOLLOW-UP: HYB-014 for a reviewed historical-merge refresh/check command; HYB-008/HYB-013 for selective feature recovery; owner digest approval applies only to this scoped publication
```

The routing pass accounts for current account repositories without claiming that every historical byte belongs in TESSERA. Unrelated `Run-Z-app` repositories are recorded as outside Tessera scope; `1T` remains protected and uninspected; archives and generated/runtime data remain at their sources. Agents must use the routing record before opening a new recovery task.
