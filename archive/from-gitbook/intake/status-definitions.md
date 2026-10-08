---
status: published
note: Status: published 2026-10-05 (commit 98fa6c7) — approved by Gitbook Moderator and Father
---

# Status definitions

Statuses used by Gitbook / Cordnation when filing intake items and tracking the review pipeline:

| Status | Meaning |
|--------|---------|
| `draft` | Filed / received; not yet ready for Moderator, or awaiting readiness checklist |
| `in review` | Handed to Gitbook Moderator; decision pending |
| `Moderator: approved, at Tessera gate` | Moderator approved; next gate is the TESSERA gate. Example of a **per-gate state** |
| `at Security gate` | TESSERA gate cleared; next gate is Security (read-only scrub) |
| `at CI/Build gate` | Security cleared; next gate is CI/Build verify (only for changes to code, validators or scripts) |
| `changes needed` | A gate returned the item for fixes (e.g. Tessera: changes needed); not Ready |
| `IN REVIEW` | Board/ledger operating state: one agent is actively working a HYB task |
| `BLOCKED` / `blocked` | Owner or Tessera hold: a specific dependency, permission, provenance, safety, or product decision is missing; must not proceed to digest/push until resolved. **Who sets it:** only the task's assigned owner (in its own check-in, with the specific blocker) or Tessera (admin). Father can set any status. Gates, the Gitbook Moderator included, return items as `changes needed` and never set BLOCKED. |
| `Ready` | **Required gates cleared** (Moderator, TESSERA gate, Security scrub; plus CI/Build for changes to code, validators or scripts); auto-yessed and pushed by **Ready** (the Ready agent), with no wait for Father's yes (the Replit app set stays manual and outside the auto-yes: its items still wait for Father's explicit yes on the listed item) |
| `approved` | Legacy Moderator-only label; prefer per-gate states and `Ready` for the push path |
| `rejected` | Moderator rejected; stays out of GitHub / Origin until reworked and resubmitted |
| `PROPOSED` | Candidate improvement. Not yet placed on a Father list. |
| `IN LIST` | Pushed, undoable by GB number. |

## Ready and Father's yes

- **Ready** is set by Gitbook / Cordnation (docs) only after the required gates clear (CI/Build only for changes to code, validators or scripts), or by Command Center (Replit app set) only after all four gates clear.
- Cadence (Father, 2026-10-06 6:32 PM CT): an item that passes both the TESSERA gate and Gitbook Moderator review is auto-yessed and pushed after the Security scrub (no PII, personal addresses, phones, emails, tokens, or chat-log dumps with personal data; no secrets) by **Ready** (the Ready agent); changes to code, validators or scripts also need CI/Build first (docs-only skip Build). Father gets one clean combined numbered list every 45 minutes, with a real health check. He can undo any item by its GB number; an undo is a revert commit, never a force-push. There are no other drips to Father. TESSERA merges and Origin main merges still need Father's word `merge`.
- The Replit app set stays manual and outside the auto-yes (Replit is not a publish path). For Replit app-set items, Father's explicit **yes** covers **only the numbered items listed**. A yes never carries over to anything that wasn't listed.
- Ready does **not** by itself mean pushed or merged. The docs push follows the auto-yes (**Ready** opens a PR; Build verifies when CI/Build applies; Father may push himself). For Gitbook, Ready opens and merges the PR after the auto-yes; no separate yes or word `merge` is needed. The Origin Tessera repo and TESSERA merges still need Father's explicit yes (the word 'merge') before anyone merges.

## Notes

- Gitbook / Cordnation keeps the review record and advances per-gate states.
- Only Gitbook Moderator sets Moderator approve / reject / changes-needed outcomes (it never sets BLOCKED).
- Do not use bare `approved` or bare `Ready` as a banner while an item is still inside a gate.
