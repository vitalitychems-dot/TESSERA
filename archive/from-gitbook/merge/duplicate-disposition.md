# Duplicate disposition and cleanup policy

The audit found **3,687 exact duplicate-content groups** and **5,777 repeated-basename groups** across the staged repository snapshots. The largest overlap is the same Tessera workspace repeated in `1`, `1T`, `5t`, `T44`, `TESS`, `Grok-ready`, `tessera-unified`, `Zz`, and `olive-giant-ever-glade`, often alongside imported ingest objects or archive parts.

## Rules used for the staged build

1. Retain one reviewed canonical application copy in `TESSERA`, sourced from `tessera-unified`.
2. Retain one documentation and intake copy in `Gitbook`, with categories and provenance instead of repeated paths.
3. Preserve readable records that explain decisions, validation, ownership, rights, and unresolved work.
4. Do not treat a same-name file as a duplicate until its content and role are checked.
5. Do not copy raw archive parts, secret-shaped files, local vaults, customer data, or unreviewed private material into the destinations.
6. Never delete source files or repositories solely because a hash matches; deletion requires an exact-path/repository manifest and owner approval.

## Current staged result

- Canonical code is copied once into the local `TESSERA` build workspace.
- Readable instructions, handoffs, coordination records, screenshot indexes/transcripts, validation notes, and duplicate ledgers are copied once into the local `Gitbook` build workspace.
- The source repositories are still unchanged.
- GitHub repository deletion has **not** been performed.

## Required deletion gate

Before any old repository is deleted, verify clean builds from both destinations, review the final repository-by-repository manifest, check external links and collaborators, and obtain an explicit approval for the exact deletion list. Deletion is irreversible and is intentionally outside this staging commit.
