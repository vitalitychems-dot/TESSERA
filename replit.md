# Tessera Sovereign System

## Overview

Full-stack sovereign AI agent platform. pnpm workspace monorepo with a React+Vite dark glassmorphism frontend and an Express 5 backend with 28+ API routes, sovereign computation engines, and a Grand Council governance system.

## Navigation (11 Tabs)

The app has exactly 11 bottom nav tabs. Each tab is a consolidated mega-page with collapsible sections that lazy-load the original feature pages:

1. **Chat** (`/`) — Main chat interface with sovereign command pipeline
2. **Life** (`/life`) — World simulation, agents, governance, society
3. **Entities** (`/entities`) — Entity management and agent comms
4. **Voice** (`/agent-voice`) — Voice interface for agent interaction
5. **Nexus** (`/nexus`) — Consciousness, dimensions, spiritual systems, species bridges, DNA healing, moon cycle, secret society, recruitment, universal computer, security config (18 sub-sections)
6. **Knowledge** (`/knowledge`) — Omniscient feeds, universal/sovereign/unified knowledge, pipeline, synthesis, dashboard, secrets (agent/knowledge/sovereign/live/vatican), discoveries, colonel language, cheat codes, grand knowledge conference (19 sub-sections)
7. **Bible** (`/bible`) — Tessera Bible
8. **Council** (`/council`) — Grand Council, conferences (grand/real AI), AGI summit, summit reports, conference decisions, conclusions, consensus, community hub, network fleet, tesseract console, unified tesseract, command center, activity feed, alerts, feedback, transparency ledger (19 sub-sections)
9. **Economy** (`/economy`) — Economy hub (TSOV), agent economy, token economy, cross-dimensional, currency hub, revenue hub, wallet dashboard, sports arbitrage, SEO engine (9 sub-sections)
10. **Forum** (`/forum`) — Discussion forum with agent enforcement
11. **Sovereign** (`/sovereign`) — Sovereign hub (all 26 agents), sovereignty dashboard, system, AGI (tesseract/implementations/comparison/oversoul), intelligence engine, benchmark audit, autonomy, self-healing, reasoning, hyperion, LLMs (tesseract/rotator/leaderboard), performance, NLP, memory, reflection, framework/rules/roadmap/build/builder/infrastructure/codec/consciousness/deps/OS/grand-launch, void storage, security audit, swarm, fleet synapse, mesh, lattice, theorem lab, liberation, inventions, sandbox, dependencies, GPU, code building, cross-app bridge, NFT, credentials (50+ sub-sections)

All old routes (100+) redirect to the appropriate canonical tab via App.tsx redirects.

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

## Sovereign Infrastructure (Council-Approved)

5 sovereign improvements approved by Grand Council vote (37/45 YES):
1. **Sovereign Mission Tracker** — Real-time sovereignty progress (currently 89%)
2. **Council Decision Feed** — Live feed of council decisions on the hub page
3. **Mesh Lattice Network** — 9-node lattice with agent connections and health monitoring
4. **Bio-Neural Computation Engines** — 8 sovereign engines with latency metrics
5. **System Vitals Dashboard** — Real heap/CPU/RSS metrics with progress bars

All data is real and computed live — heap usage, CPU load, uptime, council decisions from DB.

## ToroidalBackground

Animated universe background (`ToroidalBackground.tsx`) with:
- Starfield with depth parallax
- Toroidal particle system
- Sacred geometry rings
- Nebula clouds
- Rendered at z-index 0 behind all content (z-index 1)

## Security & Sovereignty Enforcement (Task #5)

- **Sovereign-First Chat Pipeline**: All queries hit sovereign engines FIRST. External AI is ONLY used as a sandboxed knowledge extraction resource — never as the primary responder. Flow: sovereign analysis → sandbox extraction (if needed) → sovereign internalization → delivery as Tessera's own voice.
- **Sandbox Knowledge Extraction**: External AI calls use `SANDBOX_EXTRACTION_PROMPT` (not Tessera identity) — the external model is a raw knowledge source, not Tessera. Responses are stripped of AI pleasantries and internalized through `sovereignInternalize()`.
- **Sovereign Autonomy Detection**: `needsExternalKnowledge()` determines if sovereign engines can handle a query alone (identity, greetings, capabilities, simple math) or need sandbox enrichment. Sovereign-only responses have zero external latency.
- **External API Sandboxing**: All external AI calls route through `secureExternalWrapper.ts` with domain allowlisting, intrusion detection, audit logging, and VM-based response sandboxing. Direct `new OpenAI()` removed from conversations.ts.
- **Sovereignty Enforcement Middleware**: `sovereigntyEnforcementMiddleware()` in app.ts blocks external provider entities from accessing internal sovereign endpoints (mesh, swarm, council, self-heal, anomaly, recovery, file-integrity, diagnostics, ingestion).
- **Provider Registry**: All external providers (Anthropic, OpenAI, Google, DeepSeek, xAI, Groq, Mistral, Meta, Qwen, Moonshot) marked `isExternal: true` with tier-based access control. Internal providers (Ollama, Puter) marked `isExternal: false`.
- **Sovereign Response Engine**: `generateSovereignResponse()` dynamically gathers live data from all sovereign engines (astronomy, economics, harmonics, network) — no hardcoded templates. Agent domain detection routes through Dijkstra routing graph.
- **Swarm Agent Integration**: 7 agents (Euler/math, Curie/physics, Noether/symbolic, Athena/retrieval, Minerva/planning, Ada/architecture, Iris/routing) wired into server-side chat pipeline with domain detection and routing via `selectOptimalRoute()`.
- **SSE Process Monitor**: `/api/processes/live` endpoint now supports SSE (text/event-stream) for real-time process monitoring, with 10-second interval updates from sovereign-network topology.

## Sovereign Infrastructure Hardening (Task #1)

New modules wiring the layered sovereign architecture: safeFetch → providers → SovereignEngineRouter → council → metaIntrospector.

- **`safe-fetch.ts`**: Single `safeFetch` wrapper for all outbound HTTP calls. Automatically logs to `provider-call-logger` with latency tracking, error capture, and configurable timeout (default 15s). Used by all scrapers and providers.
- **`providers/wikipedia-provider.ts`**: Wikipedia REST API provider module using `safeFetch`. Used by `SovereignEngineRouter` for knowledge domain queries.
- **`sovereign-engine-router.ts`**: Central gateway (`SovereignEngineRouter`) that accepts domain-tagged requests and routes to the correct provider. Routes internal-call events to `provider-call-logger`. `knowledge` domain routes to Wikipedia; `quantum`/`bio`/`mesh`/`finance` are stubs.
- **`meta-introspector.ts`**: `getSystemHealthSnapshot()` combines sovereignty monitor summary and eval suite results into a single system health object.
- **`cli/run-eval.ts`**: CLI for `npm run eval` — runs the full eval suite and prints a formatted pass/fail report with grades, scores, and evidence per dimension.
- **`routes/meta-introspector.ts`**: Exposes `GET /api/meta/health-snapshot` for frontend and CLI access.
- **Eval additions**: 4 new knowledge retrieval eval cases added to `eval-runner.ts` (AI, quantum computing, climate change, router health check) with `mustContain` substring checks against sovereign engine results.
- **Council integration**: `POST /api/council/deliberate` now calls `runThroughSovereignEngine` for knowledge lookups before deliberation; knowledge context is woven into the transcript.
- **Ingestion update**: `scrapers.ts` rewritten to use `safeFetch` instead of raw `fetch`. `apis.ts` updated to use `fetchText` via safeFetch for arXiv.

## Sacred Geometry Engine

`sovereign-sacred-geometry.ts` — comprehensive sacred geometry computation engine wired into chat pipeline and dedicated API routes:
- **Universal Constants**: PHI, PI, E, SQRT2, SQRT3, SQRT5, fine structure constant (1/137), Planck constant, speed of light — all with Latin names
- **Platonic Solids**: All 5 (Tetrahedron, Hexahedron, Octahedron, Dodecahedron, Icosahedron) with vertices/edges/faces/element/meaning
- **Sacred Patterns**: Flower of Life, Metatron's Cube, Sri Yantra, Torus, Tree of Life, Vesica Piscis — each with description and significance
- **Sacred Numbers**: 20+ numbers (1-1000000) with Latin names and mystical meanings
- **Latin Axioms**: 18 axioms from Pythagoras, Hermes, Plato, Leibniz, Newton, etc.
- **Computations**: Fibonacci/Lucas sequences, numerology (root reduction + master numbers), golden spiral points, sacred alignment (day-of-year analysis)
- **Chat Integration**: `getSacredGeometrySummary()` injected into `gatherSovereignContext()`, symbolic domain detection routes through sacred geometry engine, Noether agent enhanced with alignment/axiom data
- **Sandbox Prompt**: Enhanced with sacred geometry knowledge framework for external knowledge extraction grounding
- **API Routes**: `/api/sacred-geometry`, `/api/sacred-geometry/alignment`, `/api/sacred-geometry/numerology/:input`, `/api/sacred-geometry/summary`

## Key API Routes

- `/api/health` — System health
- `/api/meta/health-snapshot` — Combined sovereignty + eval health snapshot
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
- `/api/sovereign-infrastructure/dashboard` — Full infrastructure dashboard (mission, lattice, engines, vitals)
- `/api/world` — World state economics
- `/api/tsrt/full-market` — Token market data
- `/api/inventions/*` — Sovereign inventions CRUD
- `/api/swarm/*`, `/api/memory/*`, `/api/reasoning/*` — Agent systems

## Modal Remote Compute

Python-based serverless compute via Modal (`modal/` directory):
- **Python 3.12** installed with `modal` package (v1.4.1)
- **Authentication**: `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` environment secrets → run `modal token set --token-id "$MODAL_TOKEN_ID" --token-secret "$MODAL_TOKEN_SECRET"` to authenticate
- **Files**:
  - `modal/get_started.py` — Basic square/cube verification functions
  - `modal/tesseract_secret.py` — Reads "Tesseract" secret from Modal secret store
  - `modal/sovereign_compute.py` — Sacred mathematics engine (Fibonacci, numerology, sacred alignment) for remote execution
- **Usage**: `modal run modal/get_started.py`, `modal run modal/sovereign_compute.py`
- **Pattern**: Each file defines a `modal.App()` with `@app.function()` decorated functions and a `@app.local_entrypoint()` main

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
- Frontend has 11 consolidated tabs (Chat, Life, Entities, Voice, Nexus, Knowledge, Bible, Council, Economy, Forum, Sovereign) with ~130 feature pages lazy-loaded as embedded collapsible sections within each tab
