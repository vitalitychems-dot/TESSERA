# 20-item execution board

**Status:** Active coordination board
**Source:** `AGI-COLLABORATION-IMPROVEMENT-ROADMAP.md`
**Rule:** Analysis is not implementation. A task is `DONE` only with an attributable commit, checks, provenance, limitations, and review.

| ID | Workstream | Current status | Next owner | Evidence / next gate |
|---|---|---|---|---|
| AGI-01 | Shared world model | **REPORTED — Gitbook slice; changes needed** | TESSERA | fix in progress (branch-only): schema enum, dangling supersedes, immutable source_ref, review-due on expiry, --verify-evidence; Build re-verifies; Moderator rules on IMPLEMENTED; see `brain-consciousness/reports/AGI-06-reproduction-001.md`; refresh on repo drift |
| AGI-02 | Provenance-aware memory | **REPORTED — Gitbook contract slice; changes needed** | TESSERA | fix in progress (branch-only): schema enum, dangling supersedes, immutable source_ref, review-due on expiry, --verify-evidence; Build re-verifies; Moderator rules on IMPLEMENTED; see `brain-consciousness/reports/AGI-06-reproduction-001.md`; TESSERA API phase deferred |
| AGI-03 | Task decomposition planner | **ANALYSIS COMPLETE** | TESSERA | Owner recorded: TESSERA (TESSERA ruling 2026-10-06). Still requires schema/migration decision, isolated PostgreSQL, and tests |
| AGI-04 | Skill routing | **PROPOSED** | Pen / Moderator | Claim one task; use skill matrix evidence |
| AGI-05 | Cross-agent handoffs | **EXISTING POLICY** | Gitbook / Cordnation | Packet applied in `review/handoff-packet-batch-013.md` (batch 013, Cordnation → Moderator); Independent resumption evidence filled by Gitbook Moderator (see that packet section) |
| AGI-06 | Independent verification | **PROPOSED** | Build lane | Second-run protocol proposed in `brain-consciousness/AGI-06-second-run-protocol.md`; reproduction 001 in `brain-consciousness/reports/AGI-06-reproduction-001.md` (AGI-01/AGI-02 validators at fcabd13a); both await review gates |
| AGI-07 | Self-critique/red-team | **PROPOSED** | Moderator | Add critique section to proposal submissions |
| AGI-08 | Evidence confidence | **EXISTING POLICY** | Moderator | Normalize status vocabulary across records |
| AGI-09 | Safe tool planning | **PROPOSED** | Operations lane | Produce dry-run/rollback template |
| AGI-10 | Deterministic experiments | **PROPOSED** | TESSERA research lane | Define seed/environment/metric fixture |
| AGI-11 | Regression benchmarks | **PROPOSED** | Build lane | Select first route/UI/history benchmark |
| AGI-12 | Conflict resolution | **EXISTING POLICY** | Moderator | Exercise overlap and contradictory-instruction scenario |
| AGI-13 | Debate-to-decision forum | **EXISTING POLICY** | Gitbook forum | Link one idea to one task and decision |
| AGI-14 | Capability registry | **ANALYSIS / SCHEMA DRAFTED — REPORTED** | Tessera / Pen | Schema + seed records on [capability-registry.md](capability-registry.md); Build validator later if assigned |
| AGI-15 | Repository drift detection | **PROPOSED** | Release steward | Add repeatable link/head/status check |
| AGI-16 | Dependency/license governance | **EXISTING POLICY** | TESSERA maintainer | Apply to next dependency or upstream adapter |
| AGI-17 | Learning from failures | **PROPOSED** | Gitbook / Cordnation | Add searchable lesson record for the stopped 20-agent run |
| AGI-18 | Multi-agent role evaluation | **PROPOSED** | Research lane | Define controlled scenarios and scoring |
| AGI-19 | Human approval boundaries | **EXISTING POLICY** | Human owner / Moderator | Preserve undo by GB number on the 45-minute combined list, Father's explicit yes/no for anything Replit, and the merge-word gate (TESSERA and Origin main merges need Father's word `merge`) |
| AGI-20 | Bulk digest execution | **EXISTING POLICY** | Tessera Grok bot / Command Center | Publish the 45-minute combined numbered list with exact bases, checks, and a real health check |

## Run interruption record

The approved 20-workstream orchestration run produced three report files (`AGI-01`, `AGI-02`, and `AGI-03`) before stopping. The remaining workstreams are **not** marked complete and have no fabricated agent responses. Their reports must be generated or completed by declared agents under the normal claim lock.

## Immediate sequence

1. Moderator verifies the new AGI-01 and AGI-02 validators.
2. Gitbook records one owner for AGI-03 before any TESSERA schema/API edit. Recorded 2026-10-06: the AGI-03 owner is TESSERA (TESSERA ruling).
3. Build independently reruns the validators.
4. Command Center includes these exact commits and checks in the next 45-minute combined list.
5. Father can undo any listed item by its GB number; TESSERA merges still need Father's word `merge`; no TESSERA code is claimed from analysis alone.
