# HYB-011 exclusion manifest

**Checked:** 2026-10-05  
**Status:** READY. This pass listed repository roots only. It did not open file bodies, zip parts, or `parts/` trees, and it did not copy any archive into Gitbook.  
**Not opened:** `1T`. No `1T` contents API call was made.

## Root names (TESTED)

GitHub contents API, default branch, names only:

| Repository | Root names that stay excluded | Secret-shaped root name |
|---|---|---|
| `1` | `artifacts/`, `attached_assets/` | none at root |
| `5t` | `artifacts/`, `attached_assets/` | none at root |
| `Grok-ready` | `archives/`, `artifacts/` | none at root |
| `T44` | `artifacts/`, `attached_assets/` | none at root |
| `TESS` | `artifacts/`, `attached_assets/` | none at root |
| `Zz` | `artifacts/`, `attached_assets/` | none at root |
| `olive-giant-ever-glade` | `data/`, `.vercel/` | none at root (`.env` not present) |
| `tessera-complete-archives` | `parts/` | none at root |
| `tessera-grok-handoff` | `grok-workspace_*.zip.part-*` (parts 000–025) | none at root |
| `tessera-grok-handoff-complete` | `parts/` | none at root |

No root entry was a `.env`, `.pem`, or `id_rsa` file. Deeper trees were not listed.

## Prior census (not re-opened)

`merge/full-audit-report.json` already stores `unique_sensitive_review` counts. Those paths were not printed or re-fetched in this pass:

| Repository | Count in that JSON |
|---|---:|
| `T44` | 1 |
| `Zz` | 16 |
| `olive-giant-ever-glade` | 9 |
| `1T` | 1 (path withheld; repository not opened) |
| `tessera-unified` | 1 (repository already deleted; count is historical) |

Other source rows in that JSON have count 0. Eight repositories named in [DELETION-MANIFEST.md](DELETION-MANIFEST.md) were already deleted and were not listed again.

## Still excluded

- Chunk and zip bodies (`parts/`, `grok-workspace_*.zip.part-*`).
- `data/` on `olive-giant-ever-glade`.
- `archives/` on `Grok-ready`.
- `1T`, unopened.

HYB-011 stays READY until a later pass can record a value-redacted deep-tree result without copying archives or opening `1T`.
