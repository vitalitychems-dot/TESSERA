# Implementation Plan: Staged Invention Review

> **Superseded:** Use `2026-10-10-tessera-capability-improvements-plan.md` for the approved 27-candidate program.

## Goal

Build a source-only, deterministic invention-review prototype with an offline test harness. It must not read invention records from the database, call external models, mutate data, or execute proposals.

## Batches

1. **Add safe source inventory extraction**
   - Implement a TypeScript-AST reader under `scripts/src/` for the literal invention arrays in `artifacts/api-server/src/routes/inventions.ts`, `artifacts/api-server/src/lib/rick-sanchez-agent.ts`, and `artifacts/tessera/src/pages/BuildPage.tsx`.
   - Extract titles, descriptions, source references, and relevant evidence/safety text without importing or evaluating application modules.
   - Report parse gaps instead of omitting entries.

2. **Implement deterministic staged review**
   - Normalize entries and identify exact/near-duplicate candidates.
   - Classify software, physical/hardware, or unclear; flag evidence gaps and safety keywords as review signals, not factual verdicts.
   - Route only explicitly bounded, non-blocked software cases toward local test planning; never mark inventions as validated.
   - Report transparent reasons and estimated prompt-token counts against a full-text review baseline.

3. **Add an offline benchmark**
   - Use Node's built-in test runner and existing `tsx`; add fixtures for duplicates, missing evidence, safety holds, and testable software.
   - Assert full source coverage, stable results, no database/network imports, safety gating, and honest token-estimate labels.
   - Capture runtime and estimated-token comparisons without claiming actual model-token savings.

4. **Verify and report**
   - Run the scripts type-check and the new offline tests.
   - Run the evaluator once against source files only and report inventory coverage, duplicate candidates, review flags, runtime, and estimated token counts.
   - Confirm the working tree shows no changes to invention data or lifecycle state.

## Guardrails

- Do not import `routes/inventions.ts` or call `generateRickInventions`; both are coupled to runtime state.
- Do not access development or production invention records, external APIs, model integrations, or secrets.
- Do not change autonomous invention lifecycle code, create API/UI integration, execute proposals, or physically test hardware.
- Keep scores explainable; missing evidence is unverified, not false, and risk flags are prompts for qualified review rather than definitive safety judgments.
