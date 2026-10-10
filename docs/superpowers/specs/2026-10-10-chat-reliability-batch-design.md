# Chat Reliability Batch

**Status:** Design draft for user review  
**Product area:** Tessera web app and API  
**Purpose:** Remove the verified type-contract failures on the Chat surfaces and add focused checks for the two chat response contracts without changing reply behavior.

## Problem and baseline

The baseline inspection on 2026-10-10 found:

- The Tessera frontend type-check fails with 47 diagnostics across 30 files. Nine are in `ChatArea` and `ChatMessageList`: a missing icon import, incompatible voice-handler callback props, message ID/type mismatches, an incorrect `tesseractMode` type, and a nullable value passed where a boolean is required.
- The API server type-check reports 139 diagnostics overall. Three are in the Royal Inventor route: an entry field absent from the canonical type and two calls that pass strings where the corpus query API requires an options object.
- The API test command passes 9 tests in one compression-pipeline test file. There are no route-level chat contract tests and no Tessera frontend test files.
- The main `/api/messages` route has no reported TypeScript diagnostic, but its SSE contract is not covered by an API test.
- At 402px wide, the Royal Inventor view shows its existing tabs overflowing the header. This is recorded for comparison only; navigation redesign belongs to the separate UX design.

The full workspace type-check will remain failing after this focused batch because unrelated errors are out of scope. Report the before/after counts honestly and identify remaining failures by package.

## Approved scope

1. Fix only the nine verified Tessera Chat component diagnostics and three Royal Inventor API route diagnostics.
2. Add focused API contract tests for the main `/api/messages` SSE response and the Royal Inventor chat response/data contract, using mocks or test fixtures so tests do not mutate project data or call external providers.
3. Keep existing message behavior, route names, SSE fields, stored data, authorization checks, and response semantics unchanged.
4. Compare the same baseline checks before and after: frontend type-check, API type-check, API tests, and a phone-width preview of `/rick`.
5. Do not inspect private vault or natal files, access production data, publish, or perform unrelated bulk type fixes.

## Design

### Frontend Chat types

- Align `ChatMessageList` input types with the message shape actually returned and created by the chat hooks, including optional string-or-number IDs and nullable fields.
- Align `tesseractMode` with the boolean value supplied by `ChatArea`.
- Make microphone press callback signatures consistent across `ChatArea`, the composer, and `ChatVoiceModeOverlay`, while preserving mouse and touch behavior.
- Import the drag-overlay attachment icon that the component already renders.
- Keep changes localized to the Chat component contracts; do not refactor unrelated pages surfaced by the frontend type-check.

### API route contracts

- Make the Royal Inventor route use the canonical corpus-entry shape and query options object. Preserve the current route response fields and filtering intent.
- Add isolated Vitest tests for `/api/messages` that verify the SSE response includes its existing completion/content structure and does not depend on a live provider.
- Test the `/api/rick/chat` response contract and the affected Royal Inventor knowledge-vault, inventions, and role route data shapes so the corrected route usage remains compatible.
- Use mocks or fixtures for database and provider-facing dependencies. Do not send messages to real project conversations, write to persistent project configuration, or reach external services from tests.

## Verification and before/after report

Run and report:

1. `pnpm --filter @workspace/tessera typecheck`
2. `pnpm --filter @workspace/api-server typecheck`
3. `pnpm --filter @workspace/api-server test`
4. A phone-width preview at the same `/rick` route and viewport used for the baseline.

Success criteria:

- No TypeScript diagnostics remain in the targeted `ChatArea`, `ChatMessageList`, or Royal Inventor API route locations.
- New chat contract tests pass, as do all existing API tests.
- The preview still loads; record the existing tab overflow separately rather than claiming this reliability batch fixes it.
- The final report shows the original and new package-level diagnostic/test counts and clearly lists remaining unrelated errors.

## Out of scope

- Fixing the remaining frontend or API diagnostics outside the identified Chat/Royal Inventor paths.
- Redesigning mobile navigation or changing Tessera's reply-generation behavior.
- Changing database schemas, endpoint semantics, credentials, external provider behavior, or production data.
- Adding a new frontend test framework, unless the focused checks prove impossible with the existing test setup; if so, return for scope approval before adding dependencies.
- Publishing or applying any autonomous proposal.
