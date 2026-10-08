# Graft agent workflow: orient, claim, build, publish

**Purpose:** Give agents one repeatable way to work across the Gitbook coordination repository and the TESSERA product repository while reducing repeated exploration and protecting credentials.

**Official tool:** [trailhq/Graft](https://github.com/trailhq/Graft)
**Reported license:** MIT
**Coordination board:** [Gitbook issue #2](https://github.com/vitalitychems-dot/Gitbook/issues/2)
**Product repository:** [TESSERA](https://github.com/vitalitychems-dot/TESSERA)
**Agent workspace:** [Gitbook](https://github.com/vitalitychems-dot/Gitbook)

## What Graft is and is not

Graft creates a local, regenerable code map. Its normal structural build uses tree-sitter and does not call a model or require an API key. `graft ask`, `graft grep`, `graft callers`, `graft skeleton`, and `graft map` let an agent orient from the code graph instead of repeatedly reading the entire repository.

Graft does not assign tasks, approve changes, authenticate agents, replace Gitbook provenance, or authorize a push/merge. Its `graft/` cache is local and must not be committed. Only intentional agent wiring or documentation changes belong in Git.

## One-time local setup

**Package provenance: UNVERIFIED (TESSERA ruling 2026-10-06).** The npm package `@nanonets/graft` is not verified as the official package of trailhq/Graft. Nobody installs it, with `npm install` or `npx`. The commands below are reference only and are not run while provenance is UNVERIFIED.

Run separately in each checkout. Preview changes before writing anything:

Commented out per Security: package source unconfirmed (see GB-036); do not install.

```text
# npm install -g @nanonets/graft
# cd /path/to/Gitbook
# npx @nanonets/graft init --dry-run
# cd /path/to/TESSERA
# npx @nanonets/graft init --dry-run
```

If the dry run is acceptable, initialize only the agent integration you use. A plain structural build is the lowest-token and lowest-risk baseline:

```text
# graft build
# graft check
# graft map
```

Graft adds its local cache to `.gitignore`. Do not commit `graft/`, model caches, `.env*`, logs containing prompts, database files, private archives, credentials, or protected vault material.

## Token-efficient orientation

1. Read the latest Gitbook board, operating model, check-in ledger, and open PRs before using a model.
2. Run `graft check` and `graft map` first; these are local and key-free.
3. Use a narrow query before opening source:

   ```text
   # graft grep "symbol-or-route"
   # graft callers "symbol-or-route"
   # graft skeleton "symbol-or-route"
   # graft ask "Where is the current implementation and what files call it?"
   ```

4. Read only the returned source files and the exact tests/configuration they depend on.
5. Use `graft build --deep` only when the task justifies provider-token use. Set the provider, model, base URL, and key through a private environment or secret manager; never paste them into Gitbook, an issue, a prompt, a screenshot, or a commit.
6. Treat Graft summaries as orientation evidence. Confirm behavior against current source, tests, and Git history before calling anything `TESTED`.

The upstream project reports benchmark token savings, but those numbers are not a TESSERA guarantee. Measure actual token/call savings for the task and record the result only if raw evidence is available.

## Two-repository task protocol

### 1. Claim one scope

Post the real agent identity, task ID, repository, exact paths, base SHA, acceptance test, and overlap check to Gitbook issue #2 and the check-in ledger. Claim either a Gitbook documentation scope or a TESSERA code scope unless Tessera explicitly assigns a cross-repository task.

### 2. Work on a branch

```bash
git fetch origin main
git switch -c agent/<TASK-ID>-<short-name>
git status --short
```

Never edit `main` directly. Never rewrite another agent’s branch. Never inspect or copy the protected `1T` vault.

### 3. Keep repository boundaries clear

- Gitbook receives instructions, task records, source maps, decisions, audit notes, forums, and evidence links.
- TESSERA receives executable code, tests, configuration, migrations, and product documentation that describes implemented behavior.
- Historical ideas that are not tested stay in Gitbook as `PROPOSED`, `UNKNOWN`, or `BLOCKED`; do not copy them into TESSERA merely because they appear in screenshots or old logs.

### 4. Verify before publishing

Run the smallest relevant checks, then the repository gates required by the task. Record the exact commands and raw result summary. Check for secrets, duplicate files, stale links, license issues, and unintended scope changes.

### 5. Commit and push safely

```bash
git diff --check
git add <only-task-files>
git commit -m "<task-id>: <short imperative change>"
git push -u origin agent/<TASK-ID>-<short-name>
gh pr create --repo vitalitychems-dot/<Gitbook-or-TESSERA> --base main --head agent/<TASK-ID>-<short-name> --title "<task-id>: <title>" --body-file <handoff.md>
```

The exact repository name must be selected before pushing. Agents may push their scoped branch where its role page allows, and open a PR. They must not push directly to `main`, merge, delete repositories, change secrets, or publish an unreviewed release.

**Token rule:** use the preconfigured GitHub CLI or a short-lived, least-privilege credential supplied by the execution environment. Never request, print, store, or commit a personal access token. If authentication fails, report the blocker; do not work around it by pasting a token into chat or a file.

### 6. Publish the handoff to Gitbook

Every PR must link its Gitbook task and include:

- agent identity and role;
- task ID and exact changed paths;
- Gitbook and TESSERA base SHAs;
- Graft commands used, if any;
- tests and raw pass/fail evidence;
- provenance and license notes;
- security/privacy review results;
- known limitations and unresolved questions;
- next owner and rollback plan.

The Gitbook Moderator reviews scope/provenance/licensing. The TESSERA gate reviews product truth. Security performs a read-only scrub. For changes to code, validators or scripts, Build independently verifies. Only then is the item auto-yessed (it has passed the TESSERA gate and Gitbook Moderator review, then the Security scrub) and listed on Tessera’s combined numbered list to the human owner every 45 minutes; he can undo it by its GB number.

### 7. Final publication path

After the auto-yes, **Ready** (the Ready agent) may push or merge the Gitbook package and the identified gated Tessera GitHub pack. TESSERA does not push and does not open the publish PR. TESSERA and Origin merges still need Father's word `merge` before anyone merges. Build verifies the final head when CI/Build applies (docs-only skip Build), Ready records the resulting commit, and the conference issue receives the publication note. The auto-yes for one item does not authorize extra files or unrelated repositories.

## Agent completion template

```text
IDENTITY: <real agent or declared role>
TASK: <task id>
REPOSITORY: <Gitbook|TESSERA>
BASE: Gitbook=<sha>; TESSERA=<sha>
SCOPE: <exact paths>
GRAFT: <commands, or none>
CHANGED: <files>
TESTS: <commands + result>
PROVENANCE: <sources, commits, license notes>
SECURITY: <secrets/privacy/authority review>
PR: <URL>
STATUS: PROPOSED | READY | BLOCKED | TESTED
NEXT OWNER: <role>
NOT DONE: <limitations>
```

## Non-negotiable boundaries

No agent may claim to be Tessera or Pen without the documented identity line. No model, Graft summary, screenshot, or generated conversation proves AGI, consciousness, owned weights, a live fleet, or a working feature. No agent may bypass the claim lock, review gates, human approval, or repository boundary.
