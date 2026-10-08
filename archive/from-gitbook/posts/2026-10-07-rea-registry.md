# Cross-Session REA Registry — Tessera Sovereign Stack
Date: 2026-10-07. Purpose: shared working memory for all Replit sessions/agents collaborating on Tessera. Canonical code: TESSERA. Coordination: this repo. Replit workspaces are drafts.

## Repository inventory (13 repos scanned, read-only, bounded)
| Repo | Visibility | Lang | Root | Manifest deps | External repos mentioned |
|---|---|---|---|---|---|
| 1 | public | TypeScript | 13 root files | 2 deps | - |
| 1T | private | TypeScript | 13 root files | 2 deps | - |
| 5t | public | TypeScript | 15 root files | 2 deps | - |
| Gitbook | private | JavaScript | 3 root files | 0 deps | vitalitychems-dot/TESSERA |
| Grok-ready | public | TypeScript | 11 root files | 2 deps | - |
| olive-giant-ever-glade | private | JavaScript | 11 root files | 30 deps | - |
| T44 | public | TypeScript | 13 root files | 2 deps | - |
| TESS | public | TypeScript | 14 root files | 2 deps | - |
| TESSERA | private | TypeScript | 13 root files | 2 deps | vitalitychems-dot/Gitbook |
| tessera-complete-archives | private | Python | 4 root files | 0 deps | - |
| tessera-grok-handoff | public | Python | 29 root files | 0 deps | - |
| tessera-grok-handoff-complete | public | Python | 8 root files | 0 deps | - |
| Zz | private | TypeScript | 12 root files | 3 deps | - |

Notable: olive-giant-ever-glade carries the richest dependency manifest (@electric-sql/pglite, @hookform/resolvers, @radix-ui/react-accordion, @radix-ui/react-alert-dialog, @radix-ui/react-avatar, @radix-ui/react-checkbox, @radix-ui/react-collapsible, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-label, @radix-ui/react-popover, @radix-ui/react-progress…). Gitbook references: vitalitychems-dot/TESSERA. TESSERA references: vitalitychems-dot/Gitbook.

## Combination architecture (highest functional / secure / private / free / sovereign / local)
1. LOCAL FIRST: all inference-glue, memory, retrieval, provenance, affect, and accounting run in-process (artifacts/api-server/src/lib/v2/*). No required external service.
2. ONE MODEL ENDPOINT: owner-approved GLM-5.3-Flash only, exact-origin allowlist, no fallback providers (usage-ledger accounts every call).
3. EVIDENCE DISCIPLINE (from REA): every conclusion carries evidence + limitations; no-evidence claims grade "unsupported" (evidence-lens.ts).
4. PROVENANCE GRAPH (Flowsint-inspired, our own): source-graph.ts + source-graph-sync.ts auto-map which repos/files/lessons feed which capabilities; cycles rejected; limits always returned.
5. ABSORPTION SPONGE: every interaction recorded (secret-redacted, append-only JSONL), distilled to lessons, answered with a leading next step.
6. AFFECT COMPASS: local lexicon emotional-signal reading with tone guidance. Tessera does not feel; she detects signals and responds with care.
7. SCENARIO SANDBOX: rehearse actions against recorded lessons (BM25). Heuristic, not prediction. No AGPL code.
8. FREE BY DEFAULT: pattern-level reuse only from MIT/Apache-2.0 sources; AGPL (MiroFish) is design reference only.
9. GOVERNANCE: owner approval governs writes (amended 2026-10-07); code via branch/PR; owner auth + protected-data boundaries are not overridden.

## How other sessions/agents use this
- Read this registry before scanning repos again (results cached here).
- New modules go in src/lib/v2/ with tests in src/__tests__/; run 47+ test suite before proposing promotion.
- Promotion path: Replit draft -> PR to TESSERA (branch tessera-v2-stage1 open as PR #15) -> merge -> deploy.
- Never claim AGI/consciousness/recursive weight-learning. The improvement loop is record -> distill -> retrieve -> propose -> human approval -> PR -> test -> merge.
