# Permanent-site release readiness

**Status:** PREPARED, not published  
**Canonical source:** `vitalitychems-dot/TESSERA`  
**Quality base (SITE-002):** `bb4b3191ed037982d8b525bbb9bc507058854686`

## Verified improvements

- Development-only Replit Vite plugins now load only for `vite serve`; production builds do not load the runtime-error overlay, cartographer, or dev banner.
- Removed the unnecessary Next.js-only `"use client"` directive from the Vite tooltip component.
- Added `artifacts/tessera/public/manus-routes.json` with the 51 declared application routes for managed Webdev discovery.
- Route manifest is copied into `artifacts/tessera/dist/public/manus-routes.json` by the production build.
- PERF-001 splits 3D vendor chunks (`vendor-three`, `vendor-r3f-drei`, `vendor-r3f-fiber`, `vendor-three-stdlib`) in `artifacts/tessera/vite.config.ts`.
- Pull request 96 gates each sovereign-engine route and `GET /api/diagnostics/consciousness` with `requireAdminSession`. `GET /api/healthz` stays open.
- SITE-002 follow-up gates the remaining diagnostics routes the same way (root diagnostics, heartbeat, identity, emotional, cosmology, engines, personality, module-protection). Healthz stays open. Landed via Cursor Project auto-merge after overlap CLEAR vs Replit SITE-001/005.

## Evidence

- Earlier readiness at `e5e5719`: `pnpm typecheck`, `pnpm test`, and `pnpm run build` passed; 51-route manifest validated.
- PERF-001 at `072acd8`: largest 3D chunk moved from ~1,019.51 kB OrbitControls advisory to ~724.83 kB `vendor-three` (plus smaller r3f chunks).
- Engine session gates: validate run 38014313293 on pull request 96.
- Current tip for this quality pass: `bb4b319` (pull request 103 brain canvas). This note does not re-run the full workspace suite in the Cursor Project environment (no private clone token).

## Publication boundary

This is source and build readiness only. Permanent publication still requires SITE-001/005 serving evidence from the managed project, SITE-003 provenance, SITE-004 security bulk review, a GitHub checkpoint, and Father's exact release-payload approval recorded in Gitbook. Merged pull requests do not authorize production publication.
