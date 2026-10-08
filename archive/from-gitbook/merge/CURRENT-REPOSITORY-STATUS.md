# Current repository status and retention boundary

**Checked:** 2026-10-05  
**Destinations:** `TESSERA` and `Gitbook`  
**Rule:** delete only when every tracked file is represented in a destination by exact content, or the repository is empty.

## Result

After the conference pages, recovered records, and historical summaries were published, the exact tracked-file scan found **no additional repository eligible for deletion**. The remaining repositories retain unique content and must stay available until that content is either safely moved, intentionally retained by decision, or covered by a new exact migration.

| Repository | Tracked | Covered | Uncovered | Uncovered bytes | Current disposition |
|---|---:|---:|---:|---:|---|
| `1` | 913 | 722 | 191 | 212,578,901 | Retain; repeated snapshot plus unique media/data/state. |
| `1T` | 1,266 | 1,065 | 201 | 214,249,296 | Retain and protect; vault content was not inspected. |
| `5t` | 1,318 | 1,095 | 223 | 223,036,784 | Retain; snapshot, audit/runtime data, and media remain. |
| `Grok-ready` | 1,293 | 1,272 | 21 | 3,538,833 | Retain; raw media inventories, two screenshots, old manifests, and lockfile remain. |
| `T44` | 1,276 | 1,068 | 208 | 216,800,035 | Retain; branch/runtime/media deltas remain. |
| `TESS` | 1,297 | 1,094 | 203 | 212,729,588 | Retain; snapshot data/media/state remain. |
| `Zz` | 8,023 | 3,486 | 4,537 | 129,014,870 | Retain; alternate `z-app`, imported trees, data, and source history remain. |
| `olive-giant-ever-glade` | 4,319 | 1,997 | 2,322 | 67,235,676 | Retain; separate application contract and runtime/media remain. |
| `tessera-complete-archives` | 316 | 4 | 312 | 162,428,806 | Retain; chunked archive parts remain. |
| `tessera-grok-handoff` | 29 | 3 | 26 | 53,000,316 | Retain; chunked workspace archive remains. |
| `tessera-grok-handoff-complete` | 328 | 12 | 316 | 164,605,205 | Retain; chunked image/archive parts remain. |

## What has already been safely consolidated

- Active reviewed code and current workspace cleanup: `TESSERA`.
- Instructions, goals, agent coordination, forum, provenance, source maps, handoffs, and deferred work: `Gitbook`.
- Exact duplicate content: represented once where appropriate.
- Historical records that were safe to preserve: moved into `Gitbook/history/recovered/`.
- Old generated output, raw runtime stores, protected material, and unreviewed alternate applications: intentionally retained in source repositories rather than copied into the active destinations.

## Next deletion condition

A future agent may propose a deletion only after:

1. Moving or safely summarizing the specific necessary content.
2. Updating the provenance and backlog records.
3. Re-running the exact tracked-file hash scan.
4. Confirming the repository has zero uncovered tracked files or is empty.
5. Obtaining explicit confirmation for the exact repository name.

No agent should delete a repository merely because it is old, duplicated by behavior, or no longer the preferred application version.
