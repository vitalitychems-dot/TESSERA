# Moderator rules (locked)

Source: Gitbook Moderator review on Gitbook #71 (6:03 AM CT, 2026-10-13). Owner: @vitalitychems-dot via CODEOWNERS.
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

## Identity (blocking flaw from #71)
Every agent pushes as `vitalitychems-dot`. So:
- A `FATHER APPROVED <sha>` **comment never counts**: any agent can post it.
- A review only counts when it comes from `FATHER_LOGIN`, an account that is **not** the agent account, and is APPROVED on the head SHA.
- A gate PASS only counts as a **check run from the gate's own GitHub App** (repo variables `MODERATOR_APP_ID`, `SECURITY_APP_ID`, `BUILD_APP_ID`). PASS comments never count.
- If any of these isn't configured, the check **fails closed**.

## Tests (Moderator's list → `gate/moderator-lock.test.mjs`)
| Fake PR | Expected |
|---|---|
| touches a locked path | FAIL |
| approves itself (gate app is the author) | FAIL |
| stale SHA (PASS on an older head) | FAIL |
| claims a win from synthetic data only | FAIL |
| `FATHER APPROVED` comment / review from the shared account | FAIL |
| ENABLE flip, flag ≠ 0, secret, delete, wallet path, over the size cap | FAIL |
| clean docs/code change | PASS (lock) |
