# Shared Tessera handoff

Updated: 2026-10-05

This is the common handoff for Grok Bot, Cursor, Replit Agent, and other
contributors. Use `agent-notes/` for dated work notes; this file tracks the
current shared status and next actions.

## Current state

- The user chose `vitalitychems-dot/TESSERA` as the canonical app base.
  `Gitbook` remains a supporting reference; the old Zz source and data are preserved.
- The existing root preview runs `artifacts/tessera`. The API build selects an
  isolated interactive entry point; the full canonical runtime is preserved,
  not activated. Canonical imports can initialize private-data modules before
  startup guards, so review each module before adding it to the interactive API.
- Owner access uses an HttpOnly session. `SOVEREIGN_ADMIN_TOKEN` needs secure
  setup; existing `SESSION_SECRET` supplies server-side cookie signing.
- The current pen is xAI/Grok. The new chat path calls that provider and returns
  explicit failures rather than canned replies. Live xAI and Cursor access
  still require authorization. App-level GitHub repository access was verified.
- Production builds, shared-library/frontend/backend type checks, and focused
  chat/session unit checks passed. The preview loads its safe setup gate.
  Signed-in browser flows and remaining canonical tabs still need verification.
  Nothing has been published or merged on GitHub by this migration.
- The reviewed import is in `artifacts/z-app/imports/`; its report is
  `artifacts/z-app/MERGE_REPORT.md`.
- In GitHub, two nested `.gitattributes` paths are regular files referencing
  their existing content blobs; the other 5,302 imported source-tree links
  remain relative symlinks.
- The lowercase `vitalitychems-dot/z` repository began as three handoff/index
  documents, not a source-code tree. It now also has a shared handoff note.
  Copies are in `tessera-control/source-z/`.
- The import contains 5,613 source-file references backed by 2,339 unique
  content objects. Exact duplicate content shares one object.
- The `1T` vault, `data/ingest`, secret-shaped files, and three screenshot-only
  archives were excluded. The screenshot archives remain pending visual review.
- The user approved deletion of 53 archive-part paths from
  `vitalitychems-dot/tessera-grok-handoff`: `grok-handoff-images.zip.part-000`
  through `.part-029` and `grok-handoff.zip.part-000` through `.part-022`.
  They were removed in commit `8cc46b891ea906e2d279e2a102093c0038b0d0cc`.
  The matching archive sets remain in
  `vitalitychems-dot/tessera-complete-archives/parts/` (118 and 92 parts).
  No other source paths were deleted. The individual part files differed
  because the repositories used different chunk sizes; the reconstructed ZIP
  hashes matched.

## Next actions

1. Review the imported source and run the relevant application checks before
   integrating any imported code into the active app.
2. Preserve the remaining source archives. Any additional cleanup requires a
   fresh exact-path audit and user approval.
3. Review the withheld screenshot archives visually before deciding whether to
   import any assets.
4. Continue the existing work to restore the imported app's test suite.

## Handoff note format

For each work session, add
`agent-notes/YYYY-MM-DD-<contributor>-<topic>.md`. Include the goal, what
changed, paths touched, checks actually run, next action, and blockers. Do not
include secrets or private data. Keep notes factual and do not replace another
contributor's note.

External posting, deployment, or changes to other repositories require a direct
request from the user in the current conversation.
