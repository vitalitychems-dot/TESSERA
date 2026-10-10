# Staged Evidence-Gated Invention Review

**Status:** Design draft for user review  
**Product area:** Tessera invention review and task processing  
**Purpose:** Prototype a faster, more accurate way to triage source-defined inventions, prioritize meaningful validation, and reduce review effort without treating simulated lifecycle data as evidence.

## Current state

Tessera has source-defined seed inventions, build-guide entries, and invention templates. The API also reads persisted inventions and has an autonomous lifecycle that can generate entries, advance statuses, synthesize vote totals, increment build progress, and mark deterministic checks as passed or failed. Those lifecycle values are not independent evidence that an invention works.

The existing source contains physical, scientific, and software ideas with different validation requirements. Treating them all as buildable software tasks or assigning a single unqualified “novelty” score would be misleading.

## Approved scope and safety boundaries

1. Inventory source-defined examples only, including seed definitions, build-guide invention entries, and source templates. Do not read the inventions database.
2. Build a pure, local evaluator and offline test harness. Do not add an API route, UI, database write, external model call, or network dependency in this prototype.
3. Do not execute, approve, apply, or change any stored invention or proposal. Do not enable or invoke the autonomous lifecycle.
4. Do not physically construct or test hardware, provide hazardous build instructions, or present unsupported health, energy, or scientific claims as verified.
5. Treat existing votes, statuses, and progress fields as workflow state only—not as proof of feasibility, safety, novelty, or success.
6. Report estimated prompt-token usage as an estimate. Do not describe it as actual model usage or savings because the prototype makes no model calls.

## Proposed design

### 1. Source-only inventory

Collect source-defined invention entries from the known seed, guide, and template locations. Normalize titles and descriptions for stable deduplication while retaining each source reference. Report any entries that cannot be parsed rather than silently dropping them.

### 2. Deterministic evidence and risk screen

Run a cheap, repeatable first pass over every entry:

- classify it as software, physical/hardware, or unclear;
- identify stated evidence and reproducible acceptance criteria;
- flag unsupported factual claims, missing citations, safety concerns, and incomplete specifications;
- detect exact and near-duplicate text candidates;
- distinguish fields that can be scored from dimensions that remain unknown.

An absent citation is “unverified,” not proof that a claim is false. A numeric feasibility or novelty score must not be invented when the source does not support one. Safety concerns are hard stops for build/test routing, not something a high aggregate score can override.

### 3. Review queue and prioritization

Produce an auditable result for every entry: source, category, evidence state, risk flags, duplicate candidates, missing acceptance criteria, recommended next validation step, and a concise reason. The first prototype uses a reviewer interface with deterministic fixtures only; it does not contact a model. A later, separately approved stage may route only ambiguous entries to one compact Tessera review.

### 4. Isolated software validation

Software candidates may be represented by small local test fixtures. The evaluator can recommend a code test only when an entry has a concrete, bounded acceptance criterion and no unresolved safety blocker. The prototype tests the evaluator and routing logic; it does not implement or deploy inventions from the inventory.

Physical or health-related ideas receive an evidence-gap report and a requirement for qualified, independently sourced review. They do not enter the software test path.

## Offline benchmark

Create fixed fixtures for supported, unsupported, incomplete, duplicate, risky, and software-testable examples. Test that:

- every source entry appears exactly once or is explicitly reported as a duplicate;
- missing evidence is never labeled verified;
- safety blockers prevent test routing;
- software routing requires a concrete acceptance criterion;
- repeated runs return stable classifications and reasons;
- the evaluator performs no network calls or database writes.

Measure wall-clock runtime and approximate prompt-token estimates. Compare the staged review’s estimate with a baseline that sends the full source text for every entry. Report the numbers and limitations; do not assert an accuracy improvement or real token savings unless a later human-reviewed benchmark and actual model-call accounting establish them.

## Acceptance criteria

- The source inventory is fully accounted for, with references back to each origin.
- The local test suite passes for all fixture cases and the source inventory.
- Safety and evidence rules are explicit in machine-readable results and human-readable explanations.
- Results are deterministic, do not mutate persisted data, and do not contact external services.
- The final report includes runtime, estimated token counts, duplicate findings, and unverified claims without endorsing them.

## Out of scope

- Reading development or production invention records.
- Changing existing autonomous vote/build/test behavior or lifecycle flags.
- Creating or executing proposals, or applying any invention.
- Live Tessera/model review, API/UI integration, publishing, and physical construction.
- Forum loading or subtab consolidation.

## Next phase

After the user reviews this spec, write an implementation plan for the pure evaluator and offline test harness. Implementation starts only after that plan is ready and the user confirms the spec.
