# Full-picture audit and migration coverage

**Audit date:** 2026-10-05  
**Destinations:** `TESSERA` (active code) and `Gitbook` (instructions, review, coordination, and evidence)

## Executive result

The current account-level audit refreshed **19 non-destination repositories**, excluding `TESSERA` and `Gitbook`. The audit compared tracked file SHA-256 hashes against both published destinations and found **3,575 exact duplicate-content groups**. Those repeats are already represented by a canonical destination file or by a documented historical record.

The audit also found **3,830 source files whose bytes are not present in the destinations**. These are not automatically missing product functionality. Their roles are:

| Candidate role | Count | Disposition |
|---|---:|---|
| Code/config | 923 | Review only; most are alternate-app code, imported snapshots, package manifests, or generated deployment code. No wholesale merge is safe. |
| Images/fonts | 165 | Review only; many are old themes, alternate-app assets, or generated/static output. Do not bulk-import duplicates or unlicensed assets. |
| Documentation/other | 2,742 | Import only when readable, source-attributed, privacy-screened, and not raw archive/generated output. Safe coordination/handoff material is already in Gitbook. |

## Repository-level findings

| Repository | Files / bytes | Unique vs destinations | Main disposition |
|---|---:|---:|---|
| `Zz` | 8,020 / 173.5 MB | 4,563 | Large source-index/import repository. Most unique paths are nested imported trees, raw data, generated output, or alternate snapshots; not merged wholesale. |
| `olive-giant-ever-glade` | 4,319 / 90.5 MB | 2,337 | Separate `app-builder-workspace` application with independent auth, database, migrations, storefront/UI, and deployment contract; not merged into TESSERA. |
| `tessera-grok-handoff-complete` | 328 / 164.6 MB | 316 | Archive/handoff material; readable summaries were moved to Gitbook, raw archive payloads were not. |
| `tessera-complete-archives` | 316 / 162.4 MB | 312 | Archive material; no executable code was required by the canonical TESSERA build. |
| `5t`, `T44`, `TESS`, `1T`, `1` | 1,265–1,317 each | 190–222 each | Repeated Tessera snapshots with branch-only notes, audit data, generated/archive content, or sensitive review boundaries. Not merged wholesale. `1T` remains protected/uninspected. |
| `Grok-ready` | 1,292 / 18.9 MB | 22 | Prior baseline; its reviewed canonical content is represented in TESSERA/Gitbook. Open PR/branch-only work is not claimed as merged. |
| `tessera-grok-handoff`, `tessera-coordination`, `z`, `Everything` | small | 0–26 | Readable summaries/indexes were categorized into Gitbook; remaining unique content is historical or requires review. |
| `Tessera-main`, `tessera-replit` | empty/placeholder | 0–1 | No active code to import. |

## Why the unique code was not bulk-merged

`Zz` contains nested paths such as `artifacts/z-app/imports/trees/...`; those are imported historical workspaces, not a clean source package. `olive-giant-ever-glade` is an alternate app with its own `app-builder-workspace` package, PGlite/Postgres/auth flow, migrations, scripts, and Vercel output. Copying either tree into the canonical pnpm workspace would reintroduce duplicate applications, conflicting manifests, old dependencies, duplicate routes, stale themes, and unverified data paths.

The canonical TESSERA API already contains the reviewed active API surface and passes its current typecheck, tests, build, production audit, and two-app smoke test. The safest consolidation is therefore **one active application tree**, not a union of every historical snapshot.

## Migration coverage decision

### Covered and moved

- Reviewed canonical Tessera code and active workspace files: `TESSERA`.
- Agent instructions, coordination, TODOs, handoffs, source maps, review ledgers, OCR/transcript indexes, and deletion gate: `Gitbook`.
- Exact duplicate files and old theme/runtime copies: represented once by canonical content or omitted as generated/archive material.

### Deliberately not moved

- Raw archives, Vercel/Nitro output, browser/runtime stores, imported nested workspaces, old generated builds, duplicate images, old theme assets, and package-manager artifacts.
- Unreviewed alternate application code from `olive-giant-ever-glade`.
- Unreviewed imported snapshots and source/data payloads from `Zz`.
- Protected `1T` contents and any secret-shaped, personal, customer, wallet, credential, or private runtime material.
- Branch-only work and open PRs that were not reviewed or merged.

## Deletion gate

The old repositories must **not** be deleted on the basis of “all bytes copied,” because that would be false: 3,830 unique source files were intentionally omitted pending review. Deletion is safe only after the owner chooses one of these explicit scopes:

1. **Canonical-only cleanup:** accept the documented omissions and delete the old repositories after confirming that the historical code/data is intentionally discarded.
2. **Selective recovery:** name specific unique paths or features to review and integrate, then rerun typecheck, tests, build, audit, and smoke checks.
3. **Retention:** keep selected source repositories, especially `1T`, `Zz`, or `olive-giant-ever-glade`, until their unique content is separately reviewed.

No deletion was performed by this audit.

## Evidence

- [`full-audit-report.json`](full-audit-report.json) — machine-readable file/hash inventory and candidate classification.
- [`full-audit-summary.tsv`](full-audit-summary.tsv) — repository-level counts.
- [`duplicate-groups.tsv`](duplicate-groups.tsv) — exact duplicate groups and sample paths.
- [`DELETION-MANIFEST.md`](DELETION-MANIFEST.md) — exact candidate repository names and deletion gate.
