# Moderator lock

The check is `.github/workflows/moderator-lock.yml`. It runs `gate/moderator-lock.mjs` from a checkout of the pull request base SHA (`ref: github.event.pull_request.base.sha`, `persist-credentials: false`). The trigger stays `pull_request_target`. A pull request cannot change the lock that runs on itself.

No Father GitHub login exists today, and no GitHub login's review counts as Father's approval. Father's approvals are routed through TESSERA and Command Center (per the mesh rules); the exact approval method for locked changes is pending Father's confirmation.

`@vitalitychems-dot` in `.github/CODEOWNERS` is not Father's approval. (owner login: pending Father's confirmation)

Repo variables `FATHERLOGIN` and `FATHER_LOGIN` are left in place and are not read. `AGENT_LOGINS` is not read. No login allowlist unlocks a locked path.

Ownership lines kept exactly as written:

- `gate/moderator-rules.md`: Only Father edits this file.
- `docs/FATHER-FLOW.md`: **Only Father edits this page.**

## Advisory

`gh api repos/vitalitychems-dot/TESSERA/rulesets` (read-only) returned HTTP 200 and `[]` on 2026-10-22. That is not a 403. No ruleset requires `moderator-lock`, so the check is advisory. This change does not edit branch protection or rulesets. A non-author review plus a TESSERA merge is a process rule.

GitHub rulesets are able to require a status check. None does on this repository today. Setup steps in `SETUP-FATHER.md` are optional hardening. The lock stays advisory and red on locked paths either way.

## Fail closed

Each lock step and each gate step that pipes into `tee` sets `shell: bash`. That shell is `bash -eo pipefail`, so a non-zero `node` exit fails the step even when `tee` exits 0. The same step then rejects a decision unless it is one JSON object whose `pass` is boolean `true`:

`jq -s -e 'length == 1 and (.[0] | type == "object" and .pass == true)'`

That rejects `pass: false`, the JSON string `"true"`, more than one JSON value, empty output, and non-JSON output.

Locked-path matching uses both `filename` and `previous_filename`. Renaming the workflow, `gate/locked-paths.txt`, or CODEOWNERS out of a locked path still fails.

A null or empty files list, a null or empty locked-pattern list, a top-level `[]`, other malformed input, and any locked-pattern entry that is not a non-empty string all fail closed.
