---
name: GitHub shell authentication
description: Distinguishes GitHub App REST access from HTTPS Git and Git LFS authentication in this Repl.
---

The GitHub App connector authenticates requests sent through `proxyFetch` to the GitHub REST API. It does not provide credentials to `git push` or Git LFS. For shell pushes, use Replit's Git pane/provider authentication or a separate repository-scoped PAT stored through Replit Secrets.

**Why:** The connected GitHub API could read repository metadata and reported push permission, while HTTPS Git operations independently failed authentication. `gh auth status` was also unauthenticated.

**How to apply:** Before attempting large or LFS pushes, confirm a Git transport credential is available independently of the connector. Never extract connector credentials or place a token in project files or chat.