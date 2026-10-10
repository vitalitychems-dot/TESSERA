# Implementation Plan: TypeScript Error Cleanup

## Goal

Resolve the 139 API-server and 47 Tessera frontend TypeScript diagnostics from the 2026-10-10 baseline without weakening compiler settings or changing unrelated behavior.

## Batches

1. **Capture a fresh diagnostic baseline**
   - Run the API and Tessera type-checks.
   - Save a temporary diagnostic manifest grouped by file and code.
   - Confirm changes since the reviewed baseline did not alter the error set.

2. **Repair API type contracts**
   - Fix return-path and callback signatures in `legacy-engines.ts` and `sovereign-loop.ts`.
   - Correct data-model, nullability, and Drizzle/schema contracts in semantic compression and deduplication modules.
   - Fix remaining stale properties, argument objects, route parameter narrowing, and handler returns in affected API files.
   - Run API type-check after each coherent group; add focused tests if a correction changes runtime behavior.

3. **Repair Tessera frontend contracts**
   - Align component props and shared data types with their actual callers, including Chat and page-header/card components.
   - Preserve existing UI behavior and routes.
   - Run Tessera type-check after each coherent group.

4. **Full verification**
   - Run the workspace type-check, API test suite, and production build.
   - Verify `/rick` at 402px and desktop widths.
   - Compare final diagnostic/test/build results with the baseline and list any non-type findings separately.

## Guardrails

- Do not use `any`, `@ts-ignore`, blanket suppressions, or relaxed TypeScript configuration to hide errors.
- Keep behavior-preserving corrections small; validate/normalize at real boundaries rather than casting.
- Do not access production data, private vault or natal files, change database schemas, publish, or apply autonomous proposals.
- Leave mobile navigation redesign, startup/external timeouts, and proposal-execution behavior for separate approval.
