# AGI-03 — Dependency-aware task DAG

**Status:** Proposed design only; no implementation, repository edit, commit, push, deletion, or capability-completion claim was made.

**Evidence bases:** Gitbook `fd3c2ce04fa4230c32cf917f36c662f268a1ea76`; TESSERA `fec56eb09d19907832663d5f16fcbc24f3d00317`. Both worktrees were clean when inspected. The standalone suite-policy test passed (6/6); API integration tests were not run because no dedicated `TESSERA_TEST_DATABASE_URL` was supplied.

## Current state

- **The requirement exists, but not the durable mechanism.** Roadmap item 3 requires a goal to become a non-overlapping DAG with one owner, one acceptance test, and linked completion evidence ([Gitbook roadmap](../../brain-consciousness/AGI-COLLABORATION-IMPROVEMENT-ROADMAP.md), lines 12–15). It explicitly treats AGI/consciousness as open research goals, not established capabilities (lines 3–6, 67–79).
- **Coordination rules are already sound but manual.** The playbook requires one active owner/path set, a stopped-and-recorded stale claim rather than silent overwrite, and a resumable handoff packet ([`mesh/COLLABORATION-PLAYBOOK.md`](../../mesh/COLLABORATION-PLAYBOOK.md), lines 16–41). The operating model reserves Gitbook for task records and TESSERA for executable source/tests ([`mesh/TESSERA-GITBOOK-OPERATING-MODE.md`](../../mesh/TESSERA-GITBOOK-OPERATING-MODE.md), lines 72–79).
- **TESSERA has an in-memory prototype, not a task coordinator.** [`goal-planner.ts`](https://github.com/vitalitychems-dot/TESSERA/blob/main/artifacts/api-server/src/lib/agi/goal-planner.ts) creates deterministic recipe DAGs, but stores at most 100 only in a module `Map` (lines 34–41), uses timestamp-derived IDs (line 126), and nodes have no owner, path scope, acceptance test, lease, checkpoint, evidence, revision, or durable status (lines 16–31). `evaluatePlan` evaluates every child without gating execution on `dependsOn` (lines 151–171). Process restart loses all plans.
- The existing `/agi/plan` API only accepts a goal and returns that volatile plan; list/get read the in-process map ([`routes/agi.ts`](https://github.com/vitalitychems-dot/TESSERA/blob/main/artifacts/api-server/src/routes/agi.ts), lines 49–80). No other authored source calls the planner. [`working-memory.ts`](https://github.com/vitalitychems-dot/TESSERA/blob/main/artifacts/api-server/src/lib/agi/working-memory.ts), lines 56–70 and 148–172, is also capacity-limited in-memory state, so it cannot be the resumption store.
- [`task-scheduler.ts`](https://github.com/vitalitychems-dot/TESSERA/blob/main/artifacts/api-server/src/lib/task-scheduler.ts), lines 169–293, prevents duplicate runs only inside one process via `running`; it is periodic-job scheduling, not dependency/claim coordination. Existing `swarm_tasks` is a completed-work result record, not a DAG/lease model ([`lib/db/src/schema/swarm.ts`](https://github.com/vitalitychems-dot/TESSERA/blob/main/lib/db/src/schema/swarm.ts)).
- TESSERA already has PostgreSQL/Drizzle (`lib/db/src/index.ts`, lines 1–16), schema exports (`lib/db/src/schema/index.ts`), and SQL migrations. No goal-planner test currently exists; API tests use Vitest (`artifacts/api-server/package.json`, lines 6–13).

## Target and smallest safe implementation

Build a **bounded, deterministic task-plan ledger** in TESSERA; retain Gitbook as the human-facing coordination/evidence record. Do **not** present it as autonomous AGI or as a replacement for assignment, review, or human approval.

1. **Separate planning from execution.** Keep `goal-planner.ts` as a pure graph compiler/evaluator. Add an explicit structured-plan input for v1: root goal plus nodes containing stable client/task IDs, title, `dependsOn`, exact repository-relative `scopePaths`, one `acceptanceTest`, and optional declared owner. Recipe-based goal expansion remains optional; it must output the same validated structure.
2. **Validate before persistence.** Reject blank/duplicate IDs, unknown/self dependencies, cycles, missing acceptance tests, empty/un-normalizable scopes, and an overlapping scope within the submitted active plan. Canonicalize paths; for v1, treat equal paths and ancestor/descendant paths as conflicts. Do not attempt heuristic semantic-overlap or glob matching.
3. **Persist plan/node state in PostgreSQL.** Store a plan header and nodes with `status`, immutable scope/acceptance fields, `ownerId`, lease token/expiry, optimistic `revision`, checkpoint JSON, evidence references, timestamps, and an append-only transition record. On startup/read, reload durable state and derive `ready` only when every dependency is `complete`; completed nodes are never re-opened by evaluation.
4. **Make claim/release/resume transactional.** A claim must atomically: check expected revision, require all predecessors complete, lock the claim decision, compare the candidate paths with all unexpired active claims, then write owner/lease/revision/event. A checkpoint or completion must require the current owner and lease plus expected revision. Expired claims become visibly `stale`; no owner is silently replaced. Resumption renews the same owner’s lease and retains checkpoint/evidence; reassignment is a separately recorded coordinator action after `stale`.
5. **Expose only the minimum API.** Keep the existing plan creation/list/get paths compatible where possible, but add structured create, node claim, checkpoint, complete/block, and resume operations. Each mutation returns the new node revision and conflict reason. No background executor or UI is needed for this item.
6. **Mirror—not replace—coordination evidence.** A Gitbook task/check-in must still cite the plan/node ID, scope, owner, base commit, acceptance test, evidence, limitations, and review gate. This aligns with existing intake and handoff requirements rather than creating a second work board.

### State/transition contract

`planned → ready → claimed → in_progress → complete` is normal. `planned|ready|claimed|in_progress → blocked`; `claimed|in_progress → stale` only after expiry/explicit handoff; `stale → claimed` only through the recorded resume/reassign action. A node is **ready** iff all predecessor nodes are complete. An active `claimed`/`in_progress` lease blocks an overlapping new claim. Plan completion is derived only when all non-root nodes are complete. Every mutation includes `expectedRevision` and an idempotency/request ID so retries cannot create duplicate claims or transition events.

## Exact files expected to change

| Repository | File | Change |
|---|---|---|
| TESSERA | `artifacts/api-server/src/lib/agi/goal-planner.ts` | Make graph validation/topological readiness pure and deterministic; add owner/scope/test-aware node types; stop treating blocked dependencies as runnable. |
| TESSERA | `artifacts/api-server/src/lib/agi/task-plan-store.ts` **(new)** | Drizzle-backed transactional plan/node/claim/checkpoint/event repository; path-conflict and lease/revision enforcement. |
| TESSERA | `artifacts/api-server/src/routes/agi.ts` | Use the durable store and add guarded structured-plan, claim, checkpoint, completion/block, and resume handlers; retain read-only compatibility routes. |
| TESSERA | `artifacts/api-server/src/__tests__/goal-planner.test.ts` **(new)** | Pure DAG validation/readiness/root-rollup and scope-normalization tests. |
| TESSERA | `artifacts/api-server/src/__tests__/task-plan-store.test.ts` **(new)** | Dedicated-local-Postgres concurrency, lease, checkpoint, restart/reload, and idempotency tests. |
| TESSERA | `lib/db/src/schema/task-plans.ts` **(new)** | `task_plans`, `task_plan_nodes`, and `task_plan_events` Drizzle definitions, unique/index constraints, and typed JSON fields. |
| TESSERA | `lib/db/src/schema/index.ts` | Export the new schema. |
| TESSERA | `lib/db/drizzle/0010_task_plans.sql` **(new)** | Add tables, uniqueness/indexes, and the transaction-supporting constraints. |
| TESSERA | `lib/db/drizzle/meta/_journal.json` and generated Drizzle metadata **if the repository’s migration-generation process produces it** | Register generated migration artifacts; do not hand-edit a snapshot. |
| Gitbook | `history/coordination/agent-checkins.md` **only after Tessera assigns an implementation task** | Add one check-in/handoff that links the plan/node and evidence. No new board should be created; [`intake/consolidated-todo.md`](../../intake/consolidated-todo.md), lines 1–4, already names the authoritative board. |

**Explicit non-changes for the smallest safe slice:** no frontend, scheduler change, agent-spawner change, LLM-based decomposition, automatic task assignment, external actions, generated API clients, or migration of `swarm_tasks`/working memory.

## Dependencies and ordering

1. **Gitbook assignment and scope registration:** Tessera assigns one scoped task; record a claim with SK-04/SK-07 implementation and SK-08/SK-09 review as appropriate. This is required before edits under the existing playbook.
2. **Schema + migration first:** create/export/persist the ledger on a dedicated local PostgreSQL test database. The database package currently has `push` but no checked-in migration-generation script (`lib/db/package.json`, lines 10–13); confirm the migration command/artifact owner before implementation.
3. **Pure planner second:** add validator/topological logic and isolated unit tests before route/store wiring.
4. **Store and route third:** add transactional claim/checkpoint/resume semantics and local database integration tests. No runtime scheduler integration.
5. **Independent verification and Gitbook handoff:** run typecheck/tests from the pinned base; publish paths, migration action, test output, limitations, and review result. The existing approval path remains intact.

## Acceptance tests

| Test | Expected evidence |
|---|---|
| DAG validity | Missing dependency, self-dependency, and multi-node cycle are rejected; a valid graph is deterministically topologically ordered. |
| Dependency gating | A child remains `planned`/not claimable until every predecessor is `complete`; blocking/staling a predecessor never makes its child ready; root completion occurs only after all required nodes complete. |
| Scope safety | Equal and ancestor/descendant repo-relative paths conflict; canonical disjoint paths can be concurrently claimed; completed/released claims no longer block; malformed/escaping paths are rejected. |
| Atomic overlap race | Two simultaneous claims for overlapping paths yield exactly one success; loser receives a conflict with blocking node/plan, and no duplicate active lease exists. |
| Lease and optimistic concurrency | Wrong owner/token or stale `expectedRevision` cannot checkpoint, complete, or overwrite; duplicate request ID safely returns the original transition. |
| Resume/restart | Create/claim/checkpoint, reconstruct a fresh store instance, and read the same state/checkpoint/evidence. Same owner can renew; expired lease becomes visible `stale`; reassignment cannot occur silently. |
| API validation | Invalid request bodies return 400/409 without state mutation; plan/list/get expose persisted statuses and node evidence without disclosing credentials. |
| Regression | `pnpm --filter @workspace/api-server run typecheck`; focused Vitest tests; `pnpm test` with a dedicated loopback `TESSERA_TEST_DATABASE_URL`. Current only-run evidence: `pnpm --filter @workspace/scripts run test` passed 6/6. |

## Risks, boundaries, and blockers

- **Durability and concurrency are essential.** A `Map`, working memory, or process-local `running` flag cannot meet restart/multi-process safety. PostgreSQL transaction isolation/advisory locking and revision checks must be reviewed; otherwise “non-overlap” is race-prone.
- **Path comparison is deliberately conservative.** v1 path/ancestor conflict detection will not detect semantic or glob overlap. Expanding it without a formal scope language risks both false blocks and unsafe concurrent edits.
- **Lease expiry is not authorization to overwrite.** It must surface `stale`, retain evidence, and require recorded resume/reassignment; this follows Gitbook’s one-task lock rule.
- **Migration workflow is unresolved.** The checked-in Drizzle config has no `out` directory and package scripts expose `push`/`push-force` only, while SQL migrations and a journal already exist. Confirm how production migrations are generated/applied and who approves them before changing schema.
- **No dedicated API database is configured for this analysis.** Integration tests must not use `DATABASE_URL`; the unified runner intentionally skips them unless `TESSERA_TEST_DATABASE_URL` is a separate loopback database.
- **Ownership/authority is a governance dependency.** No AGI-03 implementation assignment, owner identity, or approval is evidenced. The planner must not auto-assign tasks or bypass Gitbook Moderator, Build, and human approval gates.
- **Claims boundary.** This improves bounded coordination and recovery if implemented and tested; it does not demonstrate general intelligence, consciousness, autonomous agency, or live multi-agent activity.
