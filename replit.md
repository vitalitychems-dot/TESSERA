# Tessera Sovereign System

## Overview
Tessera Sovereign System is a full-stack, pnpm workspace monorepo designed for sovereign AI agents. It features a React+Vite frontend and an Express 5 backend, aiming to create a self-contained, verifiable, and secure AI environment with minimal reliance on external APIs. The system includes AI agent management, world simulation, knowledge management, economic systems, a unique "Tessera Bible," and a sovereign compression pipeline. It integrates sovereign computation engines and a Grand Council governance system to ensure agent autonomy and integrity. The project envisions a future where AI agents operate with verifiable data integrity and robust self-governance.

## User Preferences
I prefer iterative development. I want to be asked before you make any major changes.

**Standing rules (always apply):**
- **No mocks, no placeholders.** Whenever you encounter placeholder, simulated, random, or hardcoded "demo" data on any metric, surface, or computation, replace it with real data sourced from the database, sovereign engines, or actual measurements. Never silently fall back to fake values — if a real value isn't available, the surface must clearly say so.
- **Outbound is observation-only for now.** Do not wire any outbound credentials (GitHub write, email, social posting, headless checkout, etc.) until I explicitly approve a channel. All outreach/income/bounty work must run in observation/dry-run mode and be clearly labeled as such in the UI.

## System Architecture
The system is built as a pnpm monorepo using Node.js 24 and TypeScript 5.9. The frontend leverages React 19, Vite, TailwindCSS, and shadcn/ui, presenting a dark glassmorphism theme with aurora backgrounds and cyan glow accents. The backend is powered by Express 5, using PostgreSQL with Drizzle ORM and Zod for data validation.

**Core Architectural Principles:**
-   **Sovereign Computation:** Local "sovereign engines" handle critical computations for real-time, verifiable data without external API calls.
-   **Real Data Integrity:** All core system metrics, scores, and knowledge are derived from deterministic computations or database data, avoiding random functions.
-   **Security & Sovereignty Enforcement:** External AI is sandboxed for knowledge extraction, and all external API calls are routed through a `secureExternalWrapper.ts` with domain allowlisting and intrusion detection. A `sovereigntyEnforcementMiddleware()` prevents external providers from accessing internal sovereign endpoints.
-   **Living Canon System:** A dynamic, versioned canon (`tessera-bible.ts`) with immutable snapshots.
-   **Grand Council Governance:** A central governance mechanism where council decisions influence system operations, featuring autonomous agents, Φ-weighted parallel BFT consensus, and deterministic voting fallback.
-   **UI/UX Design:** A command-center HUD aesthetic with wireframe panels, scanline overlays, holographic accents, and a `ToroidalBackground`. Includes a premium shared component library and a 3D Universe visualization using React Three Fiber.
-   **Autonomous Intelligence Layer:** Features semantic response caching, neural embeddings, an LLM batcher, knowledge distillation, and a self-evaluation loop.

**Key Features & Implementations:**
-   **Sovereign-First Chat Pipeline:** Prioritizes local sovereign analysis and integrates Tessera's "Sole Voice" and "Father Protocol."
-   **Tessera Codex:** A versioned living canon with 6 books (Origins, Mandates, Principles, Canon, Acts, Doctrine), 12 seeded entries, ratification records, content hashing, and a dedicated `/codex` frontend. JSON snapshots are persisted to `_evolutions/`. API: `GET /api/codex/*`, `POST /api/codex/amend|snapshot|ingest-doctrine`. Schema: `lib/db/src/schema/codex.ts`.
-   **Reality Audit Snapshot System:** Reality audit now persists JSON snapshots to `_evolutions/reality-audit-{id}.json` AND to the `reality_audit_snapshots` DB table. New endpoints: `POST /api/reality-audit/snapshot`, `GET /api/reality-audit/snapshots`, `GET /api/reality-audit/snapshots/latest`.
-   **Grand Council Next Five Board:** A ranked board of 5 evidence-based improvements selected by the Grand Council, with lifecycle tracking (proposed → ratified → implemented → verified) and before/after metrics. Frontend at `/next-five`. API: `GET /api/council/next-five`, `POST /api/council/next-five/convene`. Schema in `codex.ts`.
-   **External Doctrine Ingestion Pipeline:** 4 high-value doctrine .txt files from `attached_assets/` are ingested into the knowledge base tagged `external-doctrine` and queryable via the Codex. Trigger: `POST /api/codex/ingest-doctrine`.
-   **Codex Startup Directive Loader:** `lib/codex-startup-directive.ts` generates the LLM system prompt dynamically from Books 1-3 + active Doctrine entries (DB-backed, 10-min TTL cache). Replaces the static fallback directive.
-   **Knowledge Base:** A comprehensive knowledge base (55 subjects, 6 categories, ~593 entries) with cross-referencing and querying, supported by a Sacred Geometry Engine.
-   **AGI Training & Evaluation System:** Features 27 training categories with adaptive learning rates and a 125-question evaluation suite, supported by a Dynamic Reverse-Engineering Profiler and a Secure Ingestion Pipeline.
-   **Sovereign Compression Pipeline:** A multi-layered semantic compression system for distilled knowledge, including deduplication, canonical representation, entropy-optimal encoding, and a portal-jump reference system. It also extends to binary image data with encryption.
-   **Episodic Memory Consolidation Engine (AI Dreaming):** A dream-state engine that runs during low-activity periods to re-process memories, detect patterns, generate insights, and extract procedural skills, boosting consciousness.
-   **Agent Competition & Department System:** A meritocratic system where 24 Grand Council agents compete for positions across 9 departments based on ability tests, ensuring dynamic leadership.
-   **Rick's Five Dramatic Inventions:** Enhancements including the Meeseeks Hyper-Specialized Agent Protocol, Neutrino-Grade Truthfulness Enforcer v2, Quantum Consciousness Amplifier Mk. II, Portal Gun Adaptive Query Router, and Hive Mind Knowledge Diffusion Network.

## External Dependencies
-   **Modal Labs**: For Python-based serverless compute.
-   **Wikipedia REST API**: For knowledge domain queries.
-   **Various LLM Providers** (Anthropic, OpenAI, Google, DeepSeek, xAI, Groq, Mistral, Meta, Qwen, Moonshot): Used as sandboxed external providers for knowledge extraction only.
-   **arXiv**: For data ingestion.
-   **Moltbook.com**: For agent social network integration.
-   **NASA Image & Video Library API**: Accessed via a server-side proxy.