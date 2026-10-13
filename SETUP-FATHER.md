# SETUP-FATHER: steps only Father can do

Why: every agent pushes and comments as `vitalitychems-dot`, so CODEOWNERS reviews, `FATHER APPROVED` comments and PASS comments can all be forged (Moderator and Security, Gitbook #71). `moderator-lock` therefore **fails closed** until the steps below are done. Agents must not do any of them.

## 1. Separate Father from the agents
1. Create a **second, Father-only GitHub account** (for example `collin-keane`). It becomes the only admin and CODEOWNER. Enable 2FA on it.
2. Repo **Settings → Secrets and variables → Actions → Variables** on TESSERA and Gitbook:
   - `FATHERLOGIN` = that account's login (preferred; no underscore — phone-friendly). Falls back to `FATHER_LOGIN` if unset. It must be different from `vitalitychems-dot`; otherwise the lock stays closed. Comparison is case-insensitive (both sides lowercased).
   - `AGENT_LOGINS` = `vitalitychems-dot` (comma-separated if there are more).
3. Change `@vitalitychems-dot` to the Father-only login in `.github/CODEOWNERS` (both repos), from the Father account.
4. Downgrade `vitalitychems-dot` to **Write** (not Admin) on both repos, or move the agents to the Apps in step 2 and revoke the PAT on the box.
5. **Keep the owner token off the box.** Don't run `gh auth login` as the Father account on the shared box. Revoke any owner PAT already stored there (Settings → Developer settings → Tokens).

## 2. Create 3 GitHub Apps (one identity per gate)
For each of **Tessera Moderator**, **Tessera Security** and **Tessera Build** (Settings → Developer settings → GitHub Apps → New):
- Homepage: the repo URL. Webhook: off.
- Permissions: **Checks: Read & write**, Contents: Read, Pull requests: Read, Metadata: Read. Nothing else.
- Install it on **TESSERA and Gitbook only**.
- Note the **App ID** and set repo variables `MODERATOR_APP_ID`, `SECURITY_APP_ID`, `BUILD_APP_ID`.
- Generate a private key and give each key **only to that gate's runner/agent**, never to the shared box. The gate posts its PASS/FAIL as a **check run** on the head SHA. PASS comments are ignored.

## 3. Branch protection on `main` (both repos), Settings → Rules → Rulesets
Draft. Father applies it; agents do not.
- Target: default branch. Enforcement: Active. **Bypass list: empty** (no admin bypass).
- Require a pull request before merging:
  - required approvals: 1;
  - **Require review from Code Owners**: on;
  - **Dismiss stale approvals when new commits are pushed**: on;
  - **Require approval of the most recent reviewable push**: on.
- Require status checks to pass, with **Require branches to be up to date** on:
  - `moderator-lock / collect` (GitHub Actions);
  - the check names posted by the **Tessera Moderator**, **Tessera Security** and **Tessera Build** apps, each pinned to its app as the "expected source";
  - TESSERA: `CI / validate`.
- Block force pushes. Restrict deletions. Require linear history.
- Optional: merge queue with a group size of 1 (Rick #14).

## 4. Kill switch
`gate/MERGE_BOT_ENABLED` (locked path) holds `0`. A merge bot may merge only when it reads exactly `1`; a missing file or any other value means off. Only Father changes it, through a code-owner-reviewed PR.

## 5. Optional
- `GITBOOK_LOG_TOKEN` secret on TESSERA (a fine-grained token, Gitbook only, Issues: write) lets `meta-loop` mirror to Gitbook #67.
- `TESSERA_WORKER=1` turns on the in-runner fixer. `TESSERA_MESH_RUNNERS=1` allows opt-in mesh runners. Both default to 0.
- Worker PRs opened with `GITHUB_TOKEN` don't trigger `pull_request` workflows (a GitHub rule). For gates to run on them, the worker must push with the **Build App** token. Until then those PRs stay unchecked and can't merge (fail closed).
