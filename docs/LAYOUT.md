# Repository layout

Status: REPORTED. This is the map after the source repositories were moved. It is not a new application.

## Where things go

| Path | Role |
|---|---|
| `artifacts/tessera` | The live web app. |
| `artifacts/api-server` | The live API. |
| `artifacts/mockup-sandbox` | A separate sandbox. Its UI primitives, `use-mobile` hook, and `utils` module are symlinks to the single copies in `artifacts/tessera`. |
| `lib` | Shared database and API packages. |
| `preview` | The desk preview. |
| `docs` | Current notes for this code. |
| `archives` | Older variants. None of these files is a byte-for-byte copy of a live file. |
| `.agents/skills` | Skill notes. They are not installed tools. |

## The other repository

`vitalitychems-dot/Gitbook` holds instructions, the board, and `archive/moved/`. That archive is the only remaining copy of files that were not already in this repository. Do not delete it as a duplicate. The `Zz` tree (about 4,761 files) is shared between this repository's `archive` and Gitbook's `archive/moved`, so there is one copy to decide on, not two.

The old source repositories were deleted after that move. This file replaces the earlier line that said those repositories were still unchanged.
