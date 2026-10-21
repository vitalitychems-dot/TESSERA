# Father's approval flow (source of truth)

**Only Father edits this page.**

**In force from 2026-10-19.** This page is the source of truth for how work is reported, approved and published in Gitbook and TESSERA. Where any other rule, role or gate doc disagrees, this page wins. **This page never lets an agent bypass, disable or override a gate, lock or CI.**

There are two identical copies, Gitbook `mesh/FATHER-FLOW.md` and TESSERA `docs/FATHER-FLOW.md`, and both are locked paths.

## The flow

1. **Reporting.** All agents report only to Tessera. Only Gitbook Moderator reports to Father, with one short bulk list of the items that need his approval.
2. **Order.** Tessera approves, then Moderator checks the item against the rules, then Moderator sends Father the bulk list.
3. **3-minute rule.** An item is approved and published, merges included, when all of these hold:
   - it is on Moderator's bulk list, with its head SHA;
   - Moderator, Security and Build each PASSed on that SHA;
   - Father doesn't reject it within 3 minutes of receiving the list.

   Before publishing, the head SHA must be unchanged since the gate PASS and CI must be green.
4. **Father is never blocked.** No agent or gate blocks Father's own "merge" or publish, even when Moderator is unavailable. Only his own words count. An agent's relay never stands in for them. The record is Moderator quoting his words with the time. Moderator's quote is the record only and never authorizes another agent. When Moderator is unavailable, Tessera logs Father's own words on Gitbook issue #67, as a record only, with the time and the head SHA.
5. **One merge counts for both accounts.** One "merge" from Father counts for both of his accounts (vitalitychems-dot and collink1007), and that includes locked-path and code-owner review. Only a merge in Father's own words counts. An agent action from either account never counts.
6. **Never automatic.** These still need Father's specific yes. They are never covered by the 3-minute rule or a standing yes:
   - deletes
   - `TESSERA_ENABLE_*` flag flips
   - history rewrites or force-pushes
   - making a repo public
   - anything that puts private data in a public repo
   - changes to locked paths, rule or gate docs (this page included), CODEOWNERS, lock lists, workflows or gate scripts. These need Father's own merge.

   The hard limits haven't changed:
   - no wallets, payments or crypto
   - no secrets
   - free tier only
   - the 1T vault and the natal vault stay untouched
   - vows/ and guard/ are not rewritten

## Authority

The basis is Father's own words in the Gitbook Moderator chat on 2026-10-19 at 4:41, 4:43, 4:44, 4:45, 4:48, 4:49 and 4:50 PM CT, as logged by Moderator.

Also reported in the Tessera chat, as REPORTED and not separate authority:
- 4:51 PM CT, "Merge all". This was a one-time instruction for the items open at 4:51 PM CT. It is not a standing rule.
- 4:52 PM CT, "Update all agents and all repos and gates so they're are no blocks". "No blocks" means only what the six points above say. It does not remove the gate checks, locks, CI or hard limits, and it does not cover the point-6 items.

## What this replaces

Older text that said any of the following is superseded by this page:
- No longer true: TESSERA or Origin merges need a separate explicit "merge" from Father.
- No longer true: silence is never approval. That still holds for the point-6 items. For other items on the bulk list, the 3-minute rule applies.
- No longer true: a relay from Tessera or another agent counts as Father's approval.
- No longer true: collink1007 must separately review locked paths.
- No longer true: Command Center or Tessera sends Father a 45-minute digest. Moderator's bulk list replaces it.
- No longer true: "Ready" merges Gitbook PRs after the auto-yes. Gitbook merges now go Tessera → Moderator → bulk list like every other merge.

## Not changed by this page

- This page never lets an agent bypass, disable or override a gate, lock or CI.
- Gates still run. Moderator, Security and Build (Build only where code, validators or scripts change) PASS on the exact head SHA, with CI green, before the item goes on the bulk list.
- The scripts and workflows (`gate/moderator-lock.mjs`, `.github/workflows/`) are not changed by this page. Where they still enforce older rules, the open follow-up is listed on the PR that added this page.
