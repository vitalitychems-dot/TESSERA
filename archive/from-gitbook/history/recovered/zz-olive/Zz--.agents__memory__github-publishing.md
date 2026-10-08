---
name: GitHub publishing under concurrency
description: Safe remote branch updates from a Replit workspace when GitHub API access and simultaneous contributors are involved.
---

Treat GitHub App connector access as separate from the local Git remote's authentication. A connected integration can be usable for API requests while `git push` rejects the checkout's credentials.

**Why:** A local push failed authentication, and simultaneous contributors advanced local and remote refs while an API publication was being prepared.

**How to apply:** Before any remote ref write, recheck local `HEAD`, its parent and tree, tracked/index state, and the live GitHub ref. Use a fast-forward-only update and stop if any value changed. Do not inspect or modify another contributor's staged work without permission.