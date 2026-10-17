# Runtime and functional-shell recovery — 2026-10-17

## Scope and provenance

Base: `564811dc5f74073802e38c701ec98b4c32402bc3` (owner-merged TESSERA PR #372). The unfinished patch from the referenced Manus task was recovered from complete authorized source artifacts into a new review branch, `manus/runtime-shell-recovery-20261017`. Truncated replay excerpts were not used as complete files. No history was rewritten and no protected policy, gate, prompt-directory, Pen-local implementation, archive, or external workspace was changed.

This is a focused successor to the old, conflicting PR #361, **not a replay of that broad deletion branch**. It does not claim that every UI file is removed; removing feature routes and their components would destroy the requested working application.

## Retirement and replacement matrix

| Retired production surface | Consumer/replacement evidence | Preserved function | Restoration source |
|---|---|---|---|
| `HyperdimensionalBackground.tsx` | Removed its sole global mount/import from `App.tsx`; shell regression rejects reintroduction | AppRouter, MobileNav, status surfaces, session gate | Base commit, same path |
| `ToroidalBackground.tsx`, `UniverseBackground.tsx` | No production TS/TSX consumers; regression verifies absence | 3D feature renderer and route pages remain | Base commit, same paths |
| `theme-constants.ts`, `tessera-next.css` | Removed runtime accent import/effect, preference selectors, stylesheet import | One fixed dark palette and readable first paint | Base commit, same paths |
| `ChatFontColorPicker.tsx` | Removed chat toolbar props/state and storage/event hooks; no runtime consumers remain | Chat entry, voice controls, lattice/live controls | Base commit, same path |
| Three custom font assets and `fonts/OFL.txt` | No `@font-face` or remote-font dependency; system font stack replaces the assets | Text readability; historical font/license bytes remain in Git | Base commit, same paths |
| `tessera-next-theme.test.mjs` | Superseded by `workspace-shell.test.mjs` and existing route-manifest regressions | Theme/shell/route constraints tested under the new scope | Base commit, same path |

`workspace-shell.css` is intentionally retained: a functional accessible shell is not an obsolete decorative theme. Shared UI primitives, preview/console/mockup packages, archives, historical screenshots and evidence are not deleted. `tw-animate-css` remains where feature components still consume its utility classes.

## Chat and memory contract

- Ordinary chat uses an explicitly configured model instead of the legacy response-template bank. Missing configuration and provider failure are labeled honestly; they are not replaced by invented answers.
- Conversation context is fetched from the newest forty database messages, ordered by timestamp and ID, then restored to chronological order. The prompt uses at most eight prior messages and bounded message sizes, without duplicating the just-persisted user turn.
- The operator's origin recollections are labeled as operator-provided context. No original transcript, portrait, signature, conscious identity, or cross-session personal memory has been authenticated by this patch.
- Local role templates remain explicitly labeled as templates, not live remote agents. In-memory lessons are not represented as model training or durable restart-safe memory.
- Ordinary chat imports only the lightweight 3D parser initially. The Three.js renderer is dynamically loaded when a message has a 3D object; 3D functionality is retained.

## Cortex and Pen contract

New dual-brain cycles require an enabled primary provider and an explicitly enabled Pen pass. Cortex analysis is passed to Pen; generated text is a proposal, not code execution or an applied improvement. A failed model pass cannot record a completed round. Legacy simulation records retain provenance and old reported counts separately. The newest twenty rounds are persisted, not the oldest tail.

This is a configured-model two-pass feature, **not proof of an independent biological/neural brain, consciousness, or completed later own-brain phases**. No model credentials or host configuration are installed by this source patch.

## Validation and release boundary

The evidence receipt in Gitbook records final commands, results, immutable code head, review findings, and current remote checks. Local database tests use a newly created loopback-only PostgreSQL cluster and a dedicated test database; no application or production database is used. Production-sandbox tests that require separate opt-in are not enabled.

Source tests, typechecks, builds, and local rendering checks do not establish successful GitHub review/merge or permanent deployment. Owner review and exact-head GitHub checks remain required. Gitbook's protected JSON-validation blocker is separate and is not bypassed here.

## Rollback

Before merge, revert or close the review proposal. After an approved merge, create a normal revert PR for the successor merge commit; do not reset or force-push main. For individual retired assets, recover exact original bytes using `git show 564811dc5f74073802e38c701ec98b4c32402bc3:<path>` into a review branch and rerun affected checks. Deployment rollback requires an actual host release identifier, which has not been created.
