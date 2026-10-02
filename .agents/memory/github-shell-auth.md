---
name: GitHub shell authentication
description: Distinguishes GitHub App REST access from HTTPS Git and Git LFS authentication in this Repl.
---

The GitHub App connector authenticates requests sent through `proxyFetch` to the GitHub REST API, but not `git push` or Git LFS. Replit's Git pane supports source-code pushes but does not natively support Git LFS. A separate repository-scoped credential is required for shell Git/LFS operations.

For this project, exclude runtime/audit data, workspace notes, agent files, and attached screenshots from public uploads. Never publish the full working tree as a substitute for the curated snapshot. Keep repository visibility private until the clean tree and LFS transfer are verified and the user explicitly approves republication.

**Why:** A Git-pane-synced commit included files that were explicitly meant to stay out of the public repository, while the shell push independently failed authentication.

**How to apply:** Build and verify an explicit upload snapshot, confirm the remote tree contains only approved paths, and verify the LFS object itself—not just its pointer—before changing visibility. Never extract connector credentials or place a token in project files or chat.