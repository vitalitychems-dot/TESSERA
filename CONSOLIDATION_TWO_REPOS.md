# Two-repository consolidation

This repository is the active Tessera code destination. `Gitbook` is the separate documentation and agent-intake destination.

## Build source

The canonical staged application comes from `tessera-unified`, which already includes the reviewed Tessera web/API workspace, shared libraries, validation scripts, source manifests, deduplication records, image/text review records, and secrets guidance. Repeated historical snapshots were audited but were not copied as duplicate application trees.

## Companion documentation

Use the Gitbook repository for:

- agent instructions and role boundaries;
- coordination, pen, and handoff records;
- migration TODOs and source maps;
- screenshots, OCR/transcripts, forum/conversation summaries, and review status;
- duplicate-disposition evidence and deletion-gate records.

## Validation gate

From a clean clone, run the checks documented in `README.md` and record actual results in Gitbook. Do not claim a live deployment, model training, provider call, or successful migration without evidence. Do not commit credentials, private runtime data, customer records, or unreviewed archives.

The other owner repositories were deleted on 2026-10-08 after their unique blobs were copied to Gitbook `archive/moved/`. The account now contains exactly `TESSERA` and `Gitbook`. See `docs/LAYOUT.md`.
