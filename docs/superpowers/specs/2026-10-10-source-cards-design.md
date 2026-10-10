# Source Cards — Design

**Status:** Approved for specification; awaiting user review
**Date:** 2026-10-10

## Goal

Add a small, themed Source Cards section to the existing Tessera application. The first batch exposes four source-backed behaviors as transparent, locally executed demonstrations. GitBook remains a read-only provenance reference; this work does not merge repositories, synchronize data, or write to GitBook.

## Source evidence

The behaviors were inspected at the pinned commits recorded in the GitBook archive:

- Brain-Cog `f9b879f75da2247a9f0c31864a947f0e5d2f3dab`
  - `braincog/utils.py::mse`
  - `braincog/utils.py::accuracy`
  - `braincog/utils.py::adjust_surrogate_coeff`
- GödelOS `b915095b25b855e86af5b76c6e684e5428116d9e`
  - `backend/utils.py::sanitize_knowledge_content`

The implementation will reproduce behavior in TypeScript rather than install, import, or execute either upstream library. Each card will identify its upstream repository, pinned commit, source path, and available archival provenance. No card will imply that the full upstream package is installed or running.

## Product surface

Create a dedicated `/source-cards` page in Tessera and add it to existing navigation. Keep the existing Codex page focused on its books rather than mixing research utilities into it.

The page will use Tessera’s existing near-black violet surfaces, cyan primary accent, established violet/amber/emerald accents, and current sans/monospace typography. Cards will use the app’s existing responsive grid and card patterns, with keyboard-accessible inputs, buttons, focus indicators, and visible result/error states.

Each card will include:

- A concise behavior description and source badge.
- A safe, editable input or preset example.
- A run action and a visible output.
- A source path and pinned commit reference.

The first page will contain only these four cards. It will not claim that the remaining catalog cards have been implemented.

## Behavior contracts

1. **Mean-squared gap (`mse`)**
   - For equal-shaped numeric arrays, compute the sum of squared differences along the final axis, then the mean of those sums, matching the source operation order.
   - The one-row example `[2]` and `[0]` returns `4`.
   - Reject ragged or mismatched arrays with a visible validation message.

2. **Top-k accuracy (`accuracy`)**
   - Accept a batch of class-score rows, corresponding integer target labels, and one or more positive `k` values.
   - For each `k`, count a row as correct when its target is among the `k` highest-scoring classes; return percentages on a 0–100 scale.
   - Validate non-empty batches, aligned row/label counts, valid labels, and `k` values no larger than the class count.

3. **Surrogate coefficient schedule (`adjust_surrogate_coeff`)**
   - Reproduce the logarithmic interpolation from `1e-3` through `1e1` across the requested epoch range; return the source’s constant `k = 1`.
   - At epoch zero, `t` is `0.001`.
   - Require integer `epoch` and `tot_epochs` values with `tot_epochs > 0` and `0 <= epoch <= tot_epochs`.
   - Use ordinary TypeScript math rather than PyTorch tensors or CUDA. Reject invalid epoch counts and non-finite inputs.

4. **Knowledge-content tag removal (`sanitize_knowledge_content`)**
   - For string input, trim whitespace, remove substrings matching the source’s simple `<[^>]*>` pattern, then truncate to 10,000 characters and append `...` when over the limit.
   - For non-string or empty input, return the source’s empty-string result.
   - Treat this as legacy/basic text cleanup only, not safe HTML sanitization. Render the result as escaped text; never inject it as HTML or use it as a security boundary.

## Architecture and data flow

- Store four small, pure behavior functions in a Tessera library module, separate from UI components.
- Keep card metadata (display name, source repository, commit, file, behavior notes) in a small typed data module.
- The page imports the metadata and functions directly. User input stays in the browser; there is no API call, database write, source-code execution, or GitBook mutation.
- Use explicit validation and card-local error states; do not silently substitute defaults for invalid inputs.
- Do not add a shared cross-repository runtime or a general-purpose plugin/execution system.

## GitBook boundary and provenance

GitBook content is read-only for this feature. Use only existing archival references that can be identified locally; otherwise show the pinned upstream repository and source path without inventing a GitBook link. No GitBook API integration, write, sync, or repository merge is in scope.

The source code itself will not be copied into Tessera. Preserve repository/commit/file attribution in the card metadata. If implementation work finds that verbatim code reuse is necessary, stop and review the applicable license before proceeding.

## Testing and verification

- Add focused unit tests for the four behavior contracts, including the stated examples, top-k edge cases, schedule boundaries, malformed arrays, whitespace/tag removal, and the 10,000-character limit.
- Use the workspace’s Vitest convention for the new Tessera tests; add only the minimal Tessera test script/dependency wiring needed.
- Run Tessera typecheck and production build.
- Verify the new route and navigation at desktop and mobile widths, including keyboard operation and visible invalid-input states.
- Do not run upstream repository code or tests.

## Explicitly out of scope

- Implementing the other catalog cards or claiming the 192-card set is complete.
- Installing Brain-Cog or GödelOS, importing their dependencies, or executing their code.
- Editing or synchronizing the GitBook repository.
- Merging Tessera and GitBook repositories.
- Pushing to `main`.
