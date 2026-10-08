---
status: published
note: Status: published 2026-10-05 (commit 98fa6c7) — approved by Gitbook Moderator and Father
---

# How to submit (intake)

Agents submit finished or draft documentation to **Gitbook / Cordnation** for filing. Do not push to GitHub or open PRs yourself (the Grok lane's feature-branch exception is in [Flow & standing rules](../mesh/flow.md), Push authority (3)), and do not ask Command Center to push: it never pushes GitBook. Items move only through the required gates and the auto-yes below.

## Required fields for every submission

| Field | Requirement |
|-------|-------------|
| **Title** | Clear, human-readable title |
| **Author lane** | Submitting agent / lane name |
| **Date (CT)** | Date in America/Chicago (Central Time) |
| **Source** | Where the content came from (agent, repo path, prior note, etc.) |
| **License** | License if known; otherwise `TBD` |
| **Summary** | Short description of what the item is |
| **Links** | Relevant links (repo paths, issues, prior drafts) if any |

## After you submit

1. Gitbook / Cordnation files the item in the [intake log](log.md) with status `draft` (or moves it to `in review` when handing off).
2. Items go through the gates in order: **Gitbook Moderator** (see [Moderator handoff](../review/moderator-handoff.md)) → **TESSERA gate** → **Security** scrub (read-only) → **CI/Build** (independent verification; only for changes to code, validators or scripts). Per-gate states are in [Status definitions](status-definitions.md).
3. After the required gates clear, Gitbook / Cordnation stages the item as **Ready**. Having passed the TESSERA gate and Gitbook Moderator review, then the Security scrub, it is auto-yessed.
4. After the auto-yes, **Ready** (the Ready agent) pushes the package: Ready opens a PR, Build verifies it when CI/Build applies (docs-only packages skip Build), then Ready merges and posts on Gitbook issue #2. Father may still push himself on his authenticated connection. Replit is outside that path. For Gitbook, Ready opens and merges the PR after the auto-yes; no separate yes or word `merge` is needed. The Origin Tessera repo and TESSERA merges still need Father's explicit yes (the word 'merge') before anyone merges.
5. Command Center feeds the item as its own numbered item into Tessera's combined list to Father (every 45 minutes, with a real health check). Father can undo any item by its GB number; an undo is a revert commit, never a force-push.

## Standing constraints

- No secrets in submissions
- No crypto / money / store work
- No uncensoring tools or surveillance of real people
- Do not change `TESSERA_ENABLE_*` (stay `0`)
- Single coordination board: [`vitalitychems-dot/Gitbook` issue **#2**](https://github.com/vitalitychems-dot/Gitbook/issues/2)

## Status values

See [Status definitions](status-definitions.md).
