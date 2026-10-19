---
name: Large GitHub inventory handling
description: Avoid notebook resets when auditing the large TESSERA and Gitbook source trees.
---

Do not retain several full recursive GitHub tree responses in the durable JavaScript notebook. Fetch and process one repository inside the impure boundary, save raw diagnostic metadata under `/tmp`, and return only compact counts, pinned refs, and selected comparisons.

**Why:** A multi-repository inventory exceeded the notebook's 32 MiB memory limit and reset all retained variables, even though the useful comparison summaries were small. The repository trees include substantial historical inventories.

**How to apply:** Keep explicit commit pins outside the large payload, check every tree's truncation flag, and compute duplicate/content comparisons from temporary metadata. Never move private archive bodies into tracked workspace reports to work around this limit.
