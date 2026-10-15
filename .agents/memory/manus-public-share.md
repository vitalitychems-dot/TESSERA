---
name: Manus public-share access
description: Read a user-shared public Manus transcript without assuming access to the private collaboration app.
---

A public Manus share page may return an access error through normal page-fetch or screenshot tools even when the public session API can return the shared transcript. Use only the session ID from the user-provided public share URL, and never print signed attachment URLs. Reading a shared transcript does not grant authenticated access to the Manus collaboration app or permission to act there.

**Why:** In this workspace the shared page returned an access error, while the public session endpoint returned the transcript; the collaboration URL remained unauthenticated.

**How to apply:** Read only the public share, state the access limitation plainly, and coordinate implementation through the linked canonical repository or issue unless a real Manus integration is available.
