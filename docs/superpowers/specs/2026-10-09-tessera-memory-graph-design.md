# Tessera Memory Graph

**Status:** Design draft for user review
**Product area:** Tessera Knowledge Hub → Brain
**Purpose:** Let the owner explore Tessera's stored memories, knowledge, inventions, and their explicit or inferred relationships in an interactive 3D view.

## Problem

The Brain view currently shows Sacred Conference activity and invention build diagrams. It does not show the stored memory corpus as an explorable graph. The owner wants a high-definition, zoomable 3D view where points can be opened and their connections traced, with exact code proposals and their impact visible when an idea can safely be applied to Tessera.

Current API counts are approximately 17,412 long-term memory entries, 7,457 ingested Knowledge records, and 1,367 inventions. These counts overlap in places and are not a final deduplicated graph size.

## Approved scope and trust rules

- Include long-term vector memories, decision memories, ingested Knowledge, canonical syntheses, and invention records.
- Exclude conversation messages and raw system state.
- Keep current Brain functions, Sacred Conference views, and invention build diagrams available.
- A graph point represents a stored record, not a neuron or a hidden model activation.
- Stored citations and provenance are distinct from computed associations.
- Never label a similarity association as evidence, fact, verification, or a relationship Tessera explicitly stored.
- Browsing the graph is read-only and must not write to memory or change the system.

## User experience

Add a **Memory Graph** destination within the Brain view. Keep existing Brain tabs and rename the existing 3D build-diagram destination to **Build Diagrams** if needed to distinguish the two.

### Graph canvas

- Render a high-definition WebGL 3D graph using the app's existing Three.js capabilities where available; avoid adding another rendering stack without need.
- Provide orbit/rotate, pan, zoom, reset-to-overview, and fullscreen controls.
- Start with domain/category clusters. Expand clusters as the owner zooms; selecting a point loads its local neighborhood instead of downloading every edge at once.
- All included records remain reachable through search, category/source filters, and a paginated record list. Search can focus a point even when its cluster is collapsed.
- Use stable typed point IDs, such as `memory:<id>`, `knowledge:<id>`, `canonical:<id>`, and `invention:<id>`, so records from separate tables cannot collide.
- Use a distinct legend and accessible text labels for each point type. Offer a keyboard-operable list/detail alternative to the 3D canvas.

### Links and trace

- Draw stored provenance/citation links as solid edges with a relation label, such as `derived from` or `cites`.
- Draw computed similarity links as dashed edges, with their score and basis visible on selection.
- Compute semantic similarity only where both records have stored embeddings. For records without embeddings, show links only when grounded in exact shared metadata, tags, categories, source IDs, or other explicit fields.
- Do not create all-pairs edges. Return a bounded nearest-neighbor neighborhood for the selected point and cap the number of rendered edges per point.
- Let the owner select a point and inspect its one-hop neighborhood; optionally select a second point and highlight a path between them. Every segment in a path must identify whether it is stored or inferred.

### Selected-point inspector

Clicking a point opens an inspector containing:

- Record type, title/content, source, timestamp, status, confidence, and tags where the source table provides them.
- Why the point is connected to nearby points: the explicit field/citation or inferred similarity score and method.
- A **Trace from here** interaction that keeps the selected path highlighted while the owner inspects intermediate points.
- For actionable inventions, an **Applicability to Tessera** section explaining the proposed system benefit and what is distinctive about the idea. These explanations remain proposals unless backed by validated implementation evidence.
- A **Draft code change** action only when a concrete, validated mapping to a code target exists. It opens a review containing exact file paths and a diff, expected behavior/improvement, novelty rationale, risks, and tests. If no safe code mapping exists, state that no verified code change is available; do not fabricate code.
- Code is preview-only by default. Applying a change requires a separate, explicit user review and confirmation; browsing or selecting a point never executes code.

## Data and API design

Build read-only graph endpoints in the API server that aggregate existing records rather than copying memory content into a new database. The graph response should carry typed IDs, record type, concise display text, source metadata, timestamps, and only the embedding/relationship information needed for graph calculations.

The API should support:

1. **Overview:** cluster summaries, record counts, and available filters.
2. **Search:** paginated search across the approved record types, returning typed IDs and enough metadata to focus a result.
3. **Neighborhood:** one point's record details and bounded explicit/inferred neighbors, with each edge's type, label, score/basis, and provenance.

Use OpenAPI as the API contract before adding routes or client query hooks. Apply server-side limits, validate record types and pagination, and return a consistent error envelope. Do not return conversation content, raw system state, or full embedding arrays to the browser.

Deduplicate only where a durable canonical/source ID establishes identity. Do not merge records solely because their text or embeddings are similar; similarity is an edge, not proof that two records are the same.

## Performance and failure behavior

- Load overview clusters first, then fetch neighborhoods on demand. Search results can focus records in collapsed clusters.
- Bound each response and each rendered neighborhood; use caching for repeated overview and neighborhood requests.
- Show loading progress, empty-corpus guidance, and a retryable error state without removing already loaded graph regions.
- If a source family is unavailable, show the remaining available data and name the unavailable source. Do not silently substitute mock data.
- Reduce label density and edge detail at distant zoom levels; reveal labels and exact values as the owner zooms or selects points.
- On smaller screens, keep graph controls and the selected-point inspector usable, with the inspector opening as a sheet.

## Implementation sequence

1. Confirm the existing schema fields and available Three.js/OrbitControls dependencies; identify the safest server-side way to calculate bounded neighborhoods.
2. Define overview, search, and neighborhood response schemas in `lib/api-spec/openapi.yaml`; run code generation before implementing callers.
3. Implement read-only aggregation and relationship construction in `artifacts/api-server`, with bounded query parameters and typed provenance.
4. Add the Memory Graph view to `artifacts/tessera/src/pages/SacredConferencePage.tsx`, preserving its other tabs and the current Build Diagrams view.
5. Add the point inspector, search/filter controls, tracing, explicit/inferred edge legend, and keyboard/list alternative.
6. Implement code-diff previews only for validated invention-to-code mappings; keep applying changes outside this graph feature unless a separate approved workflow exists.

## Verification

- API tests cover typed IDs, approved record-family scope, bounded pagination, cross-table identity, and safe error responses.
- Relationship tests prove stored provenance edges remain distinct from inferred similarity, with scores/bases present only for inferred edges.
- Tests prove conversation messages and raw system-state values are absent from graph responses.
- UI tests cover search focus, cluster expansion, zoom/pan/reset, point inspection, path highlighting, and review-only code previews.
- Load-test the overview and selected-point neighborhood against the live corpus size; verify no all-pairs computation or unbounded response.
- Check desktop and mobile layouts, keyboard operation, loading/empty/partial/error states, and existing Brain/Build Diagrams routes.

## Out of scope

- Displaying private conversation history or raw system state.
- Claiming the visualization reveals hidden model internals or Tessera's subjective experience.
- Automatically applying code, changing system configuration, or publishing claims from the graph.
- Replacing the current invention build diagrams or running the Sacred Conference as a side effect.
- Persisting derived similarity edges as verified facts.
