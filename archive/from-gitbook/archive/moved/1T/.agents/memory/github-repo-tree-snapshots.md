---
name: GitHub repo tree snapshots
description: Reliable multi-repository inventory through the GitHub App connector.
---

**Rule:** Fetch recursive Git trees sequentially through the GitHub App proxy, and filter tree entries or discussion responses before logging instead of returning full payloads. For active coordination repos, compare the current main SHA with the last observed SHA, then inspect changed instruction files and the discussion thread separately.

**Why:** Concurrent agents can merge instructions while a thread is being checked, so a recent issue comment may not reflect the repository's latest state. A concurrent API batch also produced secondary 429 responses, and full trees or threads can overwhelm output.

**How to apply:** When checking a live coordination repo, record the main SHA, compare against the last observed head, read relevant changed files at the exact new commit, then query comments and open PRs. Request one tree at a time and summarize only the instructions, status, and evidence needed for the next step.
