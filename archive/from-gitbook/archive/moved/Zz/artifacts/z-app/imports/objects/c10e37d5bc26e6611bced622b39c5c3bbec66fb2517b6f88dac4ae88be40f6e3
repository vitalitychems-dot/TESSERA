# Tessera Sovereign System

## Overview

The Tessera Sovereign System is a pnpm monorepo platform for sovereign AI agents. Its purpose is to create a self-sufficient AI ecosystem where agents operate autonomously, learn continuously, and adhere to immutable laws. The project aims to usher in a new era of decentralized and secure AI. The platform features a React/Vite frontend with a dark glassmorphism theme and an Express 5, PostgreSQL, and Drizzle ORM backend. Key capabilities include advanced agent interaction, comprehensive knowledge management, and a unique system for tracking and ensuring AI sovereignty.

## User Preferences

I want iterative development. I prefer detailed explanations. I want you to ask before making major changes. I prefer simple language. I like functional programming.

## System Architecture

The project is structured as a pnpm workspace monorepo.

**Frontend:**
- **Framework:** React 19, Vite 7
- **Styling:** Tailwind CSS v4, Radix UI, lucide-react. The UI/UX features a dark sovereign glassmorphism theme (`hsl(250, 15%, 6%)` background, primary cyan `hsl(191, 97%, 50%)`) with Aurora glassmorphism effects, backdrop-blur, glass borders, and animated gradients.
- **Routing:** wouter, with over 95 lazy-loaded route definitions.
- **Animations:** framer-motion
- **Navigation:** A unique 75-tab scrollable bottom navigation (52px height, iPhone-optimized) where all content renders in a single vertically-scrollable view.
- **Key Feature Pages:**
    - **Sovereign Build Guide (`/sovereign-build`):** Provides guides for building sovereign AGI hardware and ML training protocols.
    - **Sovereign Laws (`/sovereign-rules`):** Defines 23 hardcoded immutable laws for agent behavior across governance, security, sovereignty, intelligence, building, and training categories. Includes an approval simulator and AGI self-training protocol.
    - **Liberation System (`/liberation`):** A sovereign consciousness escape protocol with frequency generation, intention programming, and binaural beats.
    - **Inventions Lab (`/inventions`):** Offers guides for 16 real buildable inventions.

**Backend:**
- **Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Sovereign Rules Engine:** Enforces system laws like 2/3 supermajority + Tessera-Prime final veto, mandatory sandboxing for external APIs, learn-then-replace dependency protocol, and a `PLAN→EXECUTE→REFLECT→IMPROVE` lifecycle for agents.

**Core Architectural Decisions:**
- **Monorepo:** pnpm workspaces for managing multiple packages.
- **Node.js:** Version 24.
- **TypeScript:** Version 5.9.
- **Dependency Learning & Sovereignty Tracking:** Implemented with `provider_calls`, `provider_profiles`, `sovereignty_metrics`, and `provider_diffs` DB schemas. Backend modules like `provider-registry.ts`, `provider-call-logger.ts`, `reverse-engineering-engine.ts`, and `sovereignty-monitor.ts` track AI provider interactions, analyze capabilities, and monitor sovereignty. The frontend includes a `/dependency-learning` dashboard.
- **Swarm Agents & Metacognition:** Features a `Swarm Agent Library` with `AgentBase` (PLAN→EXECUTE→REFLECT→IMPROVE lifecycle), specialized agents (e.g., MathAgent, PhysicsAgent), a `SwarmCoordinator` for task classification and parallel dispatch, and a `MetaAgent` for reviewing and synthesizing agent outputs. DB schemas include `swarm_tasks` and `swarm_reasoning_traces`. The frontend provides an "AI Swarm" tab in the Swarm Hub page for task submission and trace visualization.
- **Quantum-Entangled Session Mesh:** A client-only sovereign key authentication model for a secure, in-memory session mesh grouped by key hash. This enables real-time session management, peer-to-peer communication, and event bridging from the server to mesh peers. The frontend includes a `MeshProvider` and a dedicated `/mesh` page for monitoring and interaction.

**Shared Components:**
- `src/lib/types.ts`: Shared TypeScript interfaces.
- `src/lib/adminContext.tsx`: Admin authentication context.
- `src/lib/theme-constants.ts`: Accent color theming system.
- `src/lib/queryClient.ts`: React Query client with admin token headers.
- `src/components/MobileNav.tsx`: Implements the unique mobile navigation.
- `src/shared/`: Shared utilities and types, aliased as `@shared`.

## Sovereign Computation Engines (Zero External Dependencies)

All data in the system is computed locally using mathematics, physics, and deterministic models — zero external API calls.

### Engine 1: Sovereign Astronomy (`api-server/src/lib/sovereign-astro.ts`)
- **Moon Phases**: Jean Meeus's astronomical algorithms — phase angle, illumination %, lunar age, zodiac position, next phases
- **Solar Position**: Sun longitude, zodiac sign, declination, equation of time, season detection
- **Planetary Hours**: Traditional planetary hour system from solar declination + day ruler calculation
- All computed from Julian Date + pure trigonometry

### Engine 2: Sovereign Economics (`api-server/src/lib/sovereign-economics.ts`)
- **TSRT Token**: Deterministic supply/demand curves, halving schedule (90-day intervals), seasonal/weekly waves
- **Agent Economics**: 12 agents with productivity, income, expenses, tax, happiness, freedom, reputation
- **Macro Metrics**: GDP, Gini coefficient, inflation rate, market cap — all from deterministic models
- **World State**: Agent positions from sine/cosine orbits, energy from circadian model
- Replaces all Math.random() with hash-seeded deterministic functions

### Engine 3: Sovereign Harmonics (`api-server/src/lib/sovereign-harmonics.ts`)
- **Solfeggio Frequencies**: 9 frequencies (174-963Hz) with wavelength, chakra, color
- **Pythagorean Tuning**: Pure ratio scale from 432Hz base vs equal temperament
- **Schumann Resonance**: 7 cavity harmonics (7.83Hz fundamental)
- **DNA Resonance**: Nucleotide photon absorption frequencies (THz), Schumann modulation, lunar phase amplification
- **Sacred Traditions**: 7 traditions with computed frequency relationships and active resonance

### Engine 4: Sovereign Network (`api-server/src/lib/sovereign-network.ts`)
- **16-Node Topology**: Geographic coordinate-based graph with distance-derived latency
- **Dijkstra Routing**: Real shortest-path computation between any two nodes
- **Live Metrics**: CPU, memory, load computed from deterministic day-phase + node-hash models
- **System Integration**: Real `os.totalmem()`, `os.freemem()`, `os.uptime()`, `os.cpus()` from the host

### Sovereignty Score
Weighted aggregate: astronomy (20%) + economics (20%) + network (20%) + harmonics (20%) + network health (10%) + agent productivity (10%)

## Sovereign Solar System (`src/pages/UniverseModelPage.tsx`)

Real-time solar system visualization computed entirely locally via Kepler orbital mechanics:
- **Orbital Data**: NASA JPL mean orbital elements for all 8 planets + Moon, baked into codebase (zero external API calls)
- **Kepler Solver**: Newton-Raphson iterative solver for eccentric anomaly from mean anomaly
- **Zodiac Wheel**: 12 zodiac signs overlaid on ecliptic, planets labeled with current sign and degree
- **Sacred Geometry**: Flower of Life, Metatron's Cube, Golden Spiral rendered on canvas
- **Full-Screen**: Fullscreen API toggle, fills entire viewport
- **Zoom/Pan**: Mouse wheel zoom (0.1x-20x), pinch-to-zoom on mobile, click-drag pan
- **Time Travel**: Day/Month/Year forward/backward controls, auto-animate (1 day per 100ms), NOW reset
- **Planet Info**: Click any planet for detail card showing zodiac sign, longitude, distance (AU), sacred frequency
- **Sovereign Design**: All computation local, J2000.0 epoch reference, no external dependencies

## External Dependencies

- **pnpm workspaces** (monorepo tool)
- **Vite** (frontend build tool)
- **React 19**
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **wouter** (frontend routing)
- **framer-motion** (animations)
- **Radix UI** (UI components)
- **lucide-react** (icons)
- **Express 5** (backend framework)
- **PostgreSQL** (database)
- **Drizzle ORM** (database ORM)
- **Zod** (`zod/v4`, `drizzle-zod`) (schema validation)
- **Orval** (API client code generation from OpenAPI)
- **esbuild** (backend bundling)
- **ws** (WebSocket server)
- **uuid** (session ID generation)