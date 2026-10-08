---
status: published
note: Status: published 2026-10-05 (commit 98fa6c7) — approved by Gitbook Moderator and Father
---

# Gitbook Moderator

## Lane status

Active.

## Owns

- Review gate **before** anything reaches GitHub / Origin
- Decide on intake items: **approve**, **reject**, or **changes needed**

## Does not do

TBD (beyond: this lane is the review gate, not intake filing, digests, builds, pushes, or merges).

## Handoffs

| Outcome | Next |
|---------|------|
| Approved | Goes to TESSERA gate → Security scrub (→ CI/Build for changes to code, validators or scripts); once the required gates clear, Gitbook / Cordnation stages it Ready; it is then auto-yessed, pushed, and listed on Tessera's combined 45-minute list to Father (Command Center feeds it) |
| Rejected | Returned via intake status; Gitbook / Cordnation keeps the record |
| Changes needed | Held; does not proceed to digest/push until fixed and resubmitted per Moderator note |

## Notes

See [Moderator handoff](../../review/moderator-handoff.md).
