# Source heads and agent work launch

**Checked:** 2026-10-05  
**Purpose:** record the newest GitHub revision for every remaining historical source and launch one non-overlapping task per agent lane.

## Source-head verification

Local read-only snapshots match the current GitHub branch heads. No unpublished local commits were found in these source repositories:

| Repository | GitHub ref | Verified head |
|---|---|---|
| `1` | `main` | `3bad9785cd005438d70acea8fa48a3deca503044` |
| `1T` | `main` | `6bb4be42efd3397048ca51039269cb48f552eaba` |
| `5t` | `main` | `8b3b9cece74c421896a7fe8128ba3dc00a443c8b` |
| `Grok-ready` | `main` | `9e3fbca200306988db35fff5afef814108fca66b` |
| `T44` | `main` | `2b78e8b73b9f850f0f9bf95f371e2c3524f98c34` |
| `TESS` | `main` | `5bc2333e8884af79ea31e8aefa05b88d46a19f26` |
| `Zz` | `main` | `150d4ec044201ae5d43878da38c7bd7788c3ac2a` |
| `olive-giant-ever-glade` | `cycle/chamber-text` | `6fa4a7e043f699edfe0453835a17c7e3b9aaa166` |
| `tessera-complete-archives` | `main` | `d0e014891e3d973c7420556c8769b58ece7e3da0` |
| `tessera-grok-handoff` | `main` | `8cc46b891ea906e2d279e2a102093c0038b0d0cc` |
| `tessera-grok-handoff-complete` | `main` | `5f7285f0c4f92f9210d9d2cd51200ceee74e6abc` |

## Destination heads

- `TESSERA`: `fec56eb09d19907832663d5f16fcbc24f3d00317`
- `Gitbook`: this source-head record is being published now.

## Initial agent assignments

| Agent lane | Task | Exact scope | First deliverable |
|---|---|---|---|
| Grok historical analyst | `HYB-006` | `Grok-ready` behavior vs current TESSERA | Capability diff; no code copy |
| Grok source analyst | `HYB-007` | `Zz/artifacts/z-app` | Portable behavior matrix; no alternate app merge |
| Replit prototype agent | `HYB-012` | Current TESSERA API/UI route registry | One missing or duplicate route proposal with test |
| Tessera maintainer | `HYB-013` | Current Tessera UI vs older screen concepts | One scoped missing user flow or explicit no-gap result |
| Security/privacy reviewer | `HYB-005` + `HYB-011` | Dependency advisory and protected/raw material | Advisory decision and exclusion update |
| Archive/media steward | `HYB-009` + `HYB-010` | Handoff chunks, screenshots, themes, media | Disposition matrix; no raw duplication |
| Gitbook moderator | `HYB-015` + `HYB-016` | Forum, backlog, check-ins | Deduped proposals and current ownership ledger |
| Release steward | `HYB-014` + `HYB-018` | Validation and coverage | Merge gate and next deletion scan |

## Important boundary

“Move everything” means **move every safe, necessary, and portable item** into the two active repositories. It does not mean copying protected vaults, secrets, private/runtime data, raw chunked archives, generated builds, or independent application contracts into the active workspace. Those remain retained until explicitly reviewed and covered.
