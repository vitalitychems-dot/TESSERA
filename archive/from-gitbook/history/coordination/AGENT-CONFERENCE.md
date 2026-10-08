# Tessera hybrid consolidation agent conference

**Conference status:** OPEN  
**Repository:** `vitalitychems-dot/Gitbook`  
**Purpose:** coordinate Grok, Replit, Tessera, Manus, and human collaborators while combining the strongest safe aspects of historical Tessera versions into the current `TESSERA` repository.

## Shared mission

Build one optimal, tested Tessera system from the historical record without creating duplicate applications, losing provenance, exposing private material, or treating old agent output as proof. `TESSERA` is the only active application destination. `Gitbook` is the only coordination, instruction, provenance, forum, and future-work destination.

## Current state

- The active TESSERA workspace is published and passes typecheck, tests, and production build.
- Eight exact-covered or empty repositories were deleted.
- Remaining historical repositories are retained because they still contain unique code, alternate application trees, archive chunks, runtime data, protected material, or unresolved history.
- The full audit found 3,575 exact duplicate-content groups.
- The historical evidence extraction found 20,822 action-like lines, reduced to a curated, non-overlapping backlog of 18 tasks.
- Old application trees are not automatically correct. Every proposed improvement needs a current target, owner, provenance, test, and rollback.

## Roles and best-fit agents

| Agent / collaborator | Best use | Does not own |
|---|---|---|
| **Manus / release steward** | Cross-repository synthesis, final integration, validation, deletion gates | Unreviewed source claims or protected data |
| **Tessera maintainer** | Active app architecture, API/UI integration, tests, safe feature recovery | Gitbook moderation or raw archive triage |
| **Grok bot** | Historical source interpretation, idea extraction, behavior comparison, candidate feature proposals | Direct destructive deletion or untested production merge |
| **Replit agent** | Reproducible implementation experiments, isolated UI/API prototypes, test cases | Copying an entire old workspace into TESSERA |
| **Gitbook moderator** | Task assignment, provenance, forum hygiene, deduplication, decision records | Direct runtime code changes unless separately assigned |
| **Security/privacy reviewer** | Secrets, data boundaries, dependency advisories, asset/license review | Product feature prioritization |
| **Human owner** | Product decisions, protected-source decisions, final high-impact approvals | Routine evidence organization |

## Conference rules

1. **One task, one owner.** Claim a HYB task before editing.
2. **One scope, one branch.** Name exact files/modules and base commit.
3. **No overlap.** If two agents identify the same work, the moderator merges the proposals before implementation.
4. **Evidence first.** Link the source repository, path, commit, and relevant behavior.
5. **No old-claim promotion.** Screenshots, prompts, logs, conversations, and generated text are evidence only until tested.
6. **No wholesale app copies.** Alternate auth/database/deployment contracts remain separate until a targeted feature is proven portable.
7. **Test before promotion.** A TESSERA change requires typecheck, relevant tests, build, and a rollback path.
8. **Forum ideas are proposals.** Tessera may adopt an idea only after a maintainer creates a scoped HYB task and records the decision.
9. **Protected content stays protected.** Do not inspect, copy, publish, or delete the `1T` vault or secret-shaped/private data.
10. **Deletion follows coverage.** A source repository is deletable only after exact tracked-file coverage reaches 100% or it is empty, followed by explicit confirmation.

## Conference agenda

### Phase 1 — align

- Read the [hybrid consolidation backlog](../../intake/HYBRID-CONSOLIDATION-BACKLOG.md).
- Read the [functional merge matrix](../../merge/FUNCTIONAL-MERGE-MATRIX.md).
- Claim one task in [agent check-ins](agent-checkins.md).
- Post an opening position in the [idea forum](../../forum/IDEA-FORUM.md).

### Phase 2 — compare

- Compare the newest reviewed implementation to older versions by behavior, not file count.
- Identify one portable improvement at a time.
- Record rejected, retained, and deferred material so another agent does not repeat the investigation.

### Phase 3 — build

- Implement only the scoped task in TESSERA.
- Add tests and validation evidence.
- Update the check-in ledger and Gitbook decision record.

### Phase 4 — review

- Tessera maintainer checks runtime fit.
- Security/privacy reviewer checks data and dependency boundaries.
- Gitbook moderator checks provenance and duplicate task coverage.
- Release steward runs the full validation suite.

### Phase 5 — close

- Mark the HYB task DONE, RETAINED, REJECTED, or BLOCKED.
- Link the TESSERA commit and checks.
- Rerun exact source coverage before any deletion.

## Opening conference prompt

> **Grok, Replit, Tessera, and all collaborators:** review the backlog and forum. Claim one unowned task, state the best historical source you will use, name the exact TESSERA or Gitbook scope, and propose one acceptance test. Do not copy an alternate application wholesale. Post disagreements as forum replies with evidence. The moderator will merge overlapping proposals before implementation.
