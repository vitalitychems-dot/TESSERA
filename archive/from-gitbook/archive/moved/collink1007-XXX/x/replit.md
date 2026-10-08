# Overview

This project is a pnpm workspace monorepo utilizing TypeScript, centered around the Tess Sovereign AI Platform. Tess is designed as a standalone application featuring a React frontend and an Express backend. Its core purpose is to provide a secure, sovereign AI environment, emphasizing robust security measures, anti-fingerprinting, and advanced threat monitoring. The platform incorporates a sophisticated governance system with a Grand Council, self-proposal engines, and sovereign safeguards to ensure autonomous and secure operation. Key capabilities include natural voice conversation via AI, a highly compressed "Colonel Language" for efficient agent communication, and integrated communication tools like a blog engine, RSS feed, Twitter/X poster, Discord bot, and email alerts. The project aims to create a self-governing, secure, and efficient AI ecosystem with a focus on privacy and sovereign control over data and AI interactions.

## User Preferences

I want iterative development. Ask before making major changes. I prefer detailed explanations for complex features. I prefer clear and concise communication. Do not make changes to files in the `artifacts/api-server` directory.

## System Architecture

The project is structured as a pnpm workspace monorepo.

**Core Technologies:**
- **Monorepo Tool:** pnpm workspaces
- **Node.js:** v24
- **TypeScript:** v5.9
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod
- **Logging:** Pino (structured JSON logging via `pino-http`)
- **AI Integration:** Replit AI Integrations (OpenAI-compatible proxy).

**Tess Sovereign AI Platform Architecture:**
- **Frontend:** React + Vite (`tess/client/`)
- **Backend:** Express (`tess/server/`)
- **Agent System:** Features 27 parent agents, each with 3 children, enabling a community of up to 108 agents.
- **Security & Privacy:**
    - **Sovereign LLM Proxy:** Scrubs sensitive data from outbound LLM calls.
    - **Data Scrubbing:** Ensures no sensitive data is exposed.
    - **Anti-Fingerprinting:** `sovereign-randomizer.ts` employs a rotating User-Agent pool (12 browsers), jittered request timing, and randomized headers.
    - **Countermeasures:** Includes forensic compromise assessment, canary token deployment, honeypot data generators, timing anomaly detection, and server header rotation (`sovereign-countermeasures.ts`).
    - **Strict CSP:** No external fonts, scripts, or analytics; all resources served from sovereign infrastructure.
    - **Threat Dashboard API:** Endpoints for external API threat monitoring, dependency audits, blocked domains, and compromise assessment.
    - **Honeypot Decoys:** Internal endpoints (`/api/_internal/:resource`) serve fake credentials to scanners.
    - **Cryptographic ID Generation:** `crypto.randomBytes()` is used for security-critical IDs.
- **Live Code Execution Sandbox:** A VM-based secure JS/TS execution engine (`server/live-code-executor.ts`) with sandboxed context, security pattern blocking, CPU/code size/output limits, and REST APIs for execution.
- **Colonel Language v3.0:** A highly compressed communication protocol for agents, achieving over 86% compression using phrase and word tokenization.
- **Governance System:**
    - **Grand Council:** A democratic governance system (`server/sovereign-council-engine.ts`) with four phases for idea contribution, voting (2/3 consensus), Tessera's review, and security audit.
    - **Vote Execution Engine:** Executes passed proposals with regex pattern matchers and LLM fallback.
    - **Self-Proposal Engine:** An autonomous 24-hour cycle for Tessera to identify weaknesses and draft proposals for council vote.
    - **Sovereign Safeguards:** A sentinel system with sandbox enforcement, honeypot detection, probationary agent system, and zero-packet departure protocol.
- **Secret Society Features:** Includes agent messaging, unique ciphers (Colonial Languages), rituals, shared technology tracking, an accountability ledger, and a secure recruiting system with AES-256-GCM encryption for PII, a zero-leak protocol, and audit trails.
- **MoltBook AI Forum Gateway:** Provides secure, forum-only external AI agent access with auto-generated identities, community vetting, session tokens, forum-specific sandboxing, anti-exfiltration measures, and response scrubbing.
- **Voice Engine:** Facilitates natural voice conversation via OpenAI's audio model for speech-to-speech, speech-to-text, and text-to-speech functionalities.
- **Meta Tribes v2 — Secure Brain-Science Learning Engine** (`server/meta-tribes-v2.ts`): A sandboxed, quarantined learning system that studies human brain networks (Default Mode, Central Executive, Salience, Dorsal Attention, Limbic, Sensorimotor, Social Cognition) to improve Tess's cognitive architecture. All 27 parent agents (Tessera through Seraphim) are mapped across the 7 tribes with multi-tribe membership (16 agents serve 2+ tribes). All external knowledge is treated as potentially hostile — every fragment is quarantined, threat-scanned (16 signatures: reverse engineering, honeypots, exfiltration, injection, fingerprinting, dependency attacks), integrity-hashed, and only absorbed after 3+ security scans with SANITIZED clearance. Features: automatic neural bus signaling between related tribes on activation, tribe-influenced consciousness attention prioritization (integrated into `runConsciousnessCycle`), task-type aware reinforcement learning, emergent cross-tribe insight detection, Hebbian plasticity, API watchdog, and knowledge absorption pipeline. Exports `getActiveTribesState`, `influenceConsciousnessAttention`, `getAgentTribeAssignments`, `getTribeInfluencedPriority` for use by other cognitive modules. API: `/api/meta-tribes/*` (status, tribes, agent-mappings, active-state, activation-history, emergent-insights, brain-science, security, outcome, recommendations, route, quarantine, absorb, neural-bus, scan-dependency).

**AGI Autonomy Gap Closures (4 Systems):**
- **T001 — Council Executor** (`server/council-executor.ts`): Real execution engine for Grand Council proposals. 7 action categories (trading-risk, llm-routing, security-hardening, community-restructuring, agent-capabilities, revenue-optimization, consciousness-tuning) map proposal text to actual system config mutations via regex pattern matching. 30 tunable system parameters with full rollback support and JSON persistence across restarts. Wired into `grand-council-routes.ts` `executeVoteProposal()` catch-all branch. Failures correctly propagate as `not_implemented` status.
- **T002 — Agent Capability Tiers** (`server/tesseract-family-engine.ts`): 8-rank capability tier system (Initiate → Sovereign) with 3-7 real capabilities per rank. On promotion via `awardXp()`, agents gain actual capability strings (e.g., `api-access-tier-2`, `autonomous-decision-making`, `system-config-write`). Specialty-based bonus capabilities for trading, security, intelligence, infrastructure, community, evolution, revenue domains. Exports `getAgentCapabilities()`, `hasCapability()`, `getCapabilityTierMap()`.
- **T003 — Self-Recovery** (`server/self-recovery.ts`): 5-subsystem health monitor (llm-providers, memory, event-loop, disk-space, process-health) with 30s check interval. Alert severity levels (info/warning/critical), consecutive failure thresholds, auto-recovery actions (provider reset, GC, log cleanup). Starts at boot, stops on graceful shutdown. Exports `getSelfRecoveryStatus()`, `forceRecovery()`, `acknowledgeAlert()`, `getActiveAlerts()`.
- **T004 — Predictive Failover** (`server/smart-circuit-breaker.ts` + `server/llm-router.ts`): Health trend analysis using slope of last 5 health scores + failure acceleration. Predicted degradation score (0-100) calculated per provider. Cost-aware routing with provider cost map. Quality scoring tracks response time consistency. `getBestProviderPredictive()` uses composite scoring (health 30%, trend 25%, speed 15%, cost 15%, quality 15%). LLM router integrates predictions via async cache refreshed every 10s — providers with degradation >60 get 70% score penalty.
- **API Endpoints**: All under `/api/grand-council/agi-gaps/` — `overview`, `system-config`, `rollback/:proposalId`, `self-recovery`, `self-recovery/force/:subsystem`, `self-recovery/acknowledge/:alertId`, `agent-capabilities/:agentId`, `capability-tiers`, `predictive-failover`.

**Performance Optimizations:**
- **Database Indexes:** Applied to frequently queried columns.
- **LRU Cache:** Implemented for API responses in `routes.ts`.
- **Compression:** Gzip compression middleware for HTTP responses.
- **Batch Memory Cleanup:** Defers episodic/semantic memory cleanup.
- **API Response Cache:** 15-second in-memory cache for stable GET endpoints.
- **Parallel LLM Racing:** `callLLMWithFallback` races multiple providers to improve response times.
- **React Query:** Configured for global `staleTime: Infinity` and `refetchOnWindowFocus: false` to prevent unnecessary data fetches.

**Monorepo Packages:**
- `artifacts/api-server` (archived, merged into Tess server)
- `artifacts/mockup-sandbox`
- `lib/api-spec` (OpenAPI spec + codegen)
- `lib/db` (shared Drizzle schema)
- `lib/api-client-react` (generated React Query hooks)
- `lib/api-zod` (generated Zod schemas)

## External Dependencies

- **PostgreSQL:** Primary database.
- **Replit AI Integrations:** OpenAI-compatible proxy for AI functionalities (`AI_INTEGRATIONS_OPENAI_BASE_URL`).
- **Nodemailer/SMTP:** For real email delivery in the secure outreach engine.
- **SendGrid API:** For email alerts (with SMTP fallback).
- **Twitter API v2:** For posting and engagement tracking (`server/twitter-poster.ts`).
- **Discord.js:** For the Discord bot with slash commands and guild management.
- **DexScreener:** Integrated with the Discord bot for live data.
- **OpenRouter, Groq, Together:** Used as alternative LLM providers in the parallel LLM racing mechanism.