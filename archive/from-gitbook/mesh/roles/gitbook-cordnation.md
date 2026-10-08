---
status: published
note: Status: published 2026-10-05 (commit 98fa6c7) — approved by Gitbook Moderator and Father
---

# Gitbook / Cordnation

## Lane status

Active.

## Owns

- GitBook **intake & organization**
- Files every item with: title, author lane, date (CT), source & license, status (`draft` / `in review` / per-gate states e.g. `Moderator: approved, at Tessera gate` / `approved` / `Ready` / `rejected` / `blocked`)
- Hands ready items to **Gitbook Moderator**
- Stages docs as **Ready** only after the required gates clear (Moderator, TESSERA gate, Security scrub; plus CI/Build for changes to code, validators or scripts); Ready docs are then auto-yessed and pushed by **Ready** (the Ready agent) for GitBook docs packages and gated Tessera GitHub packs
- Keeps the review record

## Does not do

- Moderation (approve / reject / changes needed)
- Digests to Father
- Builds
- Pushes
- Merges
- Flag changes (`TESSERA_ENABLE_*` stay `0`)
- Replit app set staging or push (Command Center's only push, private; not a GitBook path)

## Handoffs

| Ready item | Hand to |
|------------|---------|
| Item ready for review | Gitbook Moderator |
| Docs staged Ready (after the required gates) | Auto-yes → Ready push (PR; Build verifies when CI/Build applies; Ready merges) or Father's own push → Tessera's combined 45-minute list, fed by Command Center (numbered docs-push item; Father can undo it by GB number) |

## Notes

TBD beyond the above.
