# Tessera Next Delivery TODO

> Status is evidence-based. An item is complete only when its stated product outcome and recorded proof exist on the same current commit.

## [ ] T-369 — Restore a truthful dependency-registry signal

Repair the two reproducible `scripts/rea-registry.test.mjs` failures on current `main` without changing the lockfile merely to satisfy stale assertions. Real workspace dependency expectations must follow the intentionally locked package/catalog contract; fixture expectations may remain fixed. The registry must continue to reject malformed, unsupported, or unproven source records.

**Completion evidence:** the two named tests pass; the scripts suite passes; the exact head, commands, and outputs are recorded with the implementation review.

## [ ] TN-001 — Deliver a functional production Tessera Next theme

Implement the selected Obsidian Observatory design in the actual production React/Vite app at `artifacts/tessera`. The app must render synchronously in a readable dark theme before React hydration, preserve `tessera-accent` compatibility for legacy values and the six current facets, retain `tessera-font-color` behavior until an explicit migration is approved, use self-hosted licensed fonts or strong system fallbacks, and make no external font request. Interactive theme controls must remain labelled, keyboard reachable, and reduced-motion safe.

**Completion evidence:** focused theme tests cover token resolution, persisted preference compatibility, first-paint parity, and font/network constraints; current production typecheck/build pass; desktop and mobile smoke views of the production route are recorded from the current head.

## [ ] TN-002 — Keep the production route contract inspectable

Serve `artifacts/tessera/public/manus-routes.json` as a static JSON document containing every actual production page route and title, including dynamic patterns where applicable, but excluding APIs/assets/404-only behavior. The manifest must stay aligned with `App.tsx` and redirect behavior; a partial or invented route list is not acceptable.

**Completion evidence:** the app returns HTTP 200 JSON for `/manus-routes.json`; a source comparison documents every route included; the production smoke path reaches the key gate and a representative in-app route without route loss.

## [ ] TN-003 — Define before deleting or sharing UI surfaces

Create a route/API/preference and provenance matrix for the production app, preview, console, mockup sandbox, nextgen artifact, and archive material. The matrix must identify each active consumer, runtime/build role, replacement behavior, rollback/provenance location, and required tests. Do not delete a surface, archive, control, font, or shared primitive merely because it appears duplicated. Do not introduce symlinks between packages.

**Completion evidence:** each proposed retirement has consumer-search proof, behavior replacement proof, current checks, restoration/provenance location, and an explicit review decision. Until then this item remains open.

## [ ] GB-LEDGER — Record actual consolidation status in Gitbook

Update the authoritative Gitbook consolidation backlog, agent check-in ledger, queue/state snapshots, and any linked task record only after the related TESSERA change is merged successfully. Record the exact implementation/merge SHA, changed paths, current-head checks, UI smoke evidence, unresolved blockers, and a non-overlapping owner/scope. Preserve historical records instead of rewriting them as current facts.

**Completion evidence:** no active task in the Gitbook table conflicts with its check-in or machine-state record; completed statuses have immutable implementation and gate evidence; blocked entries name their missing source/ref, decision owner, and safe next action.

## [ ] VITALITY-BOUNDARY — Keep Vitality material isolated

Do not copy, import, or reintroduce Vitality/storefront material into Tessera or Gitbook. Inventory only safely visible current references and route any legitimate source file through a separate authorized source/ref and behavior review before transferring it to the designated Vitality repository. Historical labels or backup references alone are not transfer authority.

**Completion evidence:** no active Tessera runtime/package path depends on Vitality material; each authorized transfer, if any, has a named source/ref, destination receipt, provenance/license check, and consumer review. Until those conditions exist this item remains open.

## [ ] PEN-SCOPE — Make Tessera's product identity verifiable, not simulated

If a “Pen” capability is retained as a product requirement, define it as a scoped, local, reviewable feature: a visible provenance/identity record with explicit data sources, authorisation boundary, error/empty state, and deterministic tests. It must never represent that Tessera has an independent identity, external account, completed action, approval, or private repository authority that is not evidenced in the product.

**Completion evidence:** an approved product brief, implemented production route/component, documented data contract, deterministic tests, and clear UI state labels. Until then this item remains open.
