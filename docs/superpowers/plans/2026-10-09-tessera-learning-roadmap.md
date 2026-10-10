# Tessera Learning and Self-Improvement Roadmap

**Status:** Ordered implementation roadmap; only Stage 1 design is formally approved
**Scope:** Source intake, the unified knowledge hub, and an isolated invention/build workflow

## Execution order

### Stage 1 — Secure source intake and shared learning memory

1. **Restore GitHub access safely.** Have the workspace admin resolve the existing connection-binding issue. Do not attach or replace connections to work around it. If access remains blocked, keep repository sync disabled and report the blocker.
2. **Verify each authorized source.** Confirm read access independently for the TESSERA workspace, `vitalitychems-dot/TESSERA`, `vitalitychems-dot/Gitbook`, and `reconurge/flowsint`. Use read-only access to configured default branches; do not write repository settings or files.
3. **Define source allowlists and exclusions.** Configure the approved source roots and block secrets, credentials, private vaults, and personal-data files before file contents enter extraction. Quarantine ambiguous items for owner review.
4. **Extend the ingestion data model.** Reuse `data_sources`, `ingestion_jobs`, and `ingested_data` where suitable. Persist stable source identity, path, revision/commit, content hash, source date, ingestion date, and active/inactive state without deleting prior versions.
5. **Add safe file extraction.** Parse supported text, code, and document formats without executing scripts, package hooks, or macros. Make unsupported, encrypted, oversized, and malformed files visible in source status.
6. **Implement idempotent incremental sync.** Compare file hashes and repository revisions; skip unchanged items and create versioned records for changed items. Mark removed files inactive while retaining history.
7. **Add hourly and manual sync controls.** Run the same incremental pipeline hourly and through a “Sync Now” action. Record per-source counts, duration, and errors; use bounded retry/backoff for transient failures.
8. **Index Tessera-authored work separately.** Provide a later-workflow event to record tested outputs and teachings as their own source class, with links to the work and its results.
9. **Refresh affected derived knowledge.** When source evidence changes, identify impacted summaries and prepare cited conclusion drafts. Do not overwrite reviewed conclusions or publish into the Bible from Stage 1.
10. **Verify Stage 1 safety and reliability.** Test exclusions before extraction, exact provenance, deduplication, changed-file versions, inactive records, honest unknown dates, partial-source errors, hourly/manual sync, and the no-write boundary.

### Stage 2 — Unified Truth, History, Bible, and Brain hub

11. **Formalize and review the hub spec.** Record the previously approved five-view design—Overview, Knowledge, Truth & History, Bible, and Brain—and confirm legacy-route mappings before implementation.
12. **Build the unified data-backed hub.** Connect the existing Knowledge, Secret Knowledge, Bible, Narrative, and relevant Conference material to the Stage 1 source index. Keep excluded product areas and Council destinations separate.
13. **Add reviewed conclusions and the interactive graph.** Implement cited drafts with explicit approval and version history; build the rotating knowledge graph with a time slider, source-backed edges, undated items, and clear labeling that it is not a model-internals view.
14. **Verify the hub across routes and screens.** Test preserved deep links, source citations, review/publish safeguards, timestamp behavior, keyboard/touch controls, and responsive performance.

### Stage 3 — Isolated invention and build workflow

15. **Design and approve the build-worker spec.** Define the sandbox/branch boundary, allowed package sources, dependency review, execution limits, test commands, audit log, and owner-approval flow before implementing code execution.
16. **Implement proposal-to-branch workflow.** Tie each proposed change to cited learning records; keep work isolated from `main` and from source repositories that are read-only.
17. **Install and test within the isolation boundary.** Allow reviewed dependencies and test execution only in the isolated branch/sandbox. Capture logs and results; stop on security or test failures rather than auto-correcting without bounds.
18. **Require owner review for every promotion.** Present diffs, dependency changes, test results, and source citations for approval. Tessera must not merge, publish, or deploy autonomously.

## Gates and dependencies

- Steps 1–10 implement the approved Stage 1 source-intake design.
- Steps 11–14 require a written hub spec review before implementation.
- Steps 15–18 require a separate build-worker design and review before implementation.
- Repository ingestion cannot be verified until GitHub access is restored. Workspace-only work must still honor the private-file exclusions.
- No later stage may loosen the source privacy exclusions or the no-autonomous-merge/deploy boundary without owner approval.
