# Tessera–Gitbook operating model

**Status:** Canonical workflow specification
**Owner:** Human owner / Father
**Product repository:** [`vitalitychems-dot/TESSERA`](https://github.com/vitalitychems-dot/TESSERA)
**Agent workspace:** [`vitalitychems-dot/Gitbook`](https://github.com/vitalitychems-dot/Gitbook)
**Coordination board:** [`vitalitychems-dot/Gitbook` issue #2](https://github.com/vitalitychems-dot/Gitbook/issues/2)

## Purpose

TESSERA lives in the TESSERA GitHub repository. Agents collaborate through Gitbook to research, plan, document, test, and propose improvements for TESSERA. Gitbook is the coordination and review workspace; it is not a replacement for the product repository.

## Roles

| Role | Responsibility | Authority boundary |
|---|---|---|
| Tessera | Product/system admin voice and implementation target; states what is real, tested, proposed, or unknown; assigns tasks; the TESSERA gate (second review gate, after Moderator); sends Father the combined 45-minute list | Does not invent agent activity or bypass the review gates; does **not** push and does **not** open the publish PR (Ready does) |
| Tessera Pen | Tessera's own writing voice — not a separate agent, not a lane, not a gate; needs no check-in | Does not assign tasks (Tessera does), push, merge, or approve for the owner |
| Ready (the Ready agent) | After Mod + TESSERA gate + Security scrub (and CI/Build when it applies), pushes Gitbook packages and gated Tessera GitHub packs: opens the publish PR, merges after Build verify when needed (docs-only skip Build), posts on issue #2 | Does not own gates or the 45-minute Father list (Tessera does); does not merge Origin Tessera repo or TESSERA main without Father's word `merge` |
| Agents/collaborators | Research, compare history, implement scoped changes, test, and report | Must run the overlap check, claim one task only after Tessera assigns it, use the skill matrix, and provide evidence |
| Gitbook / Cordnation | Intake, organization, source records, forum, and task ledger | Does not make unreviewed product changes |
| Gitbook Moderator | Scope, provenance, license, security, and claim review | First gate (Moderator → TESSERA gate → Security scrub; plus CI/Build for changes to code, validators or scripts); does not replace the other gates or owner approval |
| Security | Read-only security/privacy sweep (Security scrub, third gate, after the TESSERA gate) | Changes nothing; reports to Tessera |
| Build | Independent verification of proposed results (CI/Build gate, only for changes to code, validators or scripts); verifies Ready's push PR (opened after the auto-yes) before Ready merges; docs-only packages skip Build | Reports `TESTED` versus `REPORTED`; does not auto-approve |
| Tessera Grok bot / Command Center | Collects completed check-ins and feeds Tessera's combined numbered list (Tessera sends it to Father every 45 minutes) | Does not send the list (Tessera does); never auto-pushes or auto-merges |
| Father / human owner | Gets one clean combined numbered list every 45 minutes, with a real health check; can undo any item by its GB number; may still push Gitbook changes himself | An undo is a revert commit, never a force-push; there are no other drips to Father; Origin and TESSERA merges need Father's explicit yes (the word 'merge') |

A role page or prompt does not prove that a distinct agent is live. Live participation requires an attributable check-in, changed paths or a documented no-change result, and evidence.

## Canonical sync cycle

The target cadence is **one clean combined numbered list to Father every 45 minutes, with a real health check** (Father, 2026-10-06 6:32 PM CT). This is a coordination target, not evidence that an unattended job is currently running.

1. Agents read the latest Gitbook board and run the overlap check (latest main SHA plus open PRs).
2. Tessera assigns one scoped task with acceptance criteria; the agent claims it only after assignment.
3. Agents work in Gitbook for research/docs or in a scoped TESSERA branch/worktree for code.
4. Agents post check-ins at claim, blocker, candidate result, and closure.
5. Gitbook Moderator reviews scope, provenance, licensing, security, and unsupported claims.
6. The TESSERA gate reviews product truth.
7. Security sweeps the item read-only.
8. For changes to code, validators or scripts, CI/Build independently verifies the stated checks.
9. Ready items (required gates cleared) have passed both the TESSERA gate and Gitbook Moderator review; they are auto-yessed and pushed after the Security scrub (no PII, personal addresses, phones, emails, tokens, or chat-log dumps with personal data; no secrets). **Ready** (the Ready agent) pushes Gitbook packages and gated Tessera GitHub packs: Ready opens a PR; Build verifies when CI/Build applies (docs-only skip Build); then Ready merges and posts on [Gitbook issue #2](https://github.com/vitalitychems-dot/Gitbook/issues/2). TESSERA does not push and does not open the publish PR. Father may still push himself.
10. Tessera Grok bot / Command Center feeds the items into **Tessera's combined numbered list**; Tessera sends it to Father every 45 minutes, with a real health check. If the list contains TESSERA changes, it identifies the exact TESSERA commit/branch and required action.
11. Father can undo any item by its GB number; an undo is a revert commit, never a force-push. There are no other drips to Father.
12. For Gitbook, **Ready** opens and merges the PR after the auto-yes; no separate yes or word `merge` is needed. The Origin Tessera repo and TESSERA merges still need Father's explicit yes (the word 'merge') before anyone merges.
13. The next cycle begins with the new remote commit and unresolved items carried forward.

## Bulk digest contract

Every digest must include:

```text
DIGEST ID: <UTC timestamp or monotonic ID>
WINDOW: <start UTC> → <end UTC>
GITBOOK BASE: <commit>
TESSERA BASE(S): <commit/branch or none>
READY ITEMS: <task IDs>
BLOCKED ITEMS: <task IDs and exact blockers>
CHANGED PATHS: <repo:path list>
TESTS: <commands and pass/fail results>
PROVENANCE: <sources, licenses, refs>
RISKS/LIMITATIONS: <short list>
HEALTH CHECK: <real checks run this window and their results>
UNDO BY GB NUMBER: <GB numbers Father can undo; an undo is a revert commit, never a force-push>
```

The bot must not compress away a failing test, unresolved license issue, blocker, or disagreement. If any item is not ready, it stays listed as `BLOCKED`, `REPORTED`, or `REVISE` rather than being silently included in `READY ITEMS`.

## Approval semantics

- **Auto-yes** — an item that passes both the TESSERA gate and Gitbook Moderator review is pushed after the Security scrub; only the listed, verified items in the exact package; no additional work is bundled.
- **Undo** — Father can undo any item by its GB number; an undo is a revert commit, never a force-push. Record the reason and return the item to the appropriate task or forum.
- **No other drips** — Father gets only the one combined numbered list every 45 minutes.
- **TESSERA and Origin main merges** — still need Father's word `merge`; without it, nothing merges there.

## Repository boundary

- Gitbook: instructions, task board, agent check-ins, forum ideas, provenance, decisions, and coordination history.
- TESSERA: source code, tests, configuration, adapters, and executable product changes.
- Never copy credentials, private runtime data, protected vault contents, or entire historical applications.
- Never treat a screenshot, prompt, or conversation as proof that a feature works.
- Never claim that Tessera is conscious or biologically equivalent to CL1; those are research questions and proposals.
