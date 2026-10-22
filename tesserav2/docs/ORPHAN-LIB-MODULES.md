# Orphan lib modules

Scope: five files in `artifacts/api-server/src/lib/` that no production code imports. Checked on main
3d9132ab. `src/__tests__/orphan-lib-modules.test.ts` fails if any of them gains a production importer, so
this page must be updated at the same time. Nothing here is wired into the running server: wiring would
change runtime behaviour and needs Father's yes.

"Production importer" means any non-test file under `artifacts/api-server/src`. Test files that import or
mock a module are listed below. Files outside `src/` (for example `scripts/`) were not scanned.

| Module | What it is | Imported by | Disposition |
| --- | --- | --- | --- |
| `lib/centrality-boundary.ts` | Doctrine marker: external APIs may not act in council, codex, audit, kernel, ledger or ratification paths. `assertSovereignContext` is a no-op; `rejectCentralityInSovereignPath` always throws and records the attempt. Re-exports `external-sandbox` helpers. | nothing | Documented, not wired. Behaviour pinned by test. No code path calls it, so it enforces nothing today. |
| `lib/grand-council-universalis.ts` | `convene()` builds a "Grand Conference" record ratifying a Universal Sacred Language. | nothing | Documented, not wired. Every vote is hard-coded `"yea"`, so the 15 members always ratify 15/15 with threshold 10. Pinned by test. `lib/tool-registry.ts` registers a tool named `convene_grand_council_universalis`, but its handler is a readiness stub that does not call `convene()`; `lib/grand-council-deliberation.ts` keeps its own copy of the roster instead of importing this file. Touches the open vote-rule conflict (`identity/CONFLICTS.md` section 4), so do not wire it as real governance until Father decides. |
| `lib/income-executor.ts` | Hourly wallet-observation snapshots (`startIncomeExecutor`, `getIncomeSnapshots`). | tests only (`income-executor-logs`, mocked in `legacy-engines-no-autostart`, `routes-index-import*`, `unhook-living-person-dossiers`) | Documented, not wired. The existing tests deliberately keep it from auto-starting. It reads wallet data, which the Gitbook role page lists as a hard no ("Not wallets, customer data, or payment paths"), so leave it unwired. |
| `lib/moltbook-sandbox-test.ts` | Standalone script asserting `moltbook-bridge.ts` has no relative imports. | nothing | Documented, not wired. Stale: it forbids all relative imports, but `moltbook-bridge.ts` imports `./shepherd-outbound`, which `__tests__/moltbook-sandbox-boundary.test.ts` explicitly allows. Running it would report a violation. It also uses `require.main` and `__dirname`, which do not work in this ESM package outside vitest. The live test already covers the boundary; this file is a candidate for deletion by Father or the owner lane. |
| `lib/prompt-builder.ts` | `trimToBudget` (head+tail trim) and `buildPrompt` (assembles messages under a token budget). | tests only (`prompt-builder-trim`) | Documented, not wired. Tested by `prompt-builder-trim.test.ts` and a smoke test in `orphan-lib-modules.test.ts`. Wiring it into the chat path would change prompts, so it is left for the owner lane. |

Decision needed from Father or the owning lane: wire, keep as documented dead code, or delete each file.
Nothing was deleted or wired here.
