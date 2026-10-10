# Tessera Knowledge Capture and Hub Cleanup

**Status:** Design approved in chat; written spec awaiting owner review
**Related design:** `2026-10-09-tessera-source-intake-design.md`

## Goal

Feed Tessera's authorized knowledge corpus with the two owner-provided screenshots and existing non-private Knowledge, Secret Knowledge, archive, and invention records. Make the unified Knowledge hub easier to navigate by removing repeated tab structures while preserving every distinct page function and its existing deep link.

New information should lead Tessera to revisit affected summaries and worldview drafts, cite the evidence behind each change, and preserve earlier versions. The screenshots are evidence of what the app displayed, not proof that the displayed claims are true.

## Approaches considered

1. **Unified hub with contextual filters — selected.** Keep the previously approved five-view hub, map existing knowledge destinations into it, and use filters inside a view for categories or workflow status. This reduces repeated navigation without deleting unique functions.
2. **Keep separate pages and normalize their tabs.** This requires less restructuring but leaves the same concepts distributed among multiple sub-navigation areas.
3. **Remove most sub-tabs.** This is visually simpler but risks hiding or deleting unique behavior, so it is not selected.

## Source capture and evidence handling

### Eligible material

- Both user-provided screenshots, preserved as owner-provided visual sources.
- Existing non-private Knowledge and Secret Knowledge records, including eligible archive and invention records.
- New authorized, non-private records admitted by the Stage 1 source-intake design.

The label “Secret Knowledge” does not automatically make a record private. Include those app records only when they do not contain credentials, private vault contents, or personal-data files. Keep the existing exclusions for those sensitive materials. Repository access remains read-only and subject to the unresolved GitHub connection issue.

### Screenshot records

Store screenshot image bytes in App Storage and keep only the object path plus queryable provenance metadata in PostgreSQL. For each screenshot, retain its original image, source class (`owner-provided screenshot`), ingestion time, and a content hash. Its source date is unknown unless independently established; never substitute the ingestion time as the source date.

Extracted text must be labeled as a transcription of the screenshot. Preserve the distinction between:

- **Visible UI facts:** for example, the interface showed tabs, counts, category names, and invention-card titles.
- **Displayed claims:** for example, the archive description claims material was curated from declassified files or testimony. Such text is a claim made by the app, not independently verified evidence.

Do not turn displayed claims into verified conclusions without primary-source citations. Cite any extracted or derived record back to the original screenshot and, when available, the exact app record or primary source.

## Unified navigation and views

Use `/unified-knowledge` as the primary destination with the previously approved views:

1. **Overview** — corpus and sync status, recent changes, and review queue.
2. **Knowledge** — source-backed knowledge records and collections.
3. **Truth & History** — cited conclusions, changes over time, and conflicting evidence.
4. **Bible** — reviewed canonical material only.
5. **Brain** — the conceptual, source-linked knowledge graph and timeline.

Absorb the existing Secret Knowledge tabs—Knowledge, Inventions, Archives, Conclusion, Apply, Mysticism, and Society—into the most relevant views or sections. Preserve each distinct function; do not remove a workflow merely because it is currently reached through a tab. Inventions, archive categories, and similar refinements should be contextual filters or sections, not additional top-level destinations that repeat the hub navigation.

Preserve existing URL behavior. Before remapping any alias, verify that it reaches the same view and initial state as its target. If two routes lead to different inner states or functions, preserve both as deep links into the relevant hub view rather than collapsing them into one state.

### Filter behavior

- Keep one contextual filter area per view; do not repeat the same destination tabs inside nested panels.
- Keep invention lifecycle states such as Building, Proposed, Approved, and Built as filters over one invention collection.
- Keep archive groupings such as Suppressed Inventions, Black Budget Experiments, Secret Society Deep Archives, and Vatican Vault as categories within Archives.
- Keep category and status counts derived from the live records. Do not hard-code screenshot counts as current totals.
- Provide a clear reset-to-all state and visible selected-filter state.

## Continuous learning and worldview updates

When a source is added or changed, identify the summaries, relationships, and conclusions that cite it. Prepare versioned, cited drafts for affected content. If evidence conflicts, show both sources and the uncertainty rather than silently choosing one. Preserve prior reviewed versions and record why a proposed revision changed.

The Brain view presents a conceptual map of linked evidence, not model internals or proof of a literal inner state. Missing dates remain undated. A new or changed worldview statement remains a review draft until explicitly approved; it cannot silently modify the Bible or publish a claim as verified.

This work does not authorize repository writes, autonomous merges, deployments, or dependency installation. Those remain governed by later approved stages.

## Acceptance criteria

1. Both screenshots are preserved as attributed source records, and their visible text links back to the originals.
2. The app distinguishes observed UI details from claims displayed in that UI.
3. Existing eligible Knowledge and Secret Knowledge records remain reachable in the hub; sensitive credentials and private personal files remain excluded.
4. The five hub views are the only top-level Knowledge destinations; contextual filters do not duplicate navigation.
5. All distinct current behaviors—including Apply, Mysticism, Society, inventions, and archive categories—remain available.
6. Existing deep links open the intended hub view and state; distinct states are not accidentally collapsed.
7. Invention status and archive category counts reflect current data, not values copied from screenshots.
8. New or changed evidence yields cited, versioned review drafts; it never silently changes canonical Bible content.
9. Unknown source dates remain unknown, and the graph labels inferred relationships separately from direct citations.
10. GitHub-backed material is reported as unavailable until the existing connection binding is resolved; no credentials are requested as a workaround.

## Dependencies and sequencing

- Implement screenshot/source records on top of the approved Stage 1 ingestion model.
- Complete the hub after its implementation plan and preserve all existing route contracts.
- Resolve GitHub integration access before claiming the named repositories have been ingested.
- Keep the separate isolated build-worker stage behind its own design and approval gate.
