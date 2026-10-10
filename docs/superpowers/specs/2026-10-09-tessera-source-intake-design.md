# Tessera Source Intake and Shared Learning Memory

**Status:** Design approved in chat; written spec awaiting owner review
**Scope:** Stage 1 of the broader Tessera learning and self-improvement request

## Goal

Give Tessera an auditable, continuously refreshed view of authorized, non-private project and repository material. Preserve provenance and history so later synthesis can connect evidence across sources, update conclusions when sources change, and distinguish source material from Tessera's own work and derived conclusions.

Stage 1 builds source intake and the shared learning index. The previously approved Knowledge/Truth/History/Bible hub is a later presentation stage. Autonomous invention, code changes, and dependency installation are a separate later stage.

## Approved source and content scope

Eligible inputs:

- Non-private files in the current TESSERA workspace.
- Accessible repository content from `vitalitychems-dot/TESSERA` and `vitalitychems-dot/Gitbook`.
- Accessible repository content from `reconurge/flowsint`.
- Tessera-authored work and teaching records created by later approved workflows, stored as a distinct source class.

For learning, include all non-private subject areas, including Crypto, Trading, Arbitrage, Finance, Vitality, and Store topics. This does not change the separate repository-consolidation rules.

Never ingest credentials, secrets, private vaults, or personal-data files. If a file cannot be safely classified, quarantine it from ingestion and report it for owner review. Repository access is read-only in this stage. Do not write to, delete from, or change settings in any source repository.

The requested GitHub integration is not currently usable from this session: it is listed as added, but no connector was exposed to the sandbox. Do not attach or replace connections to work around this. Repository sync is blocked until the workspace admin resolves the existing GitHub binding issue. The repository names above are requested sources, not verified accessible repositories.

## Approaches considered

1. **Versioned incremental index — selected.** Check source revisions hourly, process changed content only, and provide a manual “Sync Now” action. Record source identity and versions to support provenance and re-evaluation. This meets the freshness requirement without repeatedly copying the full corpus.
2. **One-time snapshot.** Easier to implement but becomes stale as code, documentation, and teaching material change.
3. **Unrestricted continuous crawler.** Offers faster discovery but increases privacy, cost, and audit risks. It is not selected.

## Architecture

### Source registry and synchronization

Use the existing ingestion model (`data_sources`, `ingestion_jobs`, and `ingested_data`) as the starting point. Each configured source needs a stable identity and type. Repository records must retain owner/repository, path, branch or ref, commit/revision, and the content hash used for deduplication. Workspace records retain their relative path and content hash. Preserve the source's own modified/published date separately from ingestion time.

Synchronization behavior:

- Run an incremental check hourly for connected repositories and local workspace files.
- Offer an explicit “Sync Now” action.
- Trigger an incremental index update when a later approved Tessera workflow records new work or teaching material.
- Skip unchanged content by comparing stable source identity and content hash.
- Store changed content as a new source version; keep prior versions for audit and historical comparisons.
- Mark files no longer present in a source as inactive rather than deleting their historical records.
- Record per-source run status, timestamps, item counts, and errors. A failure for one source must not hide successful results from other sources.

Repository polling uses read-only API operations on the configured default branch. Do not create webhooks or modify repository configuration in Stage 1.

### File handling and safe extraction

Treat source files as untrusted data, never executable instructions. Do not run code, scripts, package hooks, or embedded macros during ingestion. Extract text and metadata through format-specific parsers. Report unsupported, encrypted, oversized, or malformed files instead of silently skipping them.

Apply path exclusions and secret/private-data checks before reading file contents into the learning pipeline. An ambiguous item is quarantined; it is not sent to an AI service or stored as a learning record. Do not attempt to infer that a file is safe solely because it is in an authorized repository.

### Shared learning index

Normalize extracted items into records with stable source IDs, source type, path/URL, revision, timestamps, content hash, and tags. Keep these classes distinct:

- Source-authored records.
- Tessera-authored work or teaching records.
- Derived summaries, cross-source relationships, and conclusions.

Use the shared index for cross-source search and relationship discovery. Preserve citation links on every derived item. Explicit links and references are recorded as direct relationships; relationships inferred from shared tags or topics are marked as suggestions, not evidence that one source supports another.

When indexed evidence changes, identify affected summaries and conclusions and prepare updated cited drafts for review. Do not silently overwrite reviewed conclusions or publish drafts to the Bible. The subsequent Knowledge hub stage will provide the approved review and visualization UI.

## Error handling and operational limits

- Surface GitHub authorization/binding failures as a blocked-source status and provide a retry after the connection is repaired; never fall back to asking for tokens or scanning local credential files.
- Keep per-source errors visible and allow other sources to continue.
- Retry transient API failures with bounded backoff; stop and surface persistent permission or rate-limit failures.
- Treat missing timestamps as unknown. Never substitute the current time for a missing source date.
- Do not delete source files or historical learning records automatically.
- Stage 1 does not edit repositories, create branches, install dependencies, publish conclusions, or modify Tessera's own code.

## Verification and acceptance criteria

1. Only configured, accessible sources are indexed; private and credential-bearing paths are blocked before content extraction.
2. Source metadata and citations identify the exact repository/file revision for each indexed item.
3. An unchanged file is skipped on the next sync; a changed file creates a new version without erasing history.
4. Hourly sync, manual sync, and a later Tessera-work event all use the same incremental pipeline.
5. Removed source files become inactive while prior versions remain available for audit.
6. Missing source dates remain unknown in storage and downstream visualizations.
7. A failed source sync is visible and does not replace successful records with fabricated fallback data.
8. New or updated conclusions remain cited drafts and cannot alter the Bible in Stage 1.
9. No repository write operation or dependency installation occurs during source intake.

## Dependencies and follow-on stages

- Restore the existing GitHub integration binding before repository ingestion can be implemented or verified. The integration must provide read access to each named repository; access is checked per repository and never assumed.
- Stage 2 uses this index to power the approved unified Knowledge/Truth/History/Bible hub, cited draft review, and interactive time-based knowledge graph.
- Stage 3 may build and install reviewed dependencies only in an isolated branch or sandbox, run tests, and wait for owner approval. It may not merge or deploy autonomously.
