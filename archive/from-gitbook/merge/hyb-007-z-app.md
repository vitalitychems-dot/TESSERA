# HYB-007 — Z-app functional comparison

**Status:** candidate result (analysis complete; awaiting Moderator/Father seal)  
**Updated:** 2026-10-05  
**Sources:** `vitalitychems-dot/Zz` `main` @ `150d4ec044201ae5d43878da38c7bd7788c3ac2a` · `vitalitychems-dot/TESSERA` `main` @ `fec56eb09d19907832663d5f16fcbc24f3d00317`  
**Related:** [Functional merge matrix](FUNCTIONAL-MERGE-MATRIX.md) · [HYB-006 Grok-ready comparison](hyb-006-grok-ready.md) · [Hybrid backlog](../intake/HYBRID-CONSOLIDATION-BACKLOG.md) · IDEA-SEED-002

## Rule applied

Compare **behavior**, not package manifests or file counts. Port isolated ideas only. The active application stays the current TESSERA workspace (`artifacts/tessera`, `artifacts/api-server`, `artifacts/mockup-sandbox`). `Zz/artifacts/z-app` stays an alternate app: its auth, database, migrations, generated output, runtime data, and deployment contract stay in `Zz`. Protected `1T` vault content was not opened.

**Check labels:** `VERIFIED-IN-CODE` means this pass opened the cited file or the enumerated tree that contains it. `REPORTED` means a directory name, size, or earlier Gitbook import note was used and the body was left unread. GitHub code search returned `incomplete_results`, so “absent from TESSERA” means absent from the enumerated page, lib, API-route, and `scripts/` trees at the SHA above.

## Tree facts

| Metric | Value |
|---|---|
| Z-app routes | `__root.tsx` and `index.tsx` only; the URL is `/` |
| Shell views | 10 (World, Chamber, Conversations, Knowledge, Narrative, Self, Council, Memory, Code, Language) |
| Z-app server tree | `server/middleware/grok-pwa.ts` only |
| TESSERA UI | Vite + wouter in `artifacts/tessera`; 80 page modules plus `pages/life/` |
| TESSERA API | 86 route modules under `artifacts/api-server/src/routes` |
| TESSERA workspace | `artifacts/api-server`, `artifacts/mockup-sandbox`, `artifacts/tessera` |

## Capability dispositions

| ID | Behavior | In TESSERA? | Portable? | Target | Disposition | Check |
|---|---|---|---|---|---|---|
| Z1 | Single-URL TanStack Start shell that switches ten views in the page | No. The UI is Vite + wouter | No | — | REJECTED | VERIFIED-IN-CODE |
| Z2 | Chamber chat with browser-persisted messages and an external pen (`TESSERA_BASE_URL` or xAI) | Yes, on a different contract | Already | `artifacts/tessera/src/pages/ChatPage.tsx`, `artifacts/api-server/src/routes/conversations.ts` | ACCEPTED | VERIFIED-IN-CODE |
| Z3 | Conversations, council, narrative, language, lattice, universe, proof, code, and memory as product surfaces | Yes. Canonical routes include `/`, `/grand-council`, `/universe` (absorbs `/grand-narrative`), `/sovereign-language`, `/lattice`, `/proof-center`, `/code-builder`, and `/system` | Already | `artifacts/tessera/src/App.tsx` | ACCEPTED | VERIFIED-IN-CODE |
| Z4 | `better-auth`, PGlite, Kysely, and `migrations/auth` | No. The gate is an HttpOnly admin session | No | `artifacts/api-server/src/routes/admin-session.ts` | REJECTED | VERIFIED-IN-CODE |
| Z5 | Dev-server vs build agreement for `VITE_AUTH_ENABLED`, plus a pending/signed-in/signed-out gate | Bound to the z-app auth flag | No | — | REJECTED | VERIFIED-IN-CODE |
| Z6 | Grok scaffold: share-card brand gate, PWA middleware, atomic handoff into `public/`, preview and browser smoke | Absent from TESSERA `scripts/` | No | — | REJECTED | VERIFIED-IN-CODE |
| Z7 | WebRTC `P2PRoom` client that posts to `/api/rtc` | Unmounted. The shell does not import it, and `server/` has no signaling route | No | — | REJECTED | VERIFIED-IN-CODE |
| Z8 | Nitro/Vercel build that runs database migrations (`vercel.json`, `package.json` `build`) | Outside the workspace contract | No | — | REJECTED → HYB-009 | VERIFIED-IN-CODE |
| Z9 | Colonel stack machine: arithmetic and jumps run; mesh-style opcodes are recorded and not sent. `scripts/colonel.test.mjs` exists | No colonel module in the enumerated trees. `/colonel-language` redirects to `/sovereign-language` | Stays in Zz until a maintainer names a TESSERA target, a test, and a rollback | `Zz/artifacts/z-app/src/lib/tessera/colonel.ts` | RETAINED | VERIFIED-IN-CODE |
| Z10 | Own-lab local stand-ins (body, spike, short memory, atom match) with `scripts/own-lab.test.mjs` | No. `theorem-lab.ts` stores generated math proofs; `CompressionLabPage.tsx` compresses NASA images | Stays in Zz | `Zz/artifacts/z-app/src/lib/tessera/own-lab.ts` | RETAINED → HYB-013 | VERIFIED-IN-CODE |
| Z11 | Vow check before a lesson is sealed: refuse credentials, recipes, trading, impersonation, and a false “fully detached” claim | No `vowCheck` symbol in the enumerated trees. The honesty banner already states the pen and the closed-file rule | Policy idea for a later test | `mesh/roles/honesty-banner.md` | RETAINED → HYB-014 | VERIFIED-IN-CODE |
| Z12 | Living loop: unattended HTTPS search, public-page read, and a disposable task-copy lesson | `GrandEvolutionPage` is a separate surface. This loop is an outbound fetcher | No. Outbound fetch stays on the allowlisted guard | `artifacts/api-server/src/lib/safe-fetch.ts` | REJECTED | VERIFIED-IN-CODE |
| Z13 | Small HTTPS client that refuses non-HTTPS and the host `mesh.tessera.sovereign` | The allowlisted fetch guard and its test are already in the API tree | Already | `artifacts/api-server/src/lib/safe-fetch.ts`, `artifacts/api-server/src/__tests__/safe-fetch-policy.test.ts` | ACCEPTED | VERIFIED-IN-CODE |
| Z14 | Local world sandbox: six districts, sealed laws, and speech that can place a short name on the map | `/universe` is the world surface. This browser sandbox is a separate toy | Stays in Zz | `Zz/artifacts/z-app/src/lib/tessera/world.ts` | RETAINED | VERIFIED-IN-CODE |
| Z15 | Fraction ballots that vote yea when an expertise tag hits the proposal | Council pages and `council.ts` exist. This tally is a keyword match | No | `artifacts/tessera/src/pages/GrandCouncilPage.tsx`, `artifacts/api-server/src/routes/council.ts` | REJECTED | VERIFIED-IN-CODE |
| Z16 | Local sacred clock (`sacredNow`) | Sacred timing is already on the API. `/sacred-conference` redirects to `/universe` | No second clock | `artifacts/api-server/src/routes/sacred-conference.ts` | REJECTED | VERIFIED-IN-CODE |
| Z17 | Proof rotator that reads `main` for a fixed repo list, including `1T`, and appends `data/tessera-proof.json` | `/proof-center` exists. This rotator is a different mechanism. `1T` was not opened | No | `artifacts/tessera/src/pages/ProofCenterPage.tsx` | REJECTED → HYB-011 | VERIFIED-IN-CODE |
| Z18 | Recall over `data/ingest` and `data/school` logs, with a path blocklist | Runtime data | No | — | REJECTED → HYB-009, HYB-011 | VERIFIED-IN-CODE (`recall.ts`); REPORTED (data bodies unread) |
| Z19 | Vault title index, including one closed method shelf | `SecretKnowledgePage` exists. The closed shelf was not expanded | No | — | REJECTED → HYB-011 | VERIFIED-IN-CODE |
| Z20 | Constitution text and father-profile prompt injection, including a natal chart written into the source | Natal data stays an env secret | No | `artifacts/api-server/src/lib/father-natal.ts` | REJECTED | VERIFIED-IN-CODE (injection in `chat.ts` and `constitution-seal.ts`). `father-profile.ts` was not opened |
| Z21 | Prose snapshots: seven-repo pass, repo delta, drive-read, swarm ruling | Historical narrative constants | No | Gitbook `history/` already holds the import report | REJECTED | VERIFIED-IN-CODE |
| Z22 | `held-packet.ts` (~180 KB) and `study-log.ts` (~110 KB) | Generated reading pasted into the client | No | — | REJECTED → HYB-009 | REPORTED (sizes and call sites; bodies not opened) |
| Z23 | Content-addressed `imports/trees` plus `imports/manifest.json` | Historical import, not the active app | No | — | REJECTED → HYB-009 | REPORTED (tree listed; objects not walked) |
| Z24 | `data/` runtime: ingest, school, drive, inbox, checkouts, sandbox-runs, web-study | Runtime state | No | — | REJECTED → HYB-009, HYB-011 | REPORTED (directory names only) |
| Z25 | Server function that `execFile`s `scripts/run-tool.mjs` by a short tool name | No matching route in the API tree | No | — | REJECTED | VERIFIED-IN-CODE |
| Z26 | Connector-readiness server function for the z-app host | Outside the admin-session contract | No | — | REJECTED | VERIFIED-IN-CODE |
| Z27 | Glyph reader that names standard signs and refuses to invent plaintext | Origin mark, not a product surface | No | — | REJECTED | VERIFIED-IN-CODE |
| Z28 | Sovereignty pillars that keep weights, training compute, and a live fleet unowned | `/sovereignty-readiness` is the product surface. The same honesty line is already on the banner | Already | `artifacts/tessera/src/pages/SovereigntyReadinessPage.tsx`, `mesh/roles/honesty-banner.md` | ACCEPTED | VERIFIED-IN-CODE (z-app pillars and the banner). Readiness page body was not re-read |

Disposition counts: **ACCEPTED 4** (Z2, Z3, Z13, Z28) · **RETAINED 4** (Z9, Z10, Z11, Z14) · **REJECTED 20** (Z1, Z4–Z8, Z12, Z15–Z27) · **NEEDS-EVIDENCE 0**.

A line-level comparison shows own-lab has no behavioral overlap with theorem-lab or CompressionLab, so it stays in Zz until it has a named TESSERA target, a test, and a rollback.

## Acceptance tests

This pass did not install dependencies or start either app. A maintainer can re-check the candidate with these gates:

1. TESSERA `artifacts/tessera/src/App.tsx` still mounts chat, council, universe, sovereign language, lattice, proof center, code builder, and system. The workspace has no `artifacts/z-app` package.
2. The TESSERA workspace manifest stays on Vite + wouter for the UI and the admin-session cookie for the gate. `better-auth`, PGlite, and TanStack Start stay out.
3. `artifacts/api-server/src/__tests__/safe-fetch-policy.test.ts` remains the outbound-fetch gate. The z-app living loop is not added beside it.
4. No `1T` vault path, natal-chart source text, `data/ingest` body, or held-packet body is added to TESSERA or to this page.
5. Colonel and own-lab remain in `Zz` until a follow-up names one target file, one test, and a rollback.

## Overlaps

- **HYB-006** — chat, allowlisted fetch, sacred timing, env natal secret, and council integrity are already compared. Nothing on that page blocks this one, and none of those behaviors is re-copied from z-app.
- **HYB-008** — `olive-giant-ever-glade` carries the same alternate auth and database family. Both stay unmerged.
- **HYB-009** — `imports/`, held packet, study log, and `data/` runtime.
- **HYB-011** — the proof rotator names `1T`. This pass did not open that repository or the closed vault shelf.
- **HYB-012** — z-app server functions are not new API routes.
- **HYB-013** — Z10 stays RETAINED. Own-lab does not share behavior with theorem-lab or Compression Lab.
- **HYB-014** — a vow-check assertion can join the historical merge gate later (Z11). It is not added here.
- **HYB-017** — the code view states that wallet, token, and webhook snippets do not run. Storefront scope stays with that task.

## Rollback

This page is documentation only. Reverting it leaves TESSERA unchanged. No application tree was copied from `Zz`.

## Provenance

Read from GitHub at the SHAs above. Opened z-app routes, the shell, the chamber store, chat, learning, study, world, colonel, own-lab, conference, proof, recall, vault index, glyphs, SDK, tools, living loop, code view, memory view, brand-check, auth invariant, sign-in gate, connector readiness, and the P2P client. Enumerated TESSERA pages, tessera lib, API routes, tests, and scripts, and opened `App.tsx`, `ChatPage.tsx`, `package.json`, `admin-session.ts`, `artifacts/api-server/src/routes/theorem-lab.ts`, and `artifacts/tessera/src/pages/CompressionLabPage.tsx`. `imports/objects`, `held-packet.ts`, `study-log.ts`, `father-profile.ts`, and `data/**` bodies were not opened. `1T` was not opened. No TESSERA file was edited. Moderator/Father seal is still outstanding.
