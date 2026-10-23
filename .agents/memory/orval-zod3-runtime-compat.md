---
name: Orval and Zod runtime compatibility
description: Keep generated API validators compatible with the Zod major version used by the server.
---

Generated API validators must target the installed Zod runtime, not merely the generator's defaults. With Zod 3, Orval can emit Zod 4-only helpers such as `zod.int()` or `zod.url()`; compilation may pass while API startup fails during module import. Prefer a Zod-output-only OpenAPI transformation and regenerate the outputs rather than hand-editing generated files. Keep React Query's generated client version aligned with the installed major as well.

**Why:** An API restart exposed a runtime import failure in generated validators after a successful codegen and typecheck.

**How to apply:** Before and after API codegen, compare generated validator helpers against the installed Zod package, then run an API build and startup check.
