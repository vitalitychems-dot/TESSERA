---
name: Published images prune node_modules
description: Externalized npm imports crash in published deployments; bundle runtime dependencies into the esbuild output.
---

Replit's monorepo publishing pipeline removes installed packages from the final image after the build ("Removed 943 packages" in build logs). Any package left in esbuild's `external` list but imported at runtime then crashes with `ERR_MODULE_NOT_FOUND` at startup, even though the same command works in development where node_modules exists.

**Why:** The API build externalized `@google-cloud/*`, and the published artifact crashed on `Cannot find package '@google-cloud/storage'` after a successful build — the second consecutive crash-loop cause after the CWD path fix.

**How to apply:** Keep the `external` list limited to native/unbundleable packages that are genuinely absent at runtime. Verify a bundle change by grepping `dist/index.mjs` for bare `from "@pkg"` imports and by launching the production command with a clean environment. Local dev and even local production-mode runs do NOT catch this, because node_modules is still present.
