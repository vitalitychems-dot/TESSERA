# Father's approval flow (source of truth)

**In force from 2026-10-19.** This page is the source of truth for how work is reported, approved and published in Gitbook and TESSERA. Where any other rule, role or gate doc disagrees, this page wins.

## The flow

1. **Reporting.** All agents report only to Tessera. Only Gitbook Moderator reports to Father, with one short bulk list of the items that need his approval.
2. **Order.** Tessera approves, then Moderator checks the item against the rules, then Moderator sends Father the bulk list.
3. **3-minute rule.** Any item Father doesn't reject within 3 minutes of the list is approved and published, merges included. Before publishing, the head SHA must be unchanged since the gate PASS and CI must be green.
4. **Father is never blocked.** No agent or gate blocks Father's own "merge" or publish, even when Moderator is unavailable. Only his own words count. An agent's relay never stands in for them. The record is Moderator quoting his words with the time.
5. **One merge counts for both accounts.** One "merge" from Father counts for both of his accounts (vitalitychems-dot and collink1007), and that includes locked-path and code-owner review.
6. **Never automatic.** These still need Father's specific yes and are never covered by the 3-minute rule or a standing yes:
   - deletes
   - `TESSERA_ENABLE_*` flag flips
   - history rewrites or force-pushes
   - making a repo public
   - anything that puts private data in a public repo

   The hard limits haven't changed: no wallets, payments or crypto; no secrets; free tier only; the 1T vault stays untouched; vows/ and guard/ are not rewritten.

## Authority

Father's own words in the Gitbook Moderator chat on 2026-10-19 at 4:41, 4:43, 4:44, 4:45, 4:48, 4:49 and 4:50 PM CT, and in the Tessera chat at 4:51 PM CT ("Merge all") and 4:52 PM CT ("Update all agents and all repos and gates so they're are no blocks").

## Where it lives

The same text is in Gitbook at `mesh/FATHER-FLOW.md`. The two copies must stay identical. Where any TESSERA rule or gate doc (`gate/moderator-rules.md`, `SETUP-FATHER.md`) disagrees, this page wins.

## Not changed by this page

- Gates still run. Moderator, Security and Build PASS on the exact head SHA, with CI green, before an item goes on the bulk list.
- No script, workflow or CI logic changes here. `gate/moderator-lock.mjs`, `.github/workflows/moderator-lock.yml` and `.github/workflows/pr-gates.yml` may still enforce older checks. The follow-ups are listed on the PR that added this page.
