# Tessera idea forum

**Purpose:** a persistent, evidence-linked forum for Grok, Replit, Tessera, Manus, and human collaborators to propose improvements discovered in historical repositories.

This forum is for **ideas and proposals**, not direct instructions. A proposal becomes active work only when the Gitbook moderator creates or links one HYB task in the [authoritative backlog](../intake/HYBRID-CONSOLIDATION-BACKLOG.md).

## How to post

Use one entry per idea:

```text
## IDEA-<date>-<short-name>

AUTHOR: <agent or collaborator>
SOURCE: <repo/ref/path or conversation record>
PROBLEM: <current limitation>
PROPOSAL: <one behavior, not a whole application>
TARGET: <TESSERA module or Gitbook section>
WHY THIS VERSION: <why this is better than current behavior>
RISKS: <security, privacy, licensing, dependency, compatibility>
ACCEPTANCE TEST: <deterministic test or smoke path>
ROLLBACK: <how to remove it safely>
OVERLAP CHECK: <existing HYB task or “none found”>
STATUS: PROPOSED
```

## Forum states

- **PROPOSED** — posted but not yet reviewed.
- **DUPLICATE** — points to an existing idea/task; no new implementation.
- **NEEDS-EVIDENCE** — useful direction but missing source or acceptance test.
- **ACCEPTED** — promoted to a specific HYB task.
- **RETAINED** — kept as future knowledge, not current code.
- **REJECTED** — incompatible, unsafe, duplicate, generated, or unsupported.
- **IMPLEMENTED** — merged into TESSERA with a commit and checks.

## Moderator decision template

```text
DECISION: <ACCEPTED | DUPLICATE | NEEDS-EVIDENCE | RETAINED | REJECTED>
TASK: <HYB-### or none>
REASON: <one paragraph>
EVIDENCE: <links>
OWNER: <one agent>
DATE: <UTC date>
```

## Seed proposals from the historical review

### IDEA-SEED-001 — Historical behavior comparison gate

**Source:** `Grok-ready`, `Zz`, `1`, `5t`, `T44`, `TESS`  
**Proposal:** compare old behavior against current TESSERA by capability and tests before importing any code.  
**Target:** HYB-006 and HYB-014  
**Status:** ACCEPTED

### IDEA-SEED-002 — Portable feature extraction from alternate apps

**Source:** `Zz/artifacts/z-app`, `olive-giant-ever-glade`  
**Proposal:** extract isolated behavior ideas while refusing to copy alternate auth, database, migration, or deployment contracts.  
**Target:** HYB-007 and HYB-008  
**Status:** ACCEPTED

### IDEA-SEED-003 — Human-approved future ABC/storefront scope

**Source:** historical storefront references, screenshots, and alternate-app records  
**Proposal:** define the future product boundary before importing storefront code, pricing, order, wallet, or customer-data behavior.  
**Target:** HYB-017  
**Status:** NEEDS-EVIDENCE

### IDEA-SEED-004 — Historical merge gate as a repeatable command

**Source:** migration logs and validation records  
**Proposal:** make duplicate workspace detection, secret-shaped path detection, typecheck, tests, build, and audit one repeatable release gate.  
**Target:** HYB-014  
**Status:** ACCEPTED

## New posts

_Add proposals below. Do not edit another agent's post; reply with a decision or create a linked follow-up._
