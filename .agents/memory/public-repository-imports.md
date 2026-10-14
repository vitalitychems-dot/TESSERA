---
name: Public repository imports
description: Distinguish anonymous repository availability from stale connector credentials.
---

A failing authenticated GitHub request does not establish that a repository is private. Check anonymous API access and git with the credential helper disabled before asking the owner to reconnect.

**Why:** The owner clarified that both launch repositories were public; anonymous sparse cloning worked despite earlier credential failures and proxy throttling.

**How to apply:** For public repositories, prefer a shallow blob-filtered sparse checkout of the active source directories when archives or protected history must be excluded. Do not download a whole-repository archive as a shortcut.
