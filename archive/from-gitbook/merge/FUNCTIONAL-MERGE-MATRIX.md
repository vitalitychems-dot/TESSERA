# Functional merge matrix

This matrix separates **portable behavior** from **unmergeable application contracts**. It is the review sheet for HYB-006 through HYB-013. See also the [HYB-006 Grok-ready functional comparison](hyb-006-grok-ready.md) and the [HYB-007 Z-app functional comparison](hyb-007-z-app.md) (candidate results; awaiting Moderator/Father seal). See also the HYB-012 route inventory on TESSERA `50876d40`: the quantum allow-list is retained (`GET /quantum/state`, `POST /quantum/gate`); 8 non-quantum duplicate routes remain.

| Historical aspect | Source family | Current TESSERA state | Action | Owner/task |
|---|---|---|---|---|
| Canonical workspace, API server, mockup sandbox, Tessera app | `tessera-unified`, `Grok-ready`, `1`, `5t`, `T44`, `TESS` | Present in the active workspace | Keep newest reviewed implementation; remove stale references and lock entries | DONE / HYB-003 |
| Auth gates, server-only connector boundary, sign-in tests | `Grok-ready`, `Zz` | Current TESSERA has reviewed auth and boundary tests | Compare behavior; port only a failing test or demonstrably missing invariant | HYB-006, HYB-012 |
| Alternate `z-app` pages and TanStack Start app shell | `Zz` | Different app/runtime contract | Do not copy wholesale; extract user-valued behavior ideas only | HYB-007 |
| Alternate app auth, PGlite/Postgres migrations, storefront UI | `olive-giant-ever-glade` | Not part of current TESSERA contract | Review as a separate feature source; no direct merge | HYB-008, HYB-017 |
| Old API engine modules/routes | `Zz` imported trees, older snapshots | Many are duplicate, speculative, or coupled to alternate schemas | Compare by behavior and tests; integrate only isolated modules with a current consumer | HYB-012 |
| Agent coordination, handoffs, source maps, migration instructions | all source families | Gitbook has canonical sections | Move readable records once, preserve provenance, deduplicate repeats | DONE / HYB-004, HYB-015 |
| Old themes, storefront/product media, screenshots | `Zz`, `Grok-ready`, snapshots | Not active product requirements | Review provenance/license/relevance; keep only approved unique assets | HYB-010 |
| Archive chunks and runtime data | handoff/archive repos, `Zz`, snapshots | Not active application code | Retain source repository or summarize metadata; do not duplicate raw chunks | HYB-009, HYB-011 |
| Historical goals and speculative canon prose | logs, OCR, agent outputs | Untrusted historical evidence | Convert only actionable engineering/product statements into backlog tasks | HYB-015 |
| Security/dependency and privacy boundaries | all source families | Current TESSERA has validation docs; one unpatched advisory remains | Track advisory, keep exclusion manifest current, never copy secrets/private data | HYB-005, HYB-011, HYB-014 |

## Promotion rule

A candidate may move from this matrix into active TESSERA only when all are present:

1. **Behavior:** a concise user-visible or operator-visible behavior is named.
2. **Owner:** exactly one task and one agent own the change.
3. **Fit:** target module and dependencies are identified.
4. **Safety:** privacy, secrets, licensing, and data boundaries are reviewed.
5. **Tests:** at least one deterministic test or smoke path is defined.
6. **Rollback:** the change can be reverted without restoring an old application tree.

Anything missing remains a Gitbook goal or a retained source item, not active code.
