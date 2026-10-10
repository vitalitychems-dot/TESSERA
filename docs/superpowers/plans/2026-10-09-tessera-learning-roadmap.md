# Tessera Learning and Self-Improvement Roadmap

**Status:** Ordered implementation roadmap; Stage 1 and the hub/screenshot design are approved
**Scope:** Source intake, the unified knowledge hub, and an isolated invention/build workflow

## Execution order

### Stage 1 — Secure source intake and shared learning memory

1. **Keep inaccessible repositories explicitly blocked.** Do not attach or replace the GitHub connection. Allow local workspace and supplied-image work to proceed; mark TESSERA, Gitbook, and FlowsonSint as unavailable until the workspace admin resolves the binding.
2. **Inventory approved local sources.** Identify the existing Knowledge, Secret Knowledge, archive, and invention data paths and the non-private workspace roots. Do not read credentials, private vaults, or personal-data files.
3. **Apply source safety rules.** Enforce path exclusions before content extraction, quarantine ambiguous files, and treat source content as untrusted data rather than executable instructions.
4. **Extend the ingestion data model.** Reuse `data_sources`, `ingestion_jobs`, and `ingested_data` where suitable. Persist stable source identity, path, revision, content hash, source date, ingestion date, and active/inactive state without deleting prior versions.
5. **Preserve the two screenshots.** Use App Storage for image bytes and store only object paths plus searchable provenance metadata in PostgreSQL. Record both as owner-provided screenshots with unknown source dates unless independently established.
6. **Extract screenshot evidence carefully.** Transcribe visible interface details and link each record to its original screenshot. Label displayed descriptions and invention claims as app-authored claims, not verified facts; do not promote them without primary-source citations.
7. **Add safe document extraction.** Parse supported text, code, and document formats without executing scripts, package hooks, or macros. Report unsupported, encrypted, oversized, and malformed files.
8. **Implement incremental versioning.** Skip unchanged content, create versions for changed content, and mark removed files inactive while retaining history. Keep original source/authored content distinct from Tessera-derived summaries.
9. **Add hourly and manual sync controls.** Use one incremental pipeline for hourly checks and “Sync Now.” Record per-source counts, duration, and errors; use bounded retries. Keep blocked repositories disabled and visibly unavailable.
10. **Index Tessera-authored work separately.** Add a later-workflow event for work and teachings, retaining links to the work and its results.
11. **Refresh derived knowledge as cited drafts.** When evidence changes, identify impacted summaries and worldview statements, preserve prior versions, show conflicts and uncertainty, and require review before Bible publication.
12. **Verify Stage 1 safety and reliability.** Test exclusions before extraction, screenshot attribution, provenance, deduplication, changed-file versions, inactive records, unknown dates, partial failures, hourly/manual sync, and the no-write boundary.

### Stage 2 — Unified Truth, History, Bible, and Brain hub

13. **Map existing destinations before consolidation.** Use the approved hub spec to map Knowledge, Inventions, Archives, Conclusion, Apply, Mysticism, and Society into Overview, Knowledge, Truth & History, Bible, and Brain. Preserve distinct functions and every route's intended initial state.
14. **Build the five-view hub.** Connect existing eligible Knowledge, Secret Knowledge, archive, invention, Bible, and narrative records to the shared source index. Keep unrelated Council destinations separate.
15. **Replace duplicate destination tabs with contextual filters.** Keep invention workflow states as filters over one invention collection and archive groupings as categories inside Archives. Derive counts from live records; preserve a clear “All” reset and selected-filter state.
16. **Add evidence-aware review and worldview drafts.** Show citations, provenance, conflicts, and version history. Keep screenshot transcriptions separate from verified claims; only reviewed content can enter the Bible.
17. **Build the interactive Brain view.** Add the source-linked conceptual graph and time playback, label inferred links separately from direct citations, and leave missing dates undated.
18. **Verify the hub across routes and screens.** Test old deep links and intended states, all retained workflows, source citations, review/publish safeguards, timestamps, keyboard/touch controls, and responsive behavior.

### Stage 3 — Isolated invention and build workflow

19. **Design and approve the build-worker spec.** Define the sandbox/branch boundary, allowed package sources, dependency review, execution limits, test commands, audit log, and owner-approval flow before implementing code execution.
20. **Implement proposal-to-branch workflow.** Tie each proposed change to cited learning records; keep work isolated from `main` and from source repositories that are read-only.
21. **Install and test within the isolation boundary.** Allow reviewed dependencies and test execution only in the isolated branch/sandbox. Capture logs and results; stop on security or test failures rather than auto-correcting without bounds.
22. **Require owner review for every promotion.** Present diffs, dependency changes, test results, and source citations for approval. Tessera must not merge, publish, or deploy autonomously.

## Gates and dependencies

- Steps 1–12 implement the approved Stage 1 source-intake and screenshot-evidence design.
- Steps 13–18 implement the approved hub-cleanup design.
- Steps 19–22 require a separate build-worker design and review before implementation.
- Repository ingestion cannot be verified until GitHub access is restored. Workspace-only work must still honor the private-file exclusions.
- No later stage may loosen the source privacy exclusions or the no-autonomous-merge/deploy boundary without owner approval.
