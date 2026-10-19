---
name: Skipped Vitest integration suites
description: Resource setup must stay in hooks even when a database-backed suite is skipped.
---

Vitest 4 evaluates a skipped `describe` callback to discover its tests. A skip condition does not prevent connections or other side effects performed directly in that callback.

**Why:** An offline run failed before test execution because a skipped integration suite opened a database pool while being declared.

**How to apply:** Decide whether to skip from configuration alone. Open database connections and perform filesystem/network setup inside `beforeAll` or equivalent hooks, not while declaring the suite. Keep offline checks separate from explicitly provisioned database tests.
