# AGI-01 — Canonical machine-readable shared world model

**Assessment only; no implementation, repository change, or completion claim.**

## Snapshot and current state

| Repository | Observed base | State | Evidence |
|---|---|---|---|
| Gitbook (coordination/docs) | `fd3c2ce04fa4230c32cf917f36c662f268a1ea76` | Clean worktree at inspection. It contains the authoritative HYB task board, coordination lock, policy, research roadmap, and Markdown sources, but no canonical current-state map/schema. Its existing JSON/CSV/JSONL files are audit/OCR/source inventories, not a live architecture/goals/tasks/unknowns registry. | `brain-consciousness/AGI-COLLABORATION-IMPROVEMENT-ROADMAP.md:10-31`; `intake/HYBRID-CONSOLIDATION-BACKLOG.md:1-47`; `history/coordination/agent-checkins.md:1-47`; `SUMMARY.md:5-90` |
| TESSERA (executable code) | `fec56eb09d19907832663d5f16fcbc24f3d00317` | Clean worktree at inspection. Active pnpm monorepo: React/Vite web (`artifacts/tessera`), Express/WebSocket API (`artifacts/api-server`), UI preview, shared `lib/` packages, and root scripts. CI runs frozen install, audit, typecheck, disposable-Postgres tests, and build. | `README.md:1-50`; `docs/PROJECT_MAP.md:1-12`; `package.json:1-19`; `.github/workflows/ci.yml:1-56`; `artifacts/tessera/src/App.tsx:1-86,180-257`; `artifacts/api-server/src/routes/index.ts:1-189` |

**What exists already**

- Roadmap item 1 specifies the desired shared world model and its acceptance signal: agents answer the same repository/state questions from latest pinned commits. It is still **proposed**, not an implemented registry (`Gitbook/brain-consciousness/AGI-COLLABORATION-IMPROVEMENT-ROADMAP.md:3-12,47-65`).
- The authoritative actionable backlog is one Markdown table, with HYB-005 and HYB-008–017 `READY`, HYB-018–019 `BLOCKED`, and prior foundation items recorded as done (`Gitbook/intake/HYBRID-CONSOLIDATION-BACKLOG.md:26-48`). The coordination lock shows one actual current claim: HYB-012, **BLOCKED** (`Gitbook/history/coordination/agent-checkins.md:5-42`). Brain/consciousness tasks BC-001–010 are all **PROPOSED**, unassigned, and not approvals (`Gitbook/brain-consciousness/AGENT-WORKPLAN.md:7-22`).
- Repository authority is already clear: **Gitbook** holds instructions, tasks, evidence, decisions, and review; **TESSERA** holds code, tests, configuration, adapters, and executable changes. Human approval is required; Gitbook does not replace the product repository (`Gitbook/mesh/TESSERA-GITBOOK-OPERATING-MODE.md:9-24,72-79`).
- TESSERA has an `AGI` API/UI surface (working-memory, bus, causal-model, planner, and metacognition interfaces), but static source presence is not evidence of general intelligence, autonomous operation, or consciousness (`TESSERA/artifacts/api-server/src/routes/agi.ts:1-113`; `TESSERA/artifacts/tessera/src/pages/AGICorePage.tsx:19-168`). The research charter expressly treats consciousness as an open question and says this lane has nothing `TESTED` (`Gitbook/brain-consciousness/TESSERA-PEN-RESEARCH-CHARTER.md:1-27`).

## Target

Create one **Gitbook-owned, versioned JSON snapshot** for repository coordination—not a runtime “causal world model,” API state store, or a claim about AGI/consciousness. It should pin the exact Gitbook and TESSERA commits inspected and make every material assertion traceable to a relative evidence path and status.

The instance must cover these top-level domains:

1. `source_snapshot` — capture time, complete Gitbook/TESSERA commit IDs, branch/ref labels, and refresh triggers.
2. `architecture` — repository boundary; monorepo components; UI/API/shared-library/script/CI relationships; code evidence locator; and `implementation_status` separate from capability proof.
3. `goals` — two-repository consolidation goals plus AGI-roadmap goals, each classified as `capability`, `goal`, `hypothesis`, or `unknown` and marked with an evidence state.
4. `constraints` — one owner/task/scope; approval gates; no credentials/private data; no `1T` inspection; no automatic publication/merge/deletion; no unverified consciousness/biological-equivalence claims.
5. `tasks` — distinguish the active claim (HYB-012, blocked) from backlog-ready items and unassigned BC research proposals; preserve task ID, owner/lane, status, dependency/blocker, acceptance test, and evidence.
6. `unknowns` — explicitly list unresolved branch/PR/archive coverage, `braces` advisory disposition, protected-vault boundary, live multi-agent evidence gap, API duplicate-route audit, runtime/deployment state, and untested AGI/consciousness claims.
7. `evidence` — deduplicated `repo`, pinned `commit`, relative `path`, optional line range, observation, and evidence-status records referenced by the other domains.

Use a controlled vocabulary compatible with current docs: `TESTED`, `REPORTED`, `PROPOSED`, `BLOCKED`, `RETAINED`, `REJECTED`, and `UNKNOWN`. Code-present interfaces must be recorded as `implementation_status: source_present` plus a separate claim/evidence state; do **not** upgrade them to tested or verified capabilities merely because a route/page exists.

## Smallest safe implementation

The map belongs in **Gitbook only**. TESSERA is an evidence source and remains the executable-code repository; duplicating state into an API/database would introduce stale runtime claims, new credentials/data boundaries, and an improper cross-repository control plane.

| Repository | Exact path | Change | Reason |
|---|---|---|---|
| Gitbook | `state/world-model.schema.json` | Add JSON Schema for the snapshot: required domains above, closed status/claim vocabularies, full SHA-1 commit format, relative evidence paths, unique IDs, and prohibitions on anonymous/unpinned evidence. | Makes the contract machine-readable and prevents a task list or capability claim from silently losing provenance. |
| Gitbook | `state/world-model.json` | Add the initial pinned snapshot, using only reviewed public documentation/code locators and the two full bases above. | Single canonical machine-readable answer to architecture/goals/constraints/tasks/unknowns. |
| Gitbook | `state/validate_world_model.py` | Add a small Python-stdlib validator. It parses the two JSON files, enforces required fields/status relationships/unique IDs, and, in verification mode, uses `git cat-file -e <commit>:<path>` against supplied Gitbook and TESSERA checkouts for every evidence locator. | No package manager, credentials, API, or TESSERA runtime integration is required; validation is reproducible and detects stale/bad locators. |
| Gitbook | `state/README.md` | Add update ownership, snapshot semantics, source/ref refresh process, controlled-vocabulary definitions, and the validator commands. State that it is a snapshot, not proof of runtime/deployment/model behavior. | Keeps a compact contract without copying source prose into JSON. |
| Gitbook | `SUMMARY.md` | Add one link under “Start here” (or an explicit “Shared world model” subsection) to `state/README.md`. | Makes the canonical map discoverable from the current Gitbook navigation. |
| TESSERA | *No changes* | None for this work item. | Its code/docs remain authoritative evidence; AGI-01 is coordination documentation, not an executable feature. |

Do **not** edit the roadmap to say AGI-01 is done in the same change. The snapshot and validation evidence must first pass the normal claim, Moderator, Build, digest, and human-approval gates.

## Dependencies and sequencing

1. A Tessera/Pen assignment and a Gitbook check-in must reserve the five Gitbook paths before editing; no task ID is currently assigned for AGI-01.
2. Use the authoritative HYB board/check-in ledger and current full commit IDs as snapshot sources. Preserve HYB-012's active blocked claim; do not relabel it based on static inspection.
3. Gitbook reviewer/Moderator must approve the status vocabulary and privacy exclusions before publication. The owner must approve any publishing/merge action; no unattended sync is implied.
4. The validator requires only Python 3 plus local Git checkouts at the pinned refs. It must never inspect/copy `1T`, raw archives, `.env.local`, runtime databases, protected vault material, or credentials.
5. A later repository-orientation/CI work item may automate freshness reporting, but it is not needed for the initial safe snapshot and must not be assumed to exist.

## Acceptance tests for a future implementation

1. **Schema and semantic validation:**
   ```bash
   python3 state/validate_world_model.py \
     --schema state/world-model.schema.json \
     --map state/world-model.json
   ```
   Must exit zero; a copied fixture missing `unknowns`, using an invalid status, duplicating an ID, or using an absolute evidence path must exit nonzero.
2. **Pinned evidence resolution:**
   ```bash
   python3 state/validate_world_model.py \
     --schema state/world-model.schema.json \
     --map state/world-model.json --verify-evidence \
     --gitbook-root ../Gitbook --tessera-root ../TESSERA
   ```
   Every `repo/commit/path` locator must exist at its declared Git object. This verifies evidence provenance without running TESSERA or reading protected data.
3. **Repository-state questions:** an independent reviewer, using only `world-model.json` and the declared refs, must correctly answer: which repository owns code; active apps/entry points; only active claimed task and its blocker; ready vs. proposed work; approval limits; protected-data boundary; and that AGI/consciousness remain unverified research goals. Reviewer records discrepancies as `UNKNOWN`/`BLOCKED`, not inferred facts.
4. **Documentation hygiene:** `git diff --check`; `python3 -m json.tool state/world-model.json >/dev/null`; `python3 -m json.tool state/world-model.schema.json >/dev/null`; and a relative-link check for the new `SUMMARY.md` link all pass.
5. **Scope guard:** diff contains only the five Gitbook paths above, no TESSERA edits, no secret-shaped values, no live endpoint/model assertions, and no access to `1T` or runtime databases.

TESSERA `pnpm` checks are **not** an acceptance prerequisite for this documentation-only change. Existing code checks remain relevant only if an independent TESSERA implementation change is later proposed.

## Risks and blockers

| Risk/blocker | Impact | Mitigation |
|---|---|---|
| Source drift across Markdown, code, and check-in records | Snapshot becomes stale or contradicts the board. | Pin both commits; evidence-locator verification; require refresh on board, route/app, policy, or source-boundary changes. |
| Confusing TESSERA’s in-code “causal world model” with AGI-01’s coordination map | Overstated functionality or a new runtime control plane. | Namespace and README must call this a repository-coordination snapshot; retain separate implementation/evidence/claim fields. |
| AGI/consciousness language in routes/pages | Interface labels may be misreported as verified AGI/consciousness. | Research-safe controlled vocabulary; mark these source-present/unverified and cite the charter’s limitations. |
| Existing task truth is split between board and check-in ledger | A `READY` row could be mistaken for actively owned work. | Model `active_claims`, `backlog`, and `research_queue` separately; name HYB-012’s blocked active claim. |
| No Gitbook CI/validator toolchain is currently present | JSON can regress silently. | Add a stdlib validator initially; defer CI integration to the separate continuous-orientation work item. |
| Protected/private/archive sources and credentials | Privacy breach from overly broad inventory. | Allowlisted evidence only; no absolute local paths, values, runtime stores, `1T`, or raw archive enumeration. |
| Approval/assignment absent | The proposed paths cannot safely be claimed or published. | Treat AGI-01 as unassigned/proposed until a check-in, review, Build verification, digest, and explicit human decision exist. |

## Evidence notes

- TESSERA’s documented checks and CI establish available validation mechanisms, but this assessment did **not** run `pnpm typecheck`, tests, audit, build, start an app, call a provider, or verify a deployment.
- The known HYB-012 duplicate-route issue remains a blocked, static-source finding: `GET /quantum/state` and `POST /quantum/gate` are reported in `system-runtime.ts` and `legacy-engines.ts`, while the registry mount order matters (`Gitbook/history/coordination/agent-checkins.md:159-176`; `TESSERA/artifacts/api-server/src/routes/index.ts:96-149`). It is not fixed by AGI-01.
- The `1T` protected vault remains uninspected and excluded (`Gitbook/intake/HYBRID-CONSOLIDATION-BACKLOG.md:78-87`; `TESSERA/docs/migration-review/SOURCE-BRANCH-REVIEW.md:27-29`).
