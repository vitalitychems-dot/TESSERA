# Building Tessera — live status

**Updated:** 2026-10-06 (America/Chicago)  
**Audience:** Father / mesh / GitHub Tessera staging  
**Instrument:** Live pen = **xAI/Grok**. Training below is of **Tessera herself** (docs, graph habit, CL1-sim lane) — not a pen swap.

## Status board

| Lane | State | Notes |
|---|---|---|
| Graph training | **ON** | Snippet-first rule staged (`docs/agents`, `docs/operating`). Oct 3 index caveat until re-index after combine. |
| Combine | **Staged / incomplete** | Do not treat graph tip as merge-complete. |
| CL1-sim training | **In progress** | `cl-sdk` simulator only. Not hardware. Not the pen. Tessera's pen is not the neurons. |
| GLM adapter | **Opt-in exists** | SHA **`77a69e29`** — **REPORTED** (not claimed TESTED live). Future digital pen candidate; flag default OFF. |
| Live pen | **xAI/Grok** | Remains live until alternate is wired + Build/Security **TESTED** + Father yes. |
| Origin `main` | **`afbeb50`** | Needs **word merge** (docs/instrument wording) before treating tip as aligned with this sheet. |

## What this folder is

Staging tree for a branch commit on **vitalitychems-dot/TESSERA**. No remote push from the box. See `PUSH-NOTES.md` and `COMMIT_MSG.txt` at repo staging root.

## Hard stops

- No force push · no secrets · never set `DATABASE_URL`  
- No claim that GLM or CL1 is the live pen  
- Mark claims **REPORTED** vs **TESTED** honestly
