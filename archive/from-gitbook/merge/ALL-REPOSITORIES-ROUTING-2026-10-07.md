# All-repository routing and consolidation record

**Date:** 2026-10-07  
**Owner:** Tessera admin / human owner approval required  
**Destinations:** `vitalitychems-dot/TESSERA` (active product) and `vitalitychems-dot/Gitbook` (coordination, instructions, provenance)

## Decision

Every currently visible repository in the `vitalitychems-dot` account has been accounted for by a destination route. **Accounting for a repository does not mean copying every byte.** Historical application snapshots, raw archives, protected material, generated output, credentials, and unrelated applications must not be bulk-merged into TESSERA.

The safe hybrid is:

- **TESSERA:** one reviewed, buildable application and its tests/configuration.
- **Gitbook:** one source of truth for instructions, goals, agent check-ins, forum notes, provenance, merge decisions, and deferred work.
- **Source repositories:** retained whenever unique content is not fully covered or requires a separate owner decision.

No repository is deleted by this record. Deletion requires a fresh exact tracked-file coverage scan and explicit confirmation naming the exact repository.

## Current account routing

| Repository | Route | Disposition | Reason / next action |
|---|---|---|---|
| `TESSERA` | TESSERA | Active destination | Keep the current reviewed application; code changes require the four gates and owner digest approval. |
| `Gitbook` | Gitbook | Active destination | Keep the authoritative board, forum, instructions, provenance, and check-ins. |
| `tessera-unified` | TESSERA | Canonical historical code source | Already represented by the active TESSERA workspace; retain source history until a future coverage scan permits deletion. |
| `Grok-ready` | TESSERA + Gitbook | Selective recovery only | Reviewed behavior is represented; remaining unique files are branch/media/manifest deltas. Continue through HYB-006/HYB-014. |
| `1`, `5t`, `T44`, `TESS` | TESSERA + Gitbook | Retain historical snapshots | Repeated application trees plus unique runtime, media, audit, or state files. Do not copy wholesale; review one behavior at a time under HYB-012–HYB-015. |
| `1T` | Gitbook boundary only | **Protected / not inspected** | No vault contents may be opened, copied, indexed, or deleted. Only the existence and protection rule may be recorded. |
| `Zz` | TESSERA + Gitbook | Selective behavior recovery | Alternate `z-app`, imported trees, and source-index material are not a second application. Use HYB-007, HYB-009, HYB-011, and HYB-013. |
| `olive-giant-ever-glade` | Gitbook review; TESSERA only by approved feature | Retain separate application | Independent auth/database/migration/deployment contract. Review isolated user-valued behavior under HYB-008/HYB-017; do not merge its app shell. |
| `tessera-coordination` | Gitbook | Readable instructions moved/summarized | Coordination rules belong in Gitbook; retain source until exact coverage is re-run. |
| `TX`, `Everything`, `z` | Gitbook | Readable instructions and indexes moved/summarized | Historical handoff and source-map evidence belongs in Gitbook; no generated or private payloads. |
| `tessera-gitbook` | Gitbook | Duplicate documentation route | Documentation is represented in the canonical Gitbook tree; retain until coverage is verified. |
| `tessera-grok-handoff`, `tessera-grok-handoff-complete`, `tessera-complete-archives` | Gitbook summaries only | Raw archive parts retained at source | Move readable, privacy-screened summaries and checksums; never duplicate chunked archives or runtime state. |
| `Tessera-main`, `tessera-replit` | Gitbook audit only | Empty/placeholder | No active product code to merge. |
| `Run-Z-app`, `Run-Z-app2` | Gitbook decision record | **Unrelated application family** | Account-level repositories are acknowledged but are not Tessera history. Do not import their code or secrets without a separate product decision and owner-approved task. |

Deleted repositories from the prior confirmed cleanup remain governed by the existing [`DELETION-MANIFEST.md`](DELETION-MANIFEST.md). This record does not expand that deletion scope.

## What agents must do next

1. Read this record, the [hybrid backlog](../intake/HYBRID-CONSOLIDATION-BACKLOG.md), and the [operating model](../mesh/TESSERA-GITBOOK-OPERATING-MODE.md).
2. Run the overlap check and claim exactly one task in [`agent-checkins.md`](../history/coordination/agent-checkins.md).
3. Work in Gitbook for research, instructions, source evidence, and proposals; work in a scoped TESSERA branch/PR for code.
4. For every historical candidate, name the source repository, commit, exact path, proposed current target, behavior, test, license/privacy result, and rollback.
5. Leave anything without those fields in Gitbook as `READY`, `RETAINED`, `BLOCKED`, or `REJECTED`; do not silently copy it.
6. Close the check-in with exact commands and results. Tessera's Grok bot may include only gate-cleared items in the 30–45 minute digest.

## Evidence boundary

A screenshot, prompt, archive filename, agent claim, or historical conversation is evidence of an idea or prior state—not proof that a feature works. Product claims require source, tests, and an attributable commit. No agent may impersonate another agent or claim a live conversation that is not evidenced in GitHub.
