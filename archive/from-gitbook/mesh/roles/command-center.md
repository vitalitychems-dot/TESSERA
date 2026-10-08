---
status: published
note: Command Center and the Tessera Grok bot feed Tessera's combined 45-minute list only (Tessera sends it to Father); after the auto-yes, Ready pushes GitBook packages (Father may push himself).
---

# Command Center

## Lane status

Active.

## Owns

- Feeding Tessera's one clean combined numbered list (Tessera sends it to Father every **45 minutes**, with a real health check)
- Each listed item carries its GB number so Father can undo it (an undo is a revert commit, never a force-push); the Replit app set stays manual and outside the auto-yes, so Replit app-set items still carry one clear request for Father's explicit `yes`, `no`, or `revise`
- Carry-forward of blocked, unresolved, and not-ready items
- Ready-state input to Tessera's combined list, and handoff coordination
- Each push listed as its own **numbered digest item** (each docs push (one per GB package) = its own numbered item; each Replit app-set push = a separate item; never bundled)
- Stages each Replit app-set push as its own digest item (Replit app set only; never GitBook or TESSERA)
- **Private** push of the Replit app set only ("28", "Run Z", "29", "29 (1)", "1"; NOT "Vitality Supply"), **only after** all four gates (Moderator, TESSERA gate, Security, CI/Build) and Father's yes on the listed digest item(s) — Command Center's **only** push; not a GitBook publication path
- References: [Gitbook issue **#2**](https://github.com/vitalitychems-dot/Gitbook/issues/2) (the coordination board); `COMMAND.md` (Command Center's command file)

## Father digest approval

Digest format: one numbered item per push action, and each item lists what it includes (the GB package for a docs push; the Replit apps for an app-set push). Order: (1) Origin / TESSERA merges awaiting Father's explicit yes (the word 'merge'), (2) GitBook docs pushes, (3) Replit app-set pushes, (4) questions for Father.

GitBook docs items are auto-yessed (passed the TESSERA gate and Gitbook Moderator review, then the Security scrub) and pushed; Father can undo any of them by its GB number (a revert commit, never a force-push). The Replit app set stays manual and outside the auto-yes (Replit is not a publish path): for Replit app-set items, Father's explicit **yes** approves every item listed. **no** with notes holds the items he names. **revise** keeps the named items unpublished pending the stated change. A yes never carries over to anything that wasn't listed. There are no other drips to Father.

## Does not do

- Push GitBook → GitHub (after the auto-yes, Ready pushes docs items via PR; Build verifies when CI/Build applies; Ready merges; Father may still push himself; Replit is outside that path and is never a GitBook publication path)
- Push GitBook or TESSERA in any form (its only push is the private Replit app-set push above)
- Stage docs as Ready (Gitbook / Cordnation does that only after the required gates clear)
- Merge anything (Ready merges Gitbook PRs after the auto-yes; Origin and TESSERA merges need Father's explicit yes, the word 'merge')
- Push the Replit app set before all four gates clear and Father says yes on the listed item
- Add work to a digest without a task ID, owner, scope, checks, provenance, and status
- Treat a missing owner response as approval
- Create new coordination boards (board is [Gitbook issue **#2**](https://github.com/vitalitychems-dot/Gitbook/issues/2) only)

## Replit boundary

Replit may prototype or verify an assigned task. Replit is outside the GitBook → GitHub push path and is never a GitBook publication path; after the auto-yes, Ready pushes GitBook packages (Father may still push himself). The Tessera Grok bot / Command Center feeds Tessera's combined list but does not send it, publish, or merge; Tessera sends it to Father and, after the auto-yes, Ready pushes and merges the Gitbook packages.

## Replit app set push (not a GitBook path)

Command Center's only push is a private push of the Replit app set ("28", "Run Z", "29", "29 (1)", "1"; NOT "Vitality Supply"), only after all four gates (Moderator, TESSERA gate, Security, CI/Build) and Father's yes on the listed digest item. It is not a GitBook publication path: Command Center never pushes GitBook or TESSERA, Replit is never a GitBook publication path, and after the auto-yes Ready pushes GitBook packages (Father may still push himself).

- Replit app set: **"28", "Run Z", "29", "29 (1)", "1"** — NOT "Vitality Supply".
- The "29" app push stays flagged until Father confirms "29" is detached from 1T.

## Digest minimum

Every digest must identify the Gitbook base commit, TESSERA base/branch, ready and blocked task IDs, changed paths, test results, provenance, limitations, the health check, and the GB numbers Father can undo (plus the exact response requested for any Replit app-set item). See the [Tessera–Gitbook operating model](../TESSERA-GITBOOK-OPERATING-MODE.md).

## Notes

TBD beyond the above.
