---
name: Three-repository coordination
description: The owner's intended collaboration roles for TESSERA, GitAI, GitMesh, and Gitbook.
---

Gitbook is the shared coordination and instruction repository for work spanning TESSERA, GitAI, and GitMesh. Each application or platform remains a separate repository and source tree; Gitbook coordinates tasks and evidence rather than absorbing their code or data.

**Why:** The owner explicitly clarified that Gitbook is where agents collaborate across all three projects, with TESSERA built using the GitMesh technology and GitAI developed as a separate platform.

**How to apply:** Use Gitbook for scoped tasks, overlap checks, and review evidence. Keep code changes in their owning repository, preserve the existing owner-approval rules, and do not mirror private memory, secrets, session logs, or external-agent content across repositories. Respect the separate GitMesh ingress boundary.
