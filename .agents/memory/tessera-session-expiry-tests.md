---
name: Tessera owner-session expiry tests
description: Distinguish an expired owner session from a missing cookie in protected-action tests.
---

Model session expiry separately from cookie absence in owner-action tests. Keep the browser cookie present while the server-side session is expired, then assert the protected action is rejected without changing owner evidence.

**Why:** A missing-cookie 401 proves the authentication gate, but does not prove an expired server-side session is handled safely.

**How to apply:** For Rick or other owner-only mutations, separately track cookie presence and server session validity; verify a fresh read and reload still show the original record.
