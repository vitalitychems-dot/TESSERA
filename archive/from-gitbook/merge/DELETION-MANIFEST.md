# Repository deletion manifest — completed safe cleanup

**Prepared:** 2026-10-05  
**Destination repositories verified:**

- [`vitalitychems-dot/TESSERA`](https://github.com/vitalitychems-dot/TESSERA) — `fec56eb09d19907832663d5f16fcbc24f3d00317`
- [`vitalitychems-dot/Gitbook`](https://github.com/vitalitychems-dot/Gitbook) — `eefbe2fd53eba6a917c4a078dac15e5beade69da`

Deletion was performed only after explicit confirmation of the exact eight names below. The operation did not touch `TESSERA` or `Gitbook`.

## Exact coverage result

The post-migration SHA-256 scan compared every currently tracked file in each source repository with the published `TESSERA` and `Gitbook` trees. The only repositories reaching **100% tracked-file coverage or zero tracked files** are:

`Everything`, `TX`, `Tessera-main`, `tessera-coordination`, `tessera-gitbook`, `tessera-replit`, `tessera-unified`, and `z`.

These eight were the only repositories eligible for deletion under the owner's “100% copied/moved or empty” rule. They have now been deleted. All other candidates retain un-moved unique files and remain intact.

## Completed deletion

Deleted after confirmation:

`Everything`, `TX`, `Tessera-main`, `tessera-coordination`, `tessera-gitbook`, `tessera-replit`, `tessera-unified`, and `z`.

GitHub verification confirmed the protected destinations remain present, private, and on `main`.

## Candidate repositories for deletion

The following **19** repositories are the exact account-level candidates remaining after the two destination repositories were published:

| Repository | Reason staged as candidate | Special review note |
|---|---|---|
| `1` | Repeated application/archive snapshot | Contains an unrelated-history branch that was not imported wholesale. |
| `1T` | Protected vault duplicate/candidate | Contents were not inspected; **do not delete unless explicitly confirmed as intended**. |
| `5t` | Repeated application snapshot | Branch-only memory/audit/screenshot deltas remain unmerged. |
| `Everything` | Coordination/source starter snapshot | Historical handoff material was represented in Gitbook where safe. |
| `Grok-ready` | Prior application baseline | Open unreviewed PRs and legacy refs were not treated as merged. |
| `T44` | Repeated application snapshot | Branch-only agent-memory delta remains unmerged. |
| `TESS` | Repeated application snapshot | No distinct reviewed application role retained. |
| `TX` | Coordination/source snapshot | Branch-only instruction material remains unmerged. |
| `Tessera-main` | Empty/placeholder destination | No active default branch was reported. |
| `Zz` | Repeated application/source snapshot | Historical source index represented in Gitbook. |
| `olive-giant-ever-glade` | Repeated private application snapshot | Non-main default branch `cycle/chamber-text`; review links/refs before deletion. |
| `tessera-complete-archives` | Archive/handoff repository | Handoff summary represented in Gitbook; raw archive is not copied into active docs. |
| `tessera-coordination` | Coordination repository | Coordination records represented in Gitbook. |
| `tessera-gitbook` | Duplicate documentation repository | Documentation represented in Gitbook. |
| `tessera-grok-handoff` | Handoff repository | Privacy-screened summary represented in Gitbook. |
| `tessera-grok-handoff-complete` | Handoff/archive repository | Readable operating/handoff summaries represented in Gitbook. |
| `tessera-replit` | Empty/placeholder repository | No distinct active code retained. |
| `tessera-unified` | Source of the canonical reviewed code | Its tree is now represented in `TESSERA`; preserve source history only if desired. |
| `z` | Source-index/archive repository | Safe index records represented in Gitbook. |

## Required confirmation payload

Before deletion, confirm one of these exact scopes:

1. The confirmed safe cleanup is complete.
2. The remaining 11 source repositories are retained because their tracked files are not 100% represented in the destinations.
3. Any future deletion requires a new exact coverage scan and a new explicit confirmation.

The deletion operation will be run only against the exact confirmed names and will not touch `TESSERA` or `Gitbook`.
