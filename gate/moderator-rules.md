# Moderator rules (locked)

> **Updated 2026-10-19:** [Father's approval flow](../docs/FATHER-FLOW.md) is the source of truth for reporting, approvals and merges. Where this page disagrees, that page wins.

Source: Gitbook Moderator review on Gitbook #71 (6:03 AM CT, 2026-10-13). Owner: @vitalitychems-dot via CODEOWNERS. @vitalitychems-dot is not Father's approval. (owner login: pending Father's confirmation)
Only Father edits this file. Tessera and the agents cannot. `gate/moderator-lock.mjs` enforces these rules as code.

1. **Reject the PR** if it:
   - touches a locked path (`gate/locked-paths.txt`): gate rules, gate scripts, `.github/workflows`, CODEOWNERS, branch protection or rulesets, agent prompts, policy files;
   - flips `TESSERA_ENABLE_*`, or adds a flag that doesn't default to 0;
   - adds a secret, deletes data or a repo, or rewrites history;
   - touches wallet, payment or 1T paths;
   - works in a repo other than TESSERA or Gitbook.
2. **Author ≠ approver.** The author is the PR opener plus everyone named in its commits. A gate can't pass its own PR.
3. **Proof:** before/after numbers on fixtures the author didn't build. Wins backed only by synthetic data don't count. Any score drop beyond noise is a FAIL.
4. A claim that can't be verified is marked **REPORTED** and is never evidence for a PASS.
5. A PASS is tied to the exact head SHA. Any new push makes it stale.
6. **Size cap:** 400 changed lines and 10 files (Father sets these). Anything bigger gets split.
7. Hard limits beat "no human in loop": no wallets or payments, no 1T vault, no deletes, no history rewrites, no ENABLE flips.
8. **Father's approval flow (2026-10-19):** agents report only to Tessera. Tessera approves, then Moderator checks these rules and sends Father one bulk list. Any item on Moderator's bulk list, with its head SHA and Moderator, Security and Build PASS on that SHA, that he doesn't reject within 3 minutes of receiving the list publishes, merges included, if the head SHA is unchanged since the gate PASS and CI is green. Changes to locked paths, rule or gate docs, CODEOWNERS, lock lists, workflows or gate scripts are never covered by the timer and need Father's own merge. Nothing here lets an agent bypass, disable or override a gate, lock or CI. These still need his specific yes: deletes, `TESSERA_ENABLE_*` flips, history rewrites or force-pushes, making a repo public, and private data in a public repo. Full text: [docs/FATHER-FLOW.md](../docs/FATHER-FLOW.md).

## Identity (blocking flaw from #71)
Every agent pushes as `vitalitychems-dot`. So:
- A `FATHER APPROVED <sha>` **comment never counts**: any agent can post it.
- No GitHub login's review counts as Father's approval for this lock, including vitalitychems-dot and collink1007. Father approves through TESSERA (Grok Bot); confirmed in his words to TESSERA on Oct 21, 2026, as relayed by TESSERA. docs/FATHER-FLOW.md governs approval; the lock cannot see Father's own words, so it stays red on locked paths. See [docs/MODERATOR-LOCK.md](../docs/MODERATOR-LOCK.md).
- A gate PASS only counts as a **check run from the gate's own GitHub App** (repo variables `MODERATOR_APP_ID`, `SECURITY_APP_ID`, `BUILD_APP_ID`). PASS comments never count.
- If a gate app id isn't configured, that gate's check **fails closed**. Repo variables `FATHERLOGIN` and `FATHER_LOGIN` are left in place and are not read.

## Tests (Moderator's list → `gate/moderator-lock.test.mjs`)
| Fake PR | Expected |
|---|---|
| touches a locked path | FAIL |
| approves itself (gate app is the author) | FAIL |
| stale SHA (PASS on an older head) | FAIL |
| claims a win from synthetic data only | FAIL |
| `FATHER APPROVED` comment, or an APPROVED review from any GitHub login | FAIL |
| rename of the workflow, the locked-paths list, or CODEOWNERS (`previous_filename`) | FAIL |
| null or empty files, null or empty patterns, `[]`, or a non-string pattern entry | FAIL |
| ENABLE flip, flag ≠ 0, secret, delete, wallet path, over the size cap | FAIL |
| clean docs/code change | PASS (lock) |
