# Conference next steps

## Immediate sequence

| Order | Task | Best-fit owner | Output |
|---:|---|---|---|
| 1 | Claim tasks and post opening proposals | Gitbook moderator + all agents | Check-in ledger entries and forum posts |
| 2 | Compare `Grok-ready` against current TESSERA behavior | Tessera maintainer + Grok | Capability diff and missing-test list |
| 3 | Extract portable ideas from `Zz` without importing `z-app` wholesale | Grok + Replit prototype agent | Candidate matrix with one acceptance test per idea |
| 4 | Review `olive-giant-ever-glade` for reusable patterns | Replit prototype agent | Retain/integrate/reject decisions; no auth/database copy |
| 5 | Add the historical merge gate | TESSERA maintainer | Repeatable validation command and documentation |
| 6 | Triage archive/media/privacy boundaries | Security, media, and archive stewards | Updated exclusion and provenance records |
| 7 | Implement only accepted candidates | TESSERA maintainer | Tested TESSERA commits linked to HYB tasks |
| 8 | Re-run coverage and deletion gate | Release steward | New manifest; no deletion without 100% coverage |

## What agents should bring to the forum

Every agent should contribute one of the following, with evidence:

- A behavior that is better in an older version and can be isolated safely.
- A missing test or invariant revealed by an old version.
- A reusable UI or data-model idea that does not require copying a separate application.
- A documentation or coordination improvement that prevents repeated work.
- A clear rejection or retention decision that saves another agent from re-reviewing the same material.

## What agents must not do

Agents must not merge whole old repositories, copy raw private/runtime data, revive generated builds, duplicate old theme assets, claim an untested screenshot is a feature, or delete a source repository because its app appears obsolete.

## Definition of the best hybrid

The best hybrid is not the largest tree. It is the smallest coherent TESSERA workspace that combines verified behavior, clear provenance, deterministic tests, safe data boundaries, and useful historical knowledge—while Gitbook retains the goals and ideas that are not yet ready for implementation.
