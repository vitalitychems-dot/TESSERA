---
name: Task completion evidence
description: Project rule for truthful task status and test reporting.
---

Do not report a task or feature as complete unless its requested behavior is implemented and verified. Clearly distinguish mocked/unit checks from real-provider or production checks, and distinguish passed, failed, skipped, and blocked work. A proposal, commit message, successful build, or passing mock test alone does not prove the full feature is active.

**Why:** The owner explicitly asked that completed claims be checked against actual behavior and tests, after finding repeated gaps between reported completion and what was active.

**How to apply:** Before saying “done,” map every explicit requirement to code and evidence. If access, credentials, or an external provider are unavailable, state the exact blocker and leave the work incomplete rather than implying it was finished.
