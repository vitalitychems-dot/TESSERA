# Staged Tessera Capability Improvements: 27-Candidate Program

**Status:** Revised design draft for user review
**Product area:** Tessera task processing, context, retrieval, reasoning, and learning
**Purpose:** Design a staged program of measurable software improvements. The 27 candidates are proposals for Tessera, not claims of worldwide invention or novelty.

## Current state

The API already contains an LLM request batcher with duplicate and semantic merging, BM25/vector hybrid retrieval, a keyword-based adaptive model router, and a recurring task scheduler. The dual-brain cycle uses fixed prompts and response patterns; its counters are not evidence of improved reasoning. The invention lifecycle can synthesize votes, progress, and test outcomes; those values are workflow state, not independent validation.

The requested portfolio has 27 candidates: 10 system-wide, 3 context, 2 speed, 2 recall, 2 reasoning quality (“brain”), 2 system-connection, 3 AGI-oriented, and 3 recursive-learning improvements. New work should extend existing modules where appropriate rather than duplicate them.

## Approved design

### Candidate portfolio

#### 10 system-wide improvements

1. **Task contract compiler:** turn each request into a typed goal, constraints, evidence needs, and pass/fail checks.
2. **Dependency graph planner:** identify prerequisites and parallelizable work; serialize conflicting changes.
3. **Quantum-annealing-inspired QUBO batch planner:** select dependency-compatible work under resource constraints and compare against a greedy baseline.
4. **Measured cost/quality router:** select tools and model tiers using quality, latency, and token budgets; escalate only when checks fail.
5. **Tool contract validation:** validate inputs and outputs before downstream use.
6. **Idempotent action ledger:** prevent retries from repeating successful mutations.
7. **Failure fingerprinting:** detect repeated failure patterns and enforce bounded, useful retries.
8. **Safe checkpoint/resume:** persist task progress at explicit resumable boundaries.
9. **Evidence/provenance ledger:** attach source, evidence state, and confidence basis to claims and decisions.
10. **Risk-tiered action gates:** require stronger review for risky, irreversible, or external actions.

#### 3 context improvements

11. **Task-context graph:** connect relevant files, symbols, decisions, and dependencies.
12. **Progressive context packing:** load an index, then targeted excerpts, then full source only when needed.
13. **Conflict-aware context resolution:** preserve conflicting claims with provenance and freshness instead of silently selecting one.

#### 2 speed improvements

14. **Critical-path context prefetch:** parallelize independent, read-only context gathering.
15. **Deadline-aware execution:** prioritize by deadline and return useful partial results when time is exhausted.

#### 2 recall improvements

16. **Identifier-aware retrieval fusion:** extend the existing hybrid retrieval with exact identifiers and provenance-aware ranking; evaluate recall@k and citation accuracy.
17. **Provenance-preserving memory compaction:** reduce context size while retaining retrievable source pointers; do not assume semantic losslessness.

#### 2 reasoning-quality improvements (“brain”)

18. **Counterexample and test generation:** derive adversarial cases from explicit acceptance criteria.
19. **Calibrated critique and abstention:** surface unsupported assumptions rather than rewarding confident phrasing.

#### 2 system-connection improvements

20. **Capability contract graph:** link routes, tools, types, and callers to detect broken contracts before runtime.
21. **Versioned event envelope:** provide idempotent event consumers and explicit cache invalidation across connected subsystems.

#### 3 AGI-oriented improvements

22. **Bounded goal-to-capability planner:** decompose goals into authorized, testable subtasks.
23. **Explicit task/world state:** track known facts, unknowns, assumptions, and provenance.
24. **Evidence-driven role assignment:** use multiple review roles only when they contribute independent evidence; stop when marginal value falls below a defined threshold.

#### 3 recursive-learning safeguards

25. **Reviewed outcome ledger:** learn only from outcomes confirmed as genuine results, never synthetic votes, statuses, or simulated tests.
26. **Offline policy regression gate:** compare proposed behavior changes on a held-out suite; promote only after passing regression checks.
27. **Gap-to-review-task generator:** create deduplicated, reviewable tasks from coverage gaps; never self-approve or self-apply them.

## Staged architecture

### Stage 0: safe baselines

Build deterministic local fixtures and pure-function tests. Establish baselines for correctness, invariant violations, token estimates, p50/p95 runtime, retrieval recall@k, and tool-contract failures. Do not read development or production invention records, call external models, or write database state in this stage.

### Stage 1: first implementation tranche

Implement the task contract, dependency-aware planner, and progressive context packer behind disabled-by-default gates. Test the QUBO-inspired planner as an isolated experiment against a greedy scheduler. Count its CPU/runtime overhead as part of its cost; retain it only if it improves the chosen scheduling objective without violating dependencies or risk constraints.

### Stage 2: measured subsystem upgrades

Improve retrieval, reasoning validation, contract/event integration, and deadline handling in separate changes. Each change must pass its targeted fixture benchmark and the full regression suite before it is enabled.

### Stage 3: reviewed learning

Add reviewed outcome collection, offline policy comparisons, and gap-derived task drafts. These features may produce reviewable drafts but may not autonomously approve or apply them.

## Measurement and acceptance criteria

- Every candidate has a baseline, a target metric, a fixture set, and a rollback condition before implementation.
- Correctness, safety invariants, dependency ordering, and idempotency are tested deterministically.
- Speed claims include p50/p95 latency and computation overhead.
- Retrieval claims use fixed queries and report recall@k and citation accuracy.
- Token figures are labeled as estimates unless measured through an explicitly approved real-model evaluation.
- No candidate is retained solely because it is “quantum-inspired”; it must outperform the simpler baseline on its measured objective.
- A candidate that does not improve its target metric or causes a safety/regression failure is not integrated.

## Safety and scope boundaries

- “Quantum-inspired” refers to a classical optimization experiment; it is not a claim of quantum hardware, quantum speedup, or globally new science.
- “AGI-oriented” describes engineering direction, not an assertion that the result is AGI, conscious, or generally intelligent.
- Worldwide novelty cannot be guaranteed. The program may describe a method as new to Tessera only after checking the current codebase; prior-art research is a separate activity.
- No live model calls, production data access, database writes, autonomous proposal execution, physical testing, or deployment in the first implementation stage.
- Persistence and external model evaluation require a separate approval before use.
- Do not restart the API workflow until its startup path is isolated from queued proposal execution; a previous restart caused queued Council decisions to be persisted as executed.
- Do not present unsupported health, energy, or scientific claims as verified.

## Out of scope

- Claiming a method has never existed anywhere without rigorous prior-art research.
- Claiming quantum speedup without actual quantum hardware and a valid comparison.
- Automatically enabling self-modification or autonomous learning.
- Replacing all existing retrieval, scheduling, routing, or batching systems before benchmarks show a need.
- Forum loading or navigation consolidation.

## Next phase

After the user approves this revised spec, create a detailed implementation plan for the staged program. Start with Stage 0 and Stage 1 only; further stages remain gated by measured results and the safety boundaries above.
