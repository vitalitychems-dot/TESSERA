# Shared handoff for z

Updated: 2026-10-03

The canonical consolidation destination is `vitalitychems-dot/Zz` on `main`.
The reviewed Tessera import and its merge report are present there. This
repository remains the small handoff/index source; it contains no source-code
tree.

## Next actions

1. Continue review in `Zz`; use `artifacts/z-app/MERGE_REPORT.md` and
   `artifacts/z-app/imports/manifest.json` as the import record.
2. Review the three original documents in this repository before relying on
   their older links or instructions. Links are references, not authorization
   to open or copy linked content.
3. Preserve the remaining source archive paths. Any further cleanup requires a
   new exact-path audit and user approval.
4. Keep the screenshot-only archives withheld until visual review.

The shared handoff files are now published in `Zz`. The user approved deletion
of 53 duplicate archive-part paths from `vitalitychems-dot/tessera-grok-handoff`:
`grok-handoff-images.zip.part-000` through `.part-029` and
`grok-handoff.zip.part-000` through `.part-022`. Commit:
`8cc46b891ea906e2d279e2a102093c0038b0d0cc`. The matching complete archives
remain in `tessera-complete-archives`; no other source paths were deleted.

Two nested `.gitattributes` links in `Zz` were represented as regular files
pointing to the same content blobs so GitHub could accept additive commits; the
other 5,302 imported source-tree links remain symlinks. Do not flatten or
replace any additional links without the user's explicit approval.
