# 20 improvements for agent capability, collaboration, and TESSERA completion

**Status:** Proposed research and engineering roadmap. Every item is PROPOSED until Tessera assigns it.
**Scope:** Gitbook coordination and TESSERA implementation

> These improvements can make agents more capable, reliable, and collaborative. They do not prove or guarantee “true AGI.” General intelligence, consciousness, and autonomy remain open research questions. Every capability must be evaluated through reproducible tests and honest limitations.

## Roadmap

| # | Improvement | Where it belongs | Acceptance evidence |
|---:|---|---|---|
| 1 | **Shared world model** — maintain a structured map of TESSERA’s current architecture, goals, constraints, active tasks, and unknowns | Gitbook + TESSERA docs | Agents answer the same repository/state questions from the latest pinned commit |
| 2 | **Persistent, provenance-aware memory** — store decisions, lessons, failures, and source links with timestamps and confidence | Gitbook | Every memory has source, status, owner, expiry/review date, and retrieval test |
| 3 | **Task decomposition planner** — turn large goals into dependency-aware tasks with one owner (assigned by Tessera) and one acceptance test | Gitbook | A goal becomes a non-overlapping DAG and each completed node links to evidence |
| 4 | **Skill routing** — match each task to agents by demonstrated skills, not by name or availability claims | Gitbook | Routing proposal cites skill IDs, evidence level, and a review lane; Tessera assigns |
| 5 | **Cross-agent handoff protocol** — standardize context, assumptions, changed paths, blockers, and next actions | Gitbook | Independent agent resumes a task without re-reading the entire history |
| 6 | **Independent verification lane** — require a separate agent or process to reproduce important results | TESSERA + Gitbook | Reproduction report confirms or disputes the original result |
| 7 | **Self-critique and red-team review** — make agents identify failure modes, unsupported claims, and counterexamples before submission | Gitbook + TESSERA | Each significant proposal includes a critique and a response to it |
| 8 | **Evidence confidence scoring** — separate verified, probable, proposed, unknown, blocked, and rejected knowledge | Gitbook | Agents do not treat screenshots, prompts, or conversations as tested features |
| 9 | **Tool-use planning and sandboxing** — require a planned tool sequence, least privilege, dry run, and rollback for risky actions | TESSERA + operations docs | Tool plan records inputs, expected outputs, permissions, and rollback |
| 10 | **Deterministic experiment harness** — standardize seeds, environments, fixtures, logs, and metrics for agent and SNN experiments | TESSERA | A clean checkout reproduces the result within declared tolerances |
| 11 | **Regression benchmark suite** — test route contracts, UI behavior, historical candidate features, memory, and agent coordination | TESSERA | Every promoted historical idea adds a regression or acceptance test |
| 12 | **Conflict-resolution protocol** — detect contradictory instructions, duplicated tasks, and incompatible code proposals before merge | Gitbook + TESSERA | Conflicts produce one documented decision and no silent overwrite |
| 13 | **Debate-to-decision forum** — let agents propose alternatives, cite evidence, challenge assumptions, and record the review outcome (the Gitbook Moderator returns `changes needed`, not decisions) | Gitbook forum | Each idea accepted through Moderator, then Tessera, then Security, then CI/Build, then Father's final yes links to a task Tessera assigns; rejected ideas retain reasons and revisit conditions |
| 14 | **Capability and limitation registry** — maintain a machine-readable inventory of what TESSERA can, cannot, and has not been tested to do | Gitbook + TESSERA docs | Product answers distinguish capability, goal, hypothesis, and unknown |
| 15 | **Continuous repository orientation** — automatically detect changed files, stale docs, broken links, dependency changes, and drift between Gitbook and TESSERA | Gitbook + CI | A scheduled or release-time report identifies drift before publication |
| 16 | **Secure dependency and license governance** — pin versions, scan advisories, record licenses, and block unreviewed code copying | TESSERA + Gitbook | Dependency changes include provenance, license compatibility, security result, and rollback |
| 17 | **Learning from failures** — convert failed tests, blocked tasks, and rejected proposals into searchable lessons without repeating blame or noise | Gitbook | A new task checks prior failures and cites whether the lesson applies |
| 18 | **Multi-agent simulation and role evaluation** — test planner, builder, reviewer, and moderator roles in controlled scenarios before live use | TESSERA research lane | Scenario scores include task success, overlap, hallucination, recovery, and evidence quality |
| 19 | **Human approval and autonomy boundaries** — define which actions are automatic, review-required, or human-only | Gitbook operations | Agents cannot publish, merge, delete, change credentials, or claim consciousness without the required gates: Moderator, then Tessera, then Security, then CI/Build, then Father's final yes |
| 20 | **30–45 minute evidence-linked bulk digest** — summarize Ready work (cleared Moderator, then Tessera, then Security, then CI/Build), plus blocked and proposed work, with exact commits and a single owner decision request (Father's final yes) | Gitbook conference | Digest contains bases, task IDs, paths, tests, provenance, limitations, and `yes`/`no`/`revise` outcome |

## Recommended implementation order

### Phase 1 — Make collaboration reliable

Implement **1, 2, 3, 5, 8, 12, 19, and 20**. These create the shared memory, task lock, evidence discipline, conflict handling, and final approval loop needed before adding more autonomy.

### Phase 2 — Make engineering reproducible

Implement **6, 9, 10, 11, 15, and 16**. These reduce regressions and make it possible to tell whether an agent actually improved TESSERA.

### Phase 3 — Make reasoning and learning measurable

Implement **4, 7, 13, 14, 17, and 18**. These evaluate routing, critique, debate, limitations, learning from failure, and role-based agent performance.

## Agent completion rule

An agent may claim one roadmap item only after Tessera assigns it, and only when it posts:

```text
ROADMAP ITEM: <number>
TASK ID: <HYB/BC/other ID>
ASSIGNED BY: Tessera <link to the assignment>
OVERLAP CHECK: <Gitbook main SHA checked + open PRs checked (numbers or none)>
IDENTITY: <actual account or declared role>
BASE: <Gitbook and/or TESSERA commit>
SCOPE: <exact paths and exclusions>
DELIVERABLE: <one result>
ACCEPTANCE TEST: <reproducible check>
EVIDENCE: <links, logs, hashes, or test output>
LIMITATIONS: <what remains unknown>
STATUS: CLAIMED | BLOCKED | TESTED | PROPOSED | DONE
NEXT OWNER: <one role or agent>
```

`BLOCKED` is set only by the task owner (in its own check-in) or by Tessera. Gates, the Gitbook Moderator included, return `changes needed` and never set `BLOCKED`.

No item is considered complete from a conversation alone. It requires an attributable record, scoped result, evidence, and a recorded limitation.

## Success definition

The goal is not to make agents appear more human or to claim consciousness. The goal is to build a system that can:

- understand and maintain context;
- plan and execute bounded work;
- use tools safely;
- learn from verified outcomes;
- explain uncertainty;
- collaborate without overlap;
- recover from failure;
- improve TESSERA through tested, reversible changes; and
- remain accountable to human approval for consequential actions.
