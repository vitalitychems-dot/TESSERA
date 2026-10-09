# Permanent-site release readiness

**Status:** PREPARED, not published  
**Canonical source:** `vitalitychems-dot/TESSERA`

## Verified improvements

- Development-only Replit Vite plugins now load only for `vite serve`; production builds do not load the runtime-error overlay, cartographer, or dev banner.
- Removed the unnecessary Next.js-only `"use client"` directive from the Vite tooltip component.
- Added `artifacts/tessera/public/manus-routes.json` with the 51 declared application routes for managed Webdev discovery.
- Route manifest is copied into `artifacts/tessera/dist/public/manus-routes.json` by the production build.

## Evidence

- `pnpm typecheck` — passed.
- `pnpm test` — passed: 15 workspace safety/merge tests, 30 Gitbook MCP tests, and 5 learning-memory tests; database integration tests remain intentionally skipped without a dedicated local test database.
- `pnpm run build` — passed with no sourcemap, TypeScript, lifecycle, or build-failure diagnostics.
- Route manifest validation — passed with 51 routes, all beginning with `/`.

The production bundle still reports a non-fatal large-chunk advisory for the 1,019.51 kB OrbitControls chunk. It is recorded as a performance follow-up, not suppressed or misrepresented as a failed build.

## Publication boundary

This is source and build readiness only. Permanent publication still requires the managed Webdev project model choice, a production health-path check, security/privacy review, a GitHub checkpoint, and the exact release payload approval recorded in Gitbook.
