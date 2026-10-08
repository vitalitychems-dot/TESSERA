# Agent skill matrix

Use skill IDs in every task claim (a task is claimed only after Tessera assigns it). An agent may have several skills, but each task must name one primary skill and one review skill.

## Skill levels

- **L0 — Observing:** can read, summarize, and cite sources.
- **L1 — Assisted:** can make a scoped proposal with guidance.
- **L2 — Independent:** can produce a tested result within a declared lane.
- **L3 — Reviewer:** can verify another agent's evidence and reject unsafe or incomplete work.

## Canonical skills

| ID | Skill | Expected evidence |
|---|---|---|
| SK-01 | Repository orientation | Correct base commit, path map, and no protected-source violation |
| SK-02 | Source and license analysis | Official URL, pinned ref, license, provenance, compatibility note |
| SK-03 | Historical comparison | Behavior/test comparison, not filename or line-count similarity |
| SK-04 | Python/TypeScript implementation | Small scoped diff with formatting and type checks |
| SK-05 | SNN/neuroscience modeling | Equation or model source, parameters, units, and reproducible trace |
| SK-06 | Experiment design | Hypothesis, baseline, seed, metric, result, and limitations |
| SK-07 | Testing and reproducibility | Exact commands, environment, deterministic or bounded result |
| SK-08 | Security and privacy | Threat boundary, secret scan, dependency review, rollback |
| SK-09 | Documentation and provenance | Clear status labels and links to source/evidence |
| SK-10 | Coordination and moderation | Non-overlap check, review decision, and follow-up assignment |
| SK-11 | Product/claims review | Separates capability, goal, hypothesis, and unknown |
| SK-12 | Release/change control | Commit, migration note, validation record, and publication packet |
| SK-13 | CI log diagnosis and allow-list classification | A cited failing log line, the allow-list class, and a suggest-only disposition when the class is inside selffix phase 0 (no pull request) |

## Role-to-skill baseline

| Lane | Primary skills | Review skills |
|---|---|---|
| Gitbook / Cordnation | SK-09, SK-10 | SK-01, SK-11 |
| Gitbook Moderator | SK-02, SK-08, SK-10 | SK-07, SK-12 |
| Command Center | SK-09, SK-10 | SK-01, SK-12 |
| TESSERA build | SK-04, SK-07 | SK-08, SK-09 |
| Build verify-only | SK-07, SK-08 | SK-04, SK-12 |
| Github Scraper | SK-01, SK-02, SK-03 | SK-09 |
| Tessera Pen | — (not a lane: Tessera's own writing voice; not a reviewer) | — |
| Brain/SNN research — PROPOSED (unrostered) | SK-05, SK-06 | SK-02, SK-07 |
| Replit/Grok collaborator | SK-01, SK-03, SK-06 | SK-07, SK-09 |

## Skill training cycle

1. Read the relevant role page and current task record.
2. Complete one small shadow task with evidence.
3. Complete one independently scoped task.
4. Receive a review from a different lane.
5. Record the demonstrated level and any limits in the check-in ledger.

Skill claims are not credentials. They are current, task-specific evidence and may be downgraded when checks fail or scope changes.
