# HYB-006 — Grok-ready functional comparison

**Status:** candidate result (analysis complete; awaiting Moderator/Father seal)  
**Updated:** 2026-10-05  
**Sources:** `vitalitychems-dot/Grok-ready` `main` @ `9e3fbca` · `vitalitychems-dot/TESSERA` `main` @ `fec56eb`  
**Related:** [Functional merge matrix](FUNCTIONAL-MERGE-MATRIX.md) · [Hybrid backlog](../intake/HYBRID-CONSOLIDATION-BACKLOG.md) · IDEA-SEED-001

## Rule applied

Compare **behavior and tests**, not package manifests or file counts. Prefer the newest reviewed TESSERA implementation. Do not re-import Grok-ready lockfiles, generated output, or protected `1T` vault content.

## Tree facts

| Metric | Value |
|---|---|
| Common blobs | 1275 |
| Content-hash diffs among common | 16 (manifests, lockfile, README, mockup `vite.config.ts`, migration docs) |
| Only in Grok-ready | 18 (mostly `docs/grok-packet/.../isolated-mockup` + migration screenshots) |
| Only in TESSERA | 108 (suite scripts, CI, archives, validation/secrets docs) |

## Capability dispositions

| ID | Behavior | In TESSERA? | Portable? | Target | Disposition |
|---|---|---|---|---|---|
| C1 | Canonical API + Tessera UI + mockup + libs | Yes | Already | `artifacts/*`, `lib/*` | ACCEPTED |
| C2 | `safeFetch` fixed-host allowlist | Yes + tests | Already | `artifacts/api-server/src/lib/safe-fetch.ts` | ACCEPTED |
| C3 | Sovereign fetch guard / secure external wrapper | Yes + tests | Already | `artifacts/api-server/src/lib/sovereign-fetch-guard.ts`, `artifacts/api-server/src/lib/secureExternalWrapper.ts` | ACCEPTED |
| C4 | Admin session cookie gate + origin/rate limits | Yes | Already | `artifacts/api-server/src/routes/admin-session.ts` | ACCEPTED |
| C5 | Father natal chart from env secret | Yes | Already | `artifacts/api-server/src/lib/father-natal.ts` | ACCEPTED |
| C6 | Observation-only outbound / no-mocks / truthfulness docs | Yes (docs) | Policy | Gitbook + `docs/TESSERA_SYSTEM.md` | ACCEPTED |
| C7 | Vote-integrity / genuine council ballots | Yes | Already | council / grand-evolution | ACCEPTED |
| C8 | Sacred-timing scheduler | Yes | Already | API scheduler libs | ACCEPTED |
| C9 | Codex / reality-audit / next-five | Yes + tests | Already | API + Tessera pages | ACCEPTED |
| C10 | Sovereignty readiness / hard-disconnect / local models | Yes | Already | sovereignty routes + UI | ACCEPTED |
| C11 | Unified suite runner + loopback DB policy | Yes (TESSERA-only) | Keep | `scripts/*-unified.mjs` | ACCEPTED |
| C12 | Mockup Vite plugin type boundary | Yes (HYB-003 fix) | Keep | `mockup-sandbox/vite.config.ts` | ACCEPTED |
| C13 | Storefront / `projects/*` app | No `projects/` directory (removed upstream); `pnpm-workspace.yaml` still lists `projects/*` for HYB-017 to clean up | No wholesale | Product brief only | RETAINED → HYB-017 |
| C14 | Grok packet + isolated-mockup sample | Partial handoff docs | Docs yes; sample no | Gitbook provenance | RETAINED / REJECTED (sample) |
| C15 | Separate assistant/simulation service claims | Unverified in packet | Idea only | Future HYB if scoped | NEEDS-EVIDENCE |
| C16 | CI + blank `.env.example` / SECRETS docs | Yes (TESSERA-only) | Keep | `.github/`, docs | ACCEPTED |
| C17 | Dependency security floors | Prefer TESSERA | Keep lock | workspace overrides | ACCEPTED (HYB-005 tracks advisory) |
| C18 | Protected `1T` vault content | Never copied | No | — | REJECTED → HYB-011 |

## Acceptance tests (suite-level)

Without claiming a live run in this analysis session, the deterministic gates for closing related engineering work are:

1. Named API tests exist: `safe-fetch-policy`, `sovereign-fetch-guard`, `tessera-codex`, `reality-audit-snapshot`, `next-five-improvements`, `moltbook-sandbox-boundary`.
2. Suite policy rejects non-loopback Postgres URLs for API auto-start / test DB reuse.
3. No `projects/` package appears in the active tree until HYB-017 decides otherwise.
4. No `1T` vault paths are added to TESSERA.

## Overlaps

- **HYB-012** — route registry / dead modules (do not re-copy Grok-ready routes).
- **HYB-014** — historical merge gate command (suite pieces exist; gate packaging remains).
- **HYB-017** — storefront/ABC product boundary.
- **HYB-005** — `braces` advisory monitoring.
- **HYB-011** — privacy exclusion / vault.

## HYB-007 guidance

HYB-007 (`Zz/artifacts/z-app`) should **wait only until this page is published**, then may start. There is **no** missing Grok-ready code port blocking HYB-007.

## Rollback

This page is documentation only. Reverting it does not change TESSERA. No application tree was restored from Grok-ready.

## Provenance

Full working report: box path `/workspace/hyb-006-report.md` (executor artifact). Page content is published in Gitbook `merge/` and linked from `SUMMARY.md` and the functional merge matrix. It remains a candidate result awaiting Moderator/Father seal.
