# Canonical destinations and no-replica policy

**Published:** 2026-10-07  
**Canonical build:** [`vitalitychems-dot/TESSERA`](https://github.com/vitalitychems-dot/TESSERA)  
**Canonical agent hub:** [`vitalitychems-dot/Gitbook`](https://github.com/vitalitychems-dot/Gitbook)

## Truth

There is one active TESSERA build and one Gitbook coordination hub:

- **TESSERA** contains the active product source, tests, executable configuration, and reviewed graph artifact.
- **Gitbook** contains all agent instructions, goals, check-ins, conversations, source evidence, backlog items, forum notes, review decisions, and deletion manifests.

No new replica repository was created by this consolidation pass. Historical repositories are source references only; they are not parallel build targets.

The older duplicate/empty destinations already removed in the prior confirmed cleanup include `Everything`, `TX`, `Tessera-main`, `tessera-coordination`, `tessera-gitbook`, `tessera-replit`, `tessera-unified`, and `z`.

## Current repository inventory

The remaining source repositories are not all duplicates by content. The latest exact blob-hash report is [`current-coverage-2026-10-07.tsv`](current-coverage-2026-10-07.tsv).

| Repository family | Current status | Why it is not deleted yet |
|---|---|---|
| `1`, `5t`, `T44`, `TESS` | Historical application snapshots | Each retains hundreds of uncovered blobs containing snapshot-specific code, media, state, or audit material. |
| `Grok-ready` | Historical application baseline | 42 uncovered blobs remain; review is selective, not wholesale. |
| `Zz` | Alternate application/source index | 5,928 uncovered blobs remain; it contains a separate `z-app`, imported trees, and data. |
| `olive-giant-ever-glade` | Separate application | 2,252 uncovered blobs remain; it has its own auth, database, migration, and deployment contract. |
| `tessera-complete-archives`, `tessera-grok-handoff`, `tessera-grok-handoff-complete` | Archive/handoff sources | Chunked archive parts remain uncovered and should not be duplicated into the active build. |
| `Run-Z-app`, `Run-Z-app2` | Unrelated application family | Not Tessera source repositories; their default branches contain no tracked blobs in the coverage scan. |
| `1T` | Protected vault | Must not be inspected, copied, indexed, published, or deleted. |

## Deletion rule

A source repository may be deleted only when all of the following are true:

1. Its tracked blobs are 100% represented in TESSERA or Gitbook, or it is demonstrably empty.
2. Any sensitive, private, protected, archive, generated, or unrelated material has an explicit disposition.
3. The exact repository name is listed in a Gitbook deletion manifest.
4. The human owner confirms that exact deletion list.

A general “publish,” “continue,” or “merge everything” instruction does not authorize deleting unique source history, protected vault material, or unrelated applications. The current scan has **no historical Tessera source repository at 100% coverage**, so no such repository is currently eligible for deletion.

## Agent instruction

Do not push product code to a historical repository. Post instructions and evidence to Gitbook; implement approved product changes only in TESSERA branches/PRs. If a source idea is useful, create one scoped backlog task with source commit, exact path, behavior, test, provenance, and rollback—not a second copy of the application.
