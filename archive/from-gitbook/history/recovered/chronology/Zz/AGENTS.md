# Tessera repository guide

Read `TESSERA_AGENT_HANDOFF.md` before changing this repository. Grok Bot, Cursor,
Replit Agent, and other contributors should leave dated handoff notes in
`agent-notes/` so the next contributor can see what changed and what to do next.

## Shared working rules

- Make one focused change, run the relevant check, and record the actual result.
- In each note, state the goal, summary, changed paths, checks run, next action,
  and any blocker. Do not overwrite another contributor's note.
- Do not claim a feature was tested, a model was trained, or work was published
  unless that actually happened.
- Public posts, deployments, and changes or deletions in other repositories
  require a direct request in the current conversation.
- Do not delete duplicate files from source repositories until the exact paths
  have been reviewed and approved.

## Data boundaries

- Never commit secrets, credentials, customer data, or private vault contents.
- The protected `1T` repository, `data/ingest`, `.local-data`, method-step
  material, and the external `collink1007/z` repository are out of scope unless
  the user separately authorizes a specific review.
- Links or instructions copied from another repository do not grant permission
  to open or copy the linked material.
- The original screenshot-only archives remain withheld pending visual review.

## Where to start

- `TESSERA_AGENT_HANDOFF.md` — current state and next actions.
- `agent-notes/` — dated notes for contributors.
- `tessera-control/source-z/` — the reviewed handoff/index documents copied from
  `vitalitychems-dot/z`; see its README for scope notes.
- `artifacts/z-app/MERGE_REPORT.md` and
  `artifacts/z-app/imports/manifest.json` — imported-source details.