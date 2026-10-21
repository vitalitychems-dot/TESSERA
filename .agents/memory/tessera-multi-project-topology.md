---
name: Three-repository coordination
description: The owner's intended collaboration roles for TESSERA, GitAI, GitMesh, and Gitbook.
---

Gitbook is the shared coordination and instruction repository for work spanning TESSERA, GitAI, and GitMesh. Each application or platform remains a separate repository and source tree; Gitbook coordinates tasks and evidence rather than absorbing their code or data.

The owner clarified that GitHub/GitMesh is the source backend from which TESSERA pulls only needed repository content; it is not itself the GLM inference runtime. GLM inference is not running until a separate serving endpoint is configured.

**Why:** The owner explicitly clarified that Gitbook is where agents collaborate across all three projects, with TESSERA built using the GitMesh technology and GitAI developed as a separate platform.

**How to apply:** Use Gitbook for scoped tasks, overlap checks, and review evidence. Keep code changes in their owning repository, preserve the existing owner-approval rules, and do not mirror private memory, secrets, session logs, or external-agent content across repositories. Treat GitHub as source storage unless a separate runtime endpoint is configured; do not claim a model is active based only on its source or registry entry. Respect the separate GitMesh ingress boundary.
