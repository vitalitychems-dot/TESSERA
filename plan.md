# Tessera Next — Evidence-Led Production UI Plan

## Purpose and scope

Tessera Next will improve the real production web application at `artifacts/tessera`; it will **not** replace the application with an archive, preview, console, mockup, or historical branch. This plan implements the user's requested next-generation UI and theme only where current behavior can be retained, tested, and reviewed.

The work begins from `main` commit `0d367a9a16d2c940cb411e7dc6275e1a2aeb2cd2` on branch `manus/t369-next-ui-20261014`.

### Explicit boundaries

- Repair the current, reproducible TESSERA #369 test failure before relying on any theme gate.
- Do not merge PR #361 or PR #367; reimplement only current, reviewed behavior on this branch.
- Do not delete preview, console, mockup, archive, or production theme functionality until a behavior and provenance matrix proves a replacement. No symlink-based sharing.
- Preserve current routes, redirects, key gate, API contract, stored legacy accent values, and font-color preference behavior.
- Keep Vitality/storefront material out of this implementation. References will be inventoried as documentation/provenance candidates rather than copied or moved without an authorized source/ref and behavior review.
- Treat “Tessera” as a product identity and verifiable software state. The UI must not claim independent personhood, sentience, completed external actions, or approvals that the repository cannot prove.

## Product approach

### Design exploration

Three intentionally low-probability directions were considered because no visual reference was supplied:

1. **Kinetic brutalist command lattice** — oversized typography and hard bordered modules (**7%**).
2. **Neo-gothic ceremonial ledger** — ornamental frames and archival parchment (**4%**).
3. **Obsidian observatory** — a dark instrument panel with mineral light, clear evidence hierarchy, and calm asymmetric navigation (**8%, selected**).

### Selected design: Obsidian Observatory

- **Design movement:** Scientific-instrument interfaces and editorial systems, interpreted as a contemporary observatory rather than a generic cyber dashboard.
- **Core principles:** Evidence before decoration; one clear primary action per context; high legibility in dark environments; explicit system state instead of theatrical simulation.
- **Color philosophy:** Ink-black and graphite establish quiet depth; mineral cyan is reserved for verified active state; parchment white supports long-form reading; warm coral signals attention without turning error states into decoration.
- **Layout paradigm:** An asymmetric `signal rail → workbench → context shelf` composition. The main workspace gets visual priority; navigation stays compact and expandable; supporting state appears as readable, non-blocking context.
- **Signature elements:** Faceted mineral gradients for identity surfaces; thin signal rules that join related content; small evidence chips that distinguish live, local, blocked, and historical states.
- **Interaction philosophy:** Transitions clarify hierarchy and persistence. Theme changes apply synchronously and retain compatibility with existing preferences; controls keep keyboard focus and readable labels.
- **Animation:** Brief, reduced-motion-safe fades and facet shifts only on state transitions. No looping animation or delayed first paint.
- **Typography system:** A display face is used for a restrained wordmark/headline hierarchy and a mono face for technical metadata. Font assets must be self-hosted with license/provenance records; system fallbacks remain first-class.
- **Brand essence:** *Tessera is an evidence-first sovereign workspace for human-guided systems work.* Personality: precise, composed, luminous.
- **Brand voice:** Clear, grounded, non-anthropomorphic. Examples: “Evidence before execution.” and “This route is ready for review, not yet complete.”
- **Wordmark and logo:** A compact four-facet tessera mark paired with a restrained title treatment; it remains decorative and never represents an identity or authorization token.
- **Signature brand color:** **Mineral cyan** (`#4DD7D0`) used sparingly for verified, active state.

## Implementation approach

1. **Stabilize the current baseline.** Replace stale hard-coded real-lockfile expectations in `scripts/rea-registry.test.mjs` with expectations derived from the deliberate current workspace contract, while leaving fixed-version fixture tests fixed. Make the browser-test prerequisite explicit rather than treating a missing browser as a pass.
2. **Establish production theme contracts.** Add deterministic tests around `resolveAccent`, legacy accent migration, DOM token application, persisted preferences, first-paint token parity, and local font/no-external-font behavior.
3. **Build the Next theme on the current production surface.** Update the current `artifacts/tessera` entry point, token module, stylesheet, sidebar surfaces, and key gate in small, reviewable changes. Add local licensed typography only when the asset provenance and license text are committed with the files.
4. **Keep routing real.** Add and maintain `artifacts/tessera/public/manus-routes.json`, derived from the actual Wouter route/redirect source rather than an invented subset. Preserve every current production route and redirect.
5. **Verify the rendered app.** Run typecheck/build and focused tests. Start the production app only after the route manifest exists, capture desktop and mobile smoke views, and fix demonstrated regressions. Do not treat a screenshot as proof of untested route or API behavior.
6. **Record only proven completion.** Update Gitbook's authoritative coordination ledger after the exact TESSERA commit/PR, checks, and merge result are known. Items that remain blocked or require deletion/provenance decisions stay open.

## Project structure

| Area | Responsibility |
|---|---|
| `artifacts/tessera/` | Canonical React/Vite production UI and route behavior. |
| `artifacts/tessera/src/lib/theme-constants.ts` | Authoritative production accent/token compatibility API. |
| `artifacts/tessera/src/styles/` | Layered production theme CSS; no cross-package symlinks. |
| `artifacts/tessera/src/components/` | Current UI controls and accessible layout surfaces. |
| `artifacts/tessera/public/manus-routes.json` | Static manifest of actual production page routes. |
| `scripts/rea-registry.*` | Workspace registry and dependency-provenance verification. |
| `preview/`, `artifacts/console/`, `artifacts/mockup-sandbox/` | Separate surfaces retained until separately proven replaceable. |
| `archives/`, `archive/` | Provenance only; excluded from runtime replacement/deletion work. |
| `Gitbook` (separate repository) | Canonical task ledger, check-ins, evidence, and final disposition. |

## Constraints and decisions

- PR #361's broad deletion/symlink approach is rejected for this workstream.
- PR #367 is evidence of a bounded first-paint idea, not a merge source. Its useful behavior must be reviewed and recreated against current files.
- “Legacy” means behavior is proven replaced and preserved in a documented restoration/provenance location; it does not mean “not in the root build.”
- A “Pen” capability, if later requested as a product feature, requires a separate data source, authorization model, UI contract, and tests. A local visual label or generated text is not proof that Tessera performed external work or owns other repositories.
