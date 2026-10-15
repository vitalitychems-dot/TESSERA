---
name: Sovereign outbound fetches
description: Required execution context for outbound HTTP under TESSERA's global fetch guard.
---

An outbound fetch may be denied even when its audit caller is classified as Shepherd. Requests must execute inside the Sovereign Fetch Guard's async Shepherd context; a caller label or a separate preflight policy check does not establish that context.

**Why:** The global guard checks AsyncLocalStorage context at the actual `fetch` call and fails closed without it.

**How to apply:** Before adding any server-side external HTTP request, inspect the guard and established wrappers, then execute the fetch inside the approved Shepherd context with a least-privilege caller and reason. Keep secret values and response content out of diagnostics.
