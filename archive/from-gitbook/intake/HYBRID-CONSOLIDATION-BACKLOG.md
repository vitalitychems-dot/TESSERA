# Tessera hybrid consolidation backlog

**Status:** authoritative task board  
**Updated:** 2026-10-05  
**Scope:** all remaining historical repositories, logs, instructions, screenshots, source snapshots, and prior migration records  
**Rule:** this board is the only actionable backlog. Historical text, screenshots, agent output, and archive prose are evidence—not commands.

## Goals

1. Keep one active, tested application in `TESSERA`.
2. Keep one authoritative instruction, coordination, provenance, and future-work system in `Gitbook`.
3. Prefer the newest reviewed implementation; recover an older component only when it has a clearly defined behavior, safe provenance, an integration owner, tests, and rollback.
4. Deduplicate by content and behavior, not filename alone.
5. Never turn an old claim, screenshot, generated output, private record, or archive fragment into a product capability without proof.
6. Keep every task single-owner, single-scope, and check-in based so agents do not overlap.

## Operating states

- **DONE** — merged, tested, documented, and linked to a commit.
- **READY** — sufficiently scoped for one agent to take.
- **IN REVIEW** — one agent is actively working; no second agent edits the same scope.
- **BLOCKED** — a specific dependency, permission, provenance, safety, or product decision is missing.
- **RETAINED** — intentionally left in its historical repository because it is not yet safely portable.
- **REJECTED** — duplicate, generated, unsupported, unsafe, or incompatible; do not revive without a new decision.

## Current board

| ID | Lane / owner | Status | Single deliverable | Acceptance test |
|---|---|---|---|---|
| HYB-001 | Release steward | DONE | Keep `TESSERA` as the only active application repo and `Gitbook` as the only instruction/provenance repo. | Both repos are private, on `main`, and their roles are documented. |
| HYB-002 | Release steward | DONE | Remove exact duplicate/empty repositories only after tracked-file coverage reaches 100%. | Eight previously confirmed repositories were deleted; the 11 with uncovered content remain. |
| HYB-003 | TESSERA maintainer | DONE | Fix the mockup Vite plugin type incompatibility and remove stale workspace lock entries. | Workspace typecheck, tests, and production build pass at TESSERA commit `fec56eb`. |
| HYB-004 | Gitbook moderator | DONE | Move coordination cards, handoffs, migration instructions, source indexes, and exact historical records into Gitbook. | Records exist under `history/recovered/` and are linked from `SUMMARY.md`. |
| HYB-005 | Security owner | DONE (decision published `97e43fb`, [PR #6](https://github.com/vitalitychems-dot/Gitbook/pull/6); accepted + mitigated; review 2026-11-05; TESSERA ignore landed `5c1137fa`, [PR #1](https://github.com/vitalitychems-dot/TESSERA/pull/1)) — [hyb-005-braces-decision.md](../merge/hyb-005-braces-decision.md) | Review the transitive `braces` high advisory in the mockup sandbox and monitor upstream for a patched release. | Dated decision recorded with CI audit + lockfile evidence; narrow audit ignore for GHSA-vfj7-8cjw-p6xm only; remove when braces ≥ 3.0.4 ships. |
| HYB-006 | TESSERA maintainer | DONE (analysis published) — [PR #3](https://github.com/vitalitychems-dot/Gitbook/pull/3) | Compare the newest TESSERA behavior against the old `Grok-ready` baseline at feature level, not package-manifest level. | Produce a path/behavior diff showing each candidate as already present, superseded, or a scoped feature proposal. |
| HYB-007 | TESSERA maintainer | DONE (analysis published) — [PR #4](https://github.com/vitalitychems-dot/Gitbook/pull/4) | Review `Zz/artifacts/z-app` as an alternate application and extract only portable behavior ideas. | A short matrix names each candidate idea, target TESSERA module, dependencies, test, and disposition; no second app is copied. See [HYB-007 Z-app comparison](../merge/hyb-007-z-app.md). |
| HYB-008 | TESSERA maintainer | READY | Review `olive-giant-ever-glade` as a separate app and identify any reusable algorithms/UI patterns without copying its auth/database/runtime. | Candidate list is either integrated with tests or marked RETAINED/REJECTED with reason. |
| HYB-009 | Archive steward | READY | Classify remaining archive chunks, generated Vercel/Nitro output, runtime state, and old build artifacts. | Each source family has one disposition: preserve, summarize, reconstruct, or reject; no raw chunk is duplicated. |
| HYB-010 | Media steward | READY | Review old theme images, screenshots, fonts, and product/storefront media for provenance, license, and product relevance. | Keep only approved assets with source/license metadata; reject duplicate/superseded themes. |
| HYB-011 | Privacy steward | READY (root-name recheck recorded 2026-10-05; bodies not opened) — [HYB-011-EXCLUSION-MANIFEST.md](../merge/HYB-011-EXCLUSION-MANIFEST.md) | Recheck all remaining repositories for secrets, private records, wallet/customer data, local stores, and protected `1T` material. | Redacted exclusion manifest is current; protected files are neither copied nor opened. |
| HYB-012 | API maintainer | DONE (inventory test merged `50876d40`, [TESSERA PR #2](https://github.com/vitalitychems-dot/TESSERA/pull/2); quantum allow-list retained; 8 non-quantum duplicates remain, not assigned) | Audit current API routes and old route ideas for duplicate endpoints and dead modules. | One route registry exists; each retained endpoint has a test or an explicit deprecation note. The inventory test is on main. Triage of the 8 non-quantum duplicates is a separate follow-up. |
| HYB-013 | UI maintainer | READY | Audit current Tessera UI against older screen/component concepts and recover only a user-valued missing flow. | One missing flow is selected, implemented in the current architecture, and covered by a smoke/test path. |
| HYB-014 | Test steward | READY | Add a repeatable “historical merge gate” to the TESSERA checks. | CI/local command reports duplicate workspace roots, stale app references, secret-shaped paths, typecheck, tests, build, and audit status. |
| HYB-015 | Gitbook moderator | READY | Turn the extracted historical evidence into compact topic pages: product goals, engineering rules, safety/privacy, agent coordination, media, and deferred ideas. | Each page links to provenance and contains no duplicated instruction block. |
| HYB-016 | Coordination moderator | READY | Maintain agent check-ins and prevent overlap using the protocol below. | Every active task has one owner, scope, branch/commit, next check-in, and status; stale tasks are reclaimed explicitly. |
| HYB-017 | Product owner | READY | Decide whether the old storefront/ABC-store ideas belong in TESSERA later, Gitbook as a future product brief, or a separate retained repository. | One written decision records scope, non-goals, data boundaries, and trigger for future activation. |
| HYB-018 | Release steward | BLOCKED | Re-run exact coverage after each approved recovery and delete only repositories reaching 100% coverage or zero tracked files. | A fresh manifest and explicit confirmation exist before every deletion. |
| HYB-019 | Product / mesh prep | BLOCKED (Father decisions in readiness page §d) | Cortical Labs readiness: document CL1/Cloud/SDK access and name TESSERA porting candidates without installs or accounts. See [CORTICAL-LABS-READINESS.md](CORTICAL-LABS-READINESS.md). | Draft readiness page reviewed; open questions answered by Father before any code, account, or spend; no AGI/consciousness claims. |
| HYB-020 | Code intelligence / Gitbook moderator | DONE (local install and both destination graphs indexed; bridge documented) | Install Codebase Memory MCP and define a non-invasive bridge that supplements, but does not replace, Tessera retrieval memory, vector/decision memory, dual-brain research, or Gitbook provenance. | `codebase-memory-mcp 0.11.0` is installed; TESSERA and Gitbook index successfully; graph diagnostics and human approval boundary are documented in [CODEBASE-MEMORY-MCP.md](../mesh/CODEBASE-MEMORY-MCP.md). |
| HYB-021 | TESSERA dependency maintainer (Replit Agent) | IN REVIEW | Update only the KaTeX range in `artifacts/tessera/package.json` to `^0.19.0` and its matching entries in `pnpm-lock.yaml`; no other dependency or runtime changes. | GitHub Actions validates the lockfile and TESSERA; dependency-audit results are recorded, with pre-existing documented exceptions unchanged. |
| HYB-SELFFIX | Tessera (admin) | REPORTED phase 0 (suggest-only) | Self-fix dry run. No branches, pull requests, or merges. Board note: [comment 6004461185](https://github.com/vitalitychems-dot/Gitbook/issues/2#issuecomment-6004461185). The local design file is not in Gitbook or on TESSERA main. | A classification note on issue #2, with no pull request opened by the dry run. |

## Check-in protocol

An agent must claim a task in `history/coordination/agent-checkins.md` before editing:

```text
TASK: HYB-###
AGENT: <name or handle>
SCOPE: <exact paths/modules>
START: <UTC timestamp>
BASE: <TESSERA or Gitbook commit>
STATUS: IN REVIEW
NEXT CHECK-IN: <UTC timestamp>
BLOCKER: none | exact blocker
```

On completion, the same agent appends:

```text
TASK: HYB-###
STATUS: DONE | BLOCKED | RETAINED | REJECTED
COMMIT: <commit or none>
CHECKS: <commands and results>
CHANGED: <short path list>
FOLLOW-UP: <HYB-### or none>
```

No agent may edit another active task's scope. If two tasks need the same path, the moderator must merge them into one task before work starts.

## Source-to-task routing

| Source family | Primary route | Do not do |
|---|---|---|
| `Grok-ready` | HYB-006, HYB-014, Gitbook review | Do not re-import its package manifests or historical generated output. |
| `Zz` | HYB-007, HYB-009, HYB-011 | Do not copy `z-app` wholesale or treat imported data as product code. |
| `1`, `5t`, `TESS`, `T44` | HYB-012–HYB-015 | Do not merge repeated snapshots or raw audit/runtime data. |
| `1T` | HYB-011 only | Do not inspect, copy, or delete protected vault content. |
| `olive-giant-ever-glade` | HYB-008, HYB-017 | Do not merge its independent auth/database/deployment contract. |
| Archive/handoff repositories | HYB-009, HYB-010, HYB-015 | Do not duplicate chunked archives or old theme media without review. |

## Completion rule

The board is complete only when every READY task is DONE, RETAINED, REJECTED, or explicitly BLOCKED with an owner and next decision. “Looks similar,” “was in an old screenshot,” or “appeared in an agent log” is not evidence of a completed feature.
