# Tessera Sovereign System

## Overview

Full-stack sovereign AI agent platform. pnpm workspace monorepo with a React+Vite dark glassmorphism frontend (127 pages) and an Express 5 backend with 28+ API routes, sovereign computation engines, and a Grand Council governance system.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 19 + Vite + TailwindCSS + shadcn/ui (dark sovereign theme)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Build**: esbuild (CJS bundle)

## Design System

- **Theme**: Dark glassmorphism — background `hsl(250, 15%, 6%)`, primary cyan `hsl(191, 97%, 50%)`
- **Effects**: Aurora backgrounds, backdrop-blur glassmorphism panels, cyan glow accents
- **Always dark mode**: `dark` class applied to root

## Sovereign Computation Engines

All computations are local — zero external API calls:
- **sovereign-economics**: World state, TSRT market data, agent economics, tax history
- **sovereign-astro**: Lunar data (Meeus algorithms), solar position, planetary hours
- **sovereign-network**: Mesh topology (16 nodes), Dijkstra routing, swarm status
- **sovereign-harmonics**: Solfeggio frequencies, Schumann resonances, DNA healing

## Sovereignty Benchmark System

All sovereignty scores are **real, verifiable, and computed live** — no hardcoded values:
- `sovereign-benchmarks.ts` runs 34 tests across 7 modules (astronomy, economics, network, harmonics, system-health, sovereignty, governance)
- Each test validates engine outputs against physical/mathematical constraints with evidence strings
- Astronomy: Meeus algorithm validated via illumination range, lunar distance (perigee-apogee), synodic month age, solar declination bounds, zodiac cross-checks
- Economics: accounting identities (mcap = price × supply), Gini coefficient range, agent productivity bounds
- Network: graph connectivity, Dijkstra route correctness, node ID validity
- Harmonics: all 9 solfeggio frequencies present (174-963 Hz), Schumann base ~7.83 Hz confirmed
- System-health: real heap/CPU metrics
- Sovereignty: 100% local compute verified, no external APIs, no external LLM, local DB
- Governance: council decisions and inventions counted from DB
- Council vote confidence derived from real sovereignty scores per domain (not sine waves)
- Proof verification runs each engine live and validates outputs (not hardcoded sovereignty:100)
- 30-second cache on benchmark results (`CACHE_TTL_MS`)

## Key API Routes

- `/api/health` — System health
- `/api/sovereignty/score` — Live sovereignty score from real benchmark
- `/api/sovereignty/benchmark` — Full detailed benchmark report with per-test evidence
- `/api/sovereignty/modules` — Module-by-module engine status
- `/api/system/sovereign-metrics` — Full system telemetry (CPU, memory, engines, DB)
- `/api/system/engines` — Engine latency benchmarks
- `/api/council/deliberate` — Grand Council 3-round deliberation (POST, `topic` field)
- `/api/council/decisions` — Council decision history
- `/api/council/meeting` — Full multi-round council meetings
- `/api/grand-council/votes` — Council agent votes with real confidence scores
- `/api/grand-council/proofs` — Live-verified sovereignty proofs per domain
- `/api/world` — World state economics
- `/api/tsrt/full-market` — Token market data
- `/api/inventions/*` — Sovereign inventions CRUD
- `/api/swarm/*`, `/api/memory/*`, `/api/reasoning/*` — Agent systems

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/tessera run dev` — run frontend

## Database

PostgreSQL with Drizzle ORM. Schemas cover: system, security, provider-sovereignty, memory, reasoning, swarm, ingestion, inventions, conversations, council decisions, council meetings, phases 8-12.

## Architecture Notes

- Council deliberations use `topic` field (not `question`)
- Sovereignty score is computed live from all engine outputs + DB stats
- All 7 council agents have domain-specific analysis: governance, quantum, bio-neural, archival, networking, hardware, self-improvement
- Inventions have detailed real data: materials, steps, science explanations
- Frontend has 127 pages across categories: Chat, Life, Entities, Voice, Nexus, Knowledge, Bible, Council, Economy, Invent, Liberate, Universe, Sovereign, SovLaw, Build, Sacred, Swarm, Network, Memory, Sandbox, System, AGI, Autonomy, Security
