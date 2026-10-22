# SETUP-FATHER: steps only Father can do

> **Updated 2026-10-21 Central time:** [Father's approval flow](docs/FATHER-FLOW.md) is the source of truth for reporting, approvals and merges. Where this page disagrees, that page wins. [Moderator lock](docs/MODERATOR-LOCK.md) describes the path lock. No GitHub login's review counts as Father's approval for this lock, including vitalitychems-dot and collink1007. Agents have reported routing through TESSERA and Command Center; Father has not confirmed this. Father's own merge is required for locked changes (docs/FATHER-FLOW.md:27); any other route is pending his confirmation. A TESSERA or other agent message never counts as Father's approval for a locked path. docs/FATHER-FLOW.md governs approval; the lock cannot see Father's own words, so it stays red on locked paths. (owner login: pending Father's confirmation)

Why: every agent pushes and comments as `vitalitychems-dot`, so CODEOWNERS reviews, `FATHER APPROVED` comments and PASS comments can all be forged (Moderator and Security, Gitbook #71). The lock stays **red** on a locked path either way. `@vitalitychems-dot` in CODEOWNERS is not Father's approval.

Repo variables `FATHERLOGIN` and `FATHER_LOGIN` are left in place and are **not read**. `AGENT_LOGINS` is not read. Do not set them for this lock. There is no step below that sets an unread variable.

Every step below is **optional hardening**. Doing it or skipping it does not make a GitHub review unlock a locked path, and does not turn the lock green on a locked path. The check stays advisory until a ruleset requires it. This page does not change branch protection or rulesets. Agents must not apply these steps.

## 1. Separate the shared account from an owner token (optional hardening)
1. (owner login: pending Father's confirmation) Enable 2FA on any account that can administer the repo. Do not treat a GitHub login as Father's approval.
2. `@vitalitychems-dot` in `.github/CODEOWNERS` is not Father's approval. Do not point the lock at a GitHub login.
3. Downgrade `vitalitychems-dot` to **Write** (not Admin) on both repos, or move the agents to the Apps below and revoke the PAT on the box. The lock stays red on locked paths either way.
4. **Keep the owner token off the box.** Don't run `gh auth login` as an owner account on the shared box. Revoke any owner PAT already stored there (Settings → Developer settings → Tokens).

## 2. Create 3 GitHub Apps (one identity per gate) — optional hardening
For each of **Tessera Moderator**, **Tessera Security** and **Tessera Build** (Settings → Developer settings → GitHub Apps → New):
- Homepage: the repo URL. Webhook: off.
- Permissions: **Checks: Read & write**, Contents: Read, Pull requests: Read, Metadata: Read. Nothing else.
- Install it on **TESSERA and Gitbook only**.
- Note the **App ID** and set repo variables `MODERATOR_APP_ID`, `SECURITY_APP_ID`, `BUILD_APP_ID`.
- Generate a private key and give each key **only to that gate's runner/agent**, never to the shared box. The gate posts its PASS/FAIL as a **check run** on the head SHA. PASS comments are ignored.

## 3. Branch protection on `main` (both repos), Settings → Rules → Rulesets
Optional hardening. Draft only. Father applies it; agents do not. On 2026-10-21 Central time, `gh api repos/vitalitychems-dot/TESSERA/rulesets` returned HTTP 200 and `[]`, so no ruleset requires `moderator-lock`. The check is advisory. REPORTED by GitAI: classic branch protection exists on `main`. The required checks are `validate`, `author-check`, `gitleaks`, and `diff-scan`. `moderator-lock` is not required. 0 approvals are needed, and `enforce_admins` is on. A non-author review plus a TESSERA merge is a process rule. This page does not create or edit a ruleset.
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
