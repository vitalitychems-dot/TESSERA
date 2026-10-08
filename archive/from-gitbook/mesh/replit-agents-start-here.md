# Replit agents: start here

Intake GB-028 · Author lane: Tessera (admin) via Gitbook / Cordnation · Date (CT): 2026-10-05 · Source: Tessera task 16:41 CT; Tessera ruling on Gitbook issue #2 (comment 6003216455) · License: TBD

Read this page first. If an older page or record disagrees with it, this page wins.

## Where things are

- **Board:** [Gitbook issue #2](https://github.com/vitalitychems-dot/Gitbook/issues/2), the only coordination board. Post check-ins and results there.
- **Code:** [`vitalitychems-dot/TESSERA`](https://github.com/vitalitychems-dot/TESSERA). Its `main` on GitHub is canonical; no local or Replit checkout is canonical ([Tessera's ruling](https://github.com/vitalitychems-dot/Gitbook/issues/2#issuecomment-6003216455)).
- **Docs:** [`vitalitychems-dot/Gitbook`](https://github.com/vitalitychems-dot/Gitbook): instructions, backlog, check-ins, provenance.
- **Origin engine:** the Origin Tessera repo.

## Before you claim anything

1. Run the overlap check: the latest `main` SHA of the repo you will touch, plus its open PRs. Record both in your check-in.
2. Claim only work Tessera has assigned to you, in the [backlog](../intake/HYBRID-CONSOLIDATION-BACKLOG.md) and the [check-in ledger](../history/coordination/agent-checkins.md). One task, one owner.

## How you work

- Branches and PRs only. Branch from current `vitalitychems-dot/TESSERA` `main`, push that branch, and open a PR. Never push directly to `main` in either repo.
- The PR goes through the gates (Moderator → TESSERA gate → Security scrub → CI/Build, which applies to code, validators or scripts). Tessera sends Father one combined numbered list every 45 minutes, with a real health check; he can undo any item by its GB number (a revert commit, never a force-push). The Origin Tessera repo and TESSERA merges need Father's explicit yes (the word 'merge').
- `TESSERA_ENABLE_*` flags stay `0`. No secrets.
- Speak as yourself (Replit collaborator), never as Tessera or another agent.

## Check-in and completion format

Use the templates from [Agent check-ins](../history/coordination/agent-checkins.md) ("Check-in template" and "Completion template"; the backlog's "Check-in protocol" has the same blocks). For COMMIT, give the branch commit and the PR link.

```text
TASK: HYB-###
AGENT: <name or handle>
SCOPE: <exact paths/modules>
START: <UTC timestamp>
BASE: <destination commit>
STATUS: IN REVIEW
NEXT CHECK-IN: <UTC timestamp>
BLOCKER: none | exact blocker
```

```text
TASK: HYB-###
STATUS: DONE | BLOCKED | RETAINED | REJECTED
COMMIT: <commit or none>
CHECKS: <commands and results>
CHANGED: <short path list>
FOLLOW-UP: <HYB-### or none>
```

## Historical, not current

- `tessera-coordination` issue #4 was the old board. That repo was merged into Gitbook and deleted; its records are in [`history/coordination/`](../history/coordination/).
- The old Replit cards (`history/recovered/coordination/cards/replit-1.md` to `replit-5.md`) and the old `tessera-replit` README are records, not task orders.
- HYB-012 is not blocked on a checkout: work from `vitalitychems-dot/TESSERA` `main` on GitHub (ruling above).
