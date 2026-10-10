# Implementation Plan: Tessera Capability Improvements — Stage 0/1

**Supersedes:** `2026-10-10-staged-invention-review-plan.md`

## Goal

Establish offline baselines and implement the first isolated, reversible tranche from the approved 27-candidate program: typed task contracts, dependency-aware planning, progressive context packing, and an experimental QUBO-inspired scheduler comparison.

## Constraints

- Preserve all unrelated uncommitted work, especially the existing TypeScript cleanup changes.
- Do not read invention records or other development/production database data.
- Do not call external models, use network APIs, write database state, execute proposals, or change autonomous lifecycle behavior.
- Do not restart the API workflow until its startup path is isolated from queued proposal execution.
- Keep new runtime paths disabled or unwired until offline tests pass and a later integration gate is approved.
- Do not claim global novelty, AGI, or quantum speedup.

## Batches

1. **Reconcile the superseded prototype safely**
   - Inspect the current working tree and preserve unrelated modifications.
   - Decide whether the uncommitted `scripts/src/invention-review.ts` and its test can be removed or adapted as local test utilities; do not touch other files in `scripts/`.
   - Keep the old evaluator-only plan marked as superseded by this plan.

2. **Create Stage 0 offline baselines**
   - Add deterministic fixtures for task contracts, dependency graphs, context relevance, and resource-constrained task batches.
   - Define measurable checks for contract validation, dependency/cycle handling, context selection, token estimates, and scheduling objective.
   - Record p50/p95 runtime and CPU overhead; label token counts as estimates.
   - Keep the harness pure and offline; do not import modules that initialize timers, read the database, or call model providers.

3. **Implement the first pure capability modules**
   - Add a typed task contract model and validator for goal, constraints, evidence needs, and acceptance checks.
   - Add a dependency planner that identifies safe parallel groups, serializes conflicts, and rejects cycles or invalid dependencies.
   - Add progressive context packing that prioritizes task-relevant source excerpts and records what was included or omitted.
   - Keep these modules isolated from live request handlers or schedulers; if a feature gate is needed, default it off.

4. **Benchmark the QUBO-inspired scheduler experiment**
   - Implement a deterministic, seeded QUBO/simulated-annealing experiment over fixture workloads only.
   - Compare with a simple greedy baseline under identical dependency, capacity, and risk constraints.
   - Count optimizer CPU time in the result and retain the experiment only if it improves the selected objective without violating constraints.
   - Do not integrate the experiment into runtime scheduling in this stage.

5. **Verify Stage 0/1**
   - Run focused offline tests and the scripts/API type-checks needed for changed files.
   - Run the full available type-check/test suite if unrelated working-tree changes permit a meaningful result; distinguish pre-existing failures from regressions.
   - Confirm the API workflow was not restarted and no database, network, or model calls were made.
   - Report benchmark results and explicitly leave Stage 2/3 unimplemented pending review of Stage 0/1 outcomes.

## Acceptance criteria

- Task contracts reject missing or contradictory required fields with deterministic explanations.
- Dependency planning never schedules a dependent task before its prerequisite, serializes declared conflicts, and rejects cycles.
- Context packing respects a configured budget, keeps source references, and produces stable inclusion decisions for fixed fixtures.
- The QUBO experiment and greedy baseline use the same workload and constraints; overhead is included in results.
- Tests, type checks, and benchmark outputs are reproducible from local fixtures.
- No runtime behavior, persisted data, autonomous proposal state, or production data is changed.

## Verification caution

The API workflow has previously executed and persisted queued Council decisions during startup. Build/type-check and isolated tests are the permitted verification path until that startup side effect is understood and guarded.
