---
name: Frontend test transforms
description: The test runner and the app can use different Vite generations with different JSX transformer settings.
---

**Rule:** Determine the Vite version used by the actual test runner before configuring JSX transforms; do not assume it matches the frontend dev server.

**Why:** The available Vitest runner used Vite 8/Oxc while the application used Vite 7. An esbuild JSX override was ignored, leaving preserved JSX for import analysis and failing otherwise valid component tests.

**How to apply:** Configure the runner's active transformer, rather than changing the application's JSX settings or installing another compiler to work around a test-only failure.
