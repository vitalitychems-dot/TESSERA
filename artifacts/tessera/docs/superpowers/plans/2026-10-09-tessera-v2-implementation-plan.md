# Tessera V2 implementation plan

**Design:** `../specs/2026-10-09-tessera-evidence-gitbook-hybrid-design.md`  
**Status:** Local navigation and System Engine changes are implemented. The app build passes; typecheck reports 47 errors in other files. Gitbook/remote work is still blocked on authorized GitHub access, and automated UI tests are not configured.

## Goal

Implement the approved Tessera V2 navigation and evidence design locally. Preserve unique destinations and deep links; defer remote repository actions until the authorized GitHub connection is available.

## Work sequence

### 1. Baseline route and metric inventory

- Extract the desktop and mobile navigation entries and compare them with all registered routes.
- Classify each path as a unique page, an alias to the same state, or an intentional deep link to a distinct state.
- Mark excluded areas (crypto, trading, arbitrage, finance, Vitality, and store-related content) as route-smoke-test-only. Do not consolidate or redesign their content.
- Trace the six System Engine endpoints through API handlers and metric producers. Record response envelopes, units, timestamps, and current evaluation evidence.
- Do not query production databases or exercise state-changing controls.

**Exit check:** A route map exists for every registered path, and each System Engine metric has a verified source contract or an explicit “unverified” finding.

### 2. Introduce a shared navigation registry

- Define canonical destinations, aliases, desktop groups, mobile destinations, labels, icons, and access metadata in one typed registry.
- Preserve every existing URL. Route aliases must keep their intended selected tab or section.
- Add focused tests for duplicate detection and alias-to-canonical mapping. Only entries with equivalent destination and state may share one visible link.

**Exit check:** Desktop and mobile navigation are derived from the same registry, with no lost route behavior.

### 3. Rework responsive application navigation

- Keep the grouped desktop sidebar, deriving links from the registry.
- Replace the long mobile strip with Chat, Knowledge, System, and searchable More.
- Build Knowledge as a grouped destination list and More as a searchable, categorized directory of all other destinations; preserve excluded destinations separately without redesigning or consolidating their page content.
- Verify touch target sizing, safe-area spacing, selected-route visibility, keyboard navigation, focus management, and accessible labels.

**Exit check:** The mobile entry points are limited to the approved four, and every unique destination remains discoverable through the directory.

### 4. Reorganize System Engine into four tabs

- Map Capability to aligned evaluation results only; show “Not evaluated” when there is no qualifying evaluation.
- Map AGI Training activity, Improvement, and Self-Evolution to Learning, keeping activity and evaluation evidence distinct.
- Map Evo Health, scheduler, and Agents to Operations.
- Map Quantum and verified architecture claims to Architecture, labeling measured, simulated, proposed, and unverified items.
- Remove repeated summaries only after confirming that the receiving tab contains the complete source-backed information.
- Retain current endpoint contracts and data freshness unless testing finds a concrete defect. Correct envelope mismatches explicitly; do not introduce silent fallback values.
- Keep pause, resume, and reset operations authorization-protected; test only in development with suitable authorization.

**Exit check:** All six original data sources work in their new destinations, and each displayed value has an accurate unit, provenance, and observation/evaluation time.

### 5. Add the verified Gitbook entry point

- Once authenticated repository access is restored, read the current Gitbook start-here instructions, issue #2, latest main commits, and open pull requests.
- Verify the canonical documentation destination and access requirements.
- Add an external Documentation link without copying Gitbook instructions into Tessera.

**Exit check:** The link opens the verified canonical destination in a separate browsing context and is accessible on desktop and mobile.

### 6. Verify locally and prepare remote work only when unblocked

- Run Tessera typecheck and build:
  - `pnpm --filter @workspace/tessera run typecheck`
  - `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/tessera run build`
- Run API tests:
  - `pnpm --filter @workspace/api-server test`
- Add or configure focused front-end tests for registry mapping, duplicate classification, mobile directory search, and deep-link selection.
- Smoke-test representative routes across every desktop group and every route family on mobile; separately verify all excluded routes still resolve without modifying their content.
- Capture desktop and mobile previews and check browser logs.
- If GitHub access is restored, follow the Gitbook instructions, use the authorized dedicated identity, create a focused TESSERA branch and PR, and never push directly to `main`.

**Exit check:** Typecheck, build, focused tests, and desktop/mobile route smoke tests pass. Remote status is reported separately from local validation.

## Blockers and safety

- Current GitHub connector access is unavailable; the local Git remote points to Gitbook. Do not push or commit to that remote as a substitute for TESSERA.
- Vitality extraction is deferred. Do not move or delete files without an identified destination and a reviewed, exact source-path manifest.
- Do not access `father.md`, personal-data files, `1T vault`, or `natal-vault.json`.
- Do not request or expose credentials. Do not claim remote repository completion or hardware/model capabilities without evidence.
