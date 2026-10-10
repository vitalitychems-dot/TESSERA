# Tessera and API TypeScript Error Cleanup

**Status:** Design draft for user review  
**Product area:** Tessera web app and API  
**Purpose:** Resolve all 186 TypeScript diagnostics found in the API server and Tessera frontend, preserving runtime behavior and restoring a passing workspace type-check.

## Baseline

The baseline inspection on 2026-10-10 found:

- **API server:** 139 TypeScript diagnostics across 24 files. The largest clusters are `legacy-engines.ts` (50), `sovereign-loop.ts` (24), and `semantic-compression.ts` (11). Common categories include missing return paths, incompatible arguments, stale properties, and nullability/schema mismatches.
- **Tessera frontend:** 47 diagnostics across 30 files. Most are incompatible component props or data types; ChatArea and ChatMessageList contain nine.
- **Other workspace checks:** shared libraries, mockup sandbox, and scripts passed in the initial root type-check run.
- **API tests:** 9 tests pass in one compression-pipeline test file.

The previous focused Chat reliability draft is superseded by this broader scope. The separate mobile-layout, startup-timeout, external-request, and proposal-execution findings remain out of scope.

## Approved scope

1. Fix all baseline TypeScript diagnostics in `artifacts/api-server` and `artifacts/tessera`.
2. Preserve behavior and data contracts unless a type error demonstrates an actual mismatch; any such correction must be covered by a focused regression test.
3. Keep strict TypeScript settings. Do not use broad `any` conversions, `@ts-ignore`, blanket suppressions, or loosen compiler configuration to hide errors.
4. Run before/after checks and report remaining failures honestly if new, unrelated diagnostics appear.
5. Do not inspect private vault or natal files, access production data, publish, or apply autonomous proposals.

## Implementation design

Work in small dependency-aware batches, type-checking the affected package after each batch:

1. **API foundations:** repair common contracts and return paths, starting with the high-count `legacy-engines.ts` and `sovereign-loop.ts` files; then handle semantic-compression and semantic-deduplication nullability/schema issues.
2. **Remaining API modules:** correct stale property access, argument shapes, route parameter narrowing, and incomplete Express handler returns in the other affected library and route files.
3. **Frontend contracts:** align component props, message IDs and nullable values, and shared page-component props with their actual callers. Preserve the user-visible behavior of every affected page.
4. **Regression checks:** add focused tests where a type repair changes runtime logic, especially for nullable database values, route inputs/outputs, serialization, and chat message handling. Keep tests isolated from production data and external services.
5. **Full verification:** run the full workspace type-check, existing API tests, and production builds. Recheck the Chat/Royal Inventor preview at phone and desktop sizes.

When a compile diagnostic reflects a genuine mismatch between the caller and canonical API/type, make the smallest behavior-preserving correction at the appropriate boundary. Do not add compatibility casts when validation or normalization is required.

## Before/after verification

Use the same checks on both sides:

- `pnpm run typecheck`
- `pnpm --filter @workspace/api-server typecheck`
- `pnpm --filter @workspace/tessera typecheck`
- `pnpm --filter @workspace/api-server test`
- `pnpm run build`
- Preview checks of `/rick` at 402px and desktop widths

Success means the targeted packages and workspace type-check pass, all existing API tests pass, production builds succeed, and the preview still loads. Show the original 139 API and 47 frontend diagnostics alongside final counts. If a build or unrelated runtime failure remains, identify it rather than suppressing it.

## Out of scope

- Redesigning mobile navigation or changing Tessera's reply-generation behavior.
- Fixing startup probes, external API timeouts, or proposal-executor behavior.
- Database/schema migrations, production data changes, new model providers, or new credentials.
- Adding a frontend test framework or changing dependencies unless the current checks prove insufficient; request approval before expanding dependencies.
- Refactoring code beyond what is needed to resolve the diagnosed types and protect affected behavior.
