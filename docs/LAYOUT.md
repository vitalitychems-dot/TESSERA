# Repository layout

Status: REPORTED. This is the map after the source repositories were moved. It is not a new application.

## Where things go

| Path | Role |
|---|---|
| `artifacts/tessera` | The live web app. |
| `artifacts/api-server` | The live API. |
| `artifacts/mockup-sandbox` | A separate sandbox. Fifty-two UI files there are byte-for-byte the same as `artifacts/tessera/src/components/ui`. Both copies stay, because each package imports its own path. |
| `lib` | Shared database and API packages. |
| `preview` | The desk preview. |
| `docs` | Current notes for this code. |
| `archives` | Older variants. None of these files is a byte-for-byte copy of a live file. |
| `.agents/skills` | Skill notes. They are not installed tools. |

## The other repository

`vitalitychems-dot/Gitbook` holds instructions, the board, and `archive/moved/`. That archive is the only remaining copy of files that were not already in this repository. Do not delete it as a duplicate. A scan on 2026-10-08 found zero blobs that exist in both `archive/moved` and this repository.

The old source repositories were deleted after that move. This file replaces the earlier line that said those repositories were still unchanged.
