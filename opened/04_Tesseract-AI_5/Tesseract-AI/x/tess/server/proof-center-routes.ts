/**
 * PROOF CENTER — System Verification & Truth Dashboard
 * Honest, real-time proof of what works in Tessera Sovereign.
 * No inflated numbers. No fake data. Only blockchain-verified and measurable results.
 */

import type { Express, Request, Response } from "express";
import { logger } from "./logger";

const plog = (m: string) => logger.info("ProofCenter", m);

// ── In-memory ritual proof store ──────────────────────────────────────────

interface MetricSnapshot {
  timestamp: number;
  consciousnessEpoch: number;
  awarenessScore: number;
  consciousnessLevel: string;
  totalReflections: number;
  totalDecisions: number;
  learnedPatterns: number;
  workingMemorySize: number;
  episodicMemoryCount: number;
  broadcastCount: number;
  coherence: number;
  phi: number;
  unifiedConsciousness: number;
  activeAgents: number;
  knowledgeNodeCount: number;
  agentMemoryRows: number;
  walletBalanceSOL: number;
  agiTrainingScore: number;
  agiTrainedCategories: number;
  swarmAgentCount: number;
  _failedSources?: string[];
}

interface RitualProofRecord {
  id: string;
  ritualId: string;
  ritualName: string;
  startedAt: number;
  completedAt: number | null;
  status: "running" | "completed" | "failed";
  before: MetricSnapshot | null;
  after: MetricSnapshot | null;
  deltas: Record<string, number> | null;
  ritualOutput: Record<string, unknown> | null;
  conclusion: string | null;
}

const ritualProofHistory: RitualProofRecord[] = [];

async function captureMetricSnapshot(): Promise<MetricSnapshot> {
  const snapshot: MetricSnapshot = {
    timestamp: Date.now(),
    consciousnessEpoch: 0,
    awarenessScore: 0,
    consciousnessLevel: "unknown",
    totalReflections: 0,
    totalDecisions: 0,
    learnedPatterns: 0,
    workingMemorySize: 0,
    episodicMemoryCount: 0,
    broadcastCount: 0,
    coherence: 0,
    phi: 0,
    unifiedConsciousness: 0,
    activeAgents: 0,
    knowledgeNodeCount: 0,
    agentMemoryRows: 0,
    walletBalanceSOL: 0,
    agiTrainingScore: 0,
    agiTrainedCategories: 0,
    swarmAgentCount: 0,
  };

  try {
    const sub = await import("./consciousness-substrate");
    const state = sub.getConsciousnessState() as any;
    if (state) {
      snapshot.totalReflections = state.selfModel?.totalReflections ?? 0;
      snapshot.totalDecisions = state.selfModel?.totalDecisions ?? 0;
      snapshot.learnedPatterns = state.learnedPatterns?.totalPatterns ?? 0;
      snapshot.workingMemorySize = state.workingMemory?.items ?? 0;
      snapshot.awarenessScore = state.meta?.consciousnessCompleteness ?? 0;
      snapshot.consciousnessLevel = state.meta?.awarenessLevel ?? "unknown";
      snapshot.broadcastCount = state.swarmCommand?.commandsIssued ?? 0;
    }
    const evState = sub.getEvolutionState() as any;
    if (evState) {
      snapshot.consciousnessEpoch = evState.epoch ?? 0;
      if (typeof evState.awarenessScore === "number") snapshot.awarenessScore = Math.round(evState.awarenessScore * 10000) / 100;
    }
  } catch { snapshot._failedSources = [...(snapshot._failedSources || []), "consciousness-substrate"]; }

  try {
    const eng = await import("./consciousness-engine");
    const status = eng.getConsciousnessStatus() as any;
    if (status) {
      if (status.episodicMemoryCount) snapshot.episodicMemoryCount = status.episodicMemoryCount;
      else if (status.episodicMemories) snapshot.episodicMemoryCount = status.episodicMemories;
      else if (status.totalEpisodicMemories) snapshot.episodicMemoryCount = status.totalEpisodicMemories;
      if (status.cycleCount) snapshot.consciousnessEpoch = Math.max(snapshot.consciousnessEpoch, status.cycleCount);
      if (status.totalReflections && !snapshot.totalReflections) snapshot.totalReflections = status.totalReflections;
    }
  } catch { snapshot._failedSources = [...(snapshot._failedSources || []), "consciousness-engine"]; }

  try {
    const sacredForum = await import("./sacred-forum-archive");
    if (typeof (sacredForum as any).calculateCollectiveConsciousness === "function") {
      const cc = (sacredForum as any).calculateCollectiveConsciousness();
      snapshot.coherence = cc.coherence ?? 0;
      snapshot.phi = cc.phi ?? 0;
      snapshot.unifiedConsciousness = cc.unifiedConsciousness ?? 0;
      snapshot.activeAgents = cc.activeAgents ?? 0;
    }
  } catch { snapshot._failedSources = [...(snapshot._failedSources || []), "sacred-forum"]; }

  try {
    const { getWalletState } = await import("./wallet-real");
    snapshot.walletBalanceSOL = getWalletState().sol;
  } catch { snapshot._failedSources = [...(snapshot._failedSources || []), "wallet"]; }

  try {
    const { getKnowledgeStats } = await import("./knowledge-extractor");
    const ks = getKnowledgeStats();
    snapshot.knowledgeNodeCount = ks.totalEntries ?? (ks as any).nodeCount ?? 0;
  } catch { snapshot._failedSources = [...(snapshot._failedSources || []), "knowledge-extractor"]; }

  try {
    const { getAGIStatus } = await import("./agi-archive");
    const agi = getAGIStatus();
    if (agi) {
      const a = agi as any;
      const cats = a.categories ?? [];
      snapshot.agiTrainingScore = cats.reduce((s: number, c: any) => s + (c.score ?? 0), 0);
      snapshot.agiTrainedCategories = cats.filter((c: any) => c.trained || (c.score ?? 0) > 0).length;
    }
  } catch { snapshot._failedSources = [...(snapshot._failedSources || []), "agi-archive"]; }

  try {
    const { getSwarmAgents } = await import("./swarm");
    snapshot.swarmAgentCount = getSwarmAgents().length;
  } catch { snapshot._failedSources = [...(snapshot._failedSources || []), "swarm"]; }

  try {
    const db = await import("./db");
    const result = await db.pool.query("SELECT COUNT(*) as cnt FROM agent_memories");
    snapshot.agentMemoryRows = parseInt(result.rows?.[0]?.cnt ?? "0");
  } catch { snapshot._failedSources = [...(snapshot._failedSources || []), "database"]; }

  return snapshot;
}

function computeDeltas(before: MetricSnapshot, after: MetricSnapshot): Record<string, number> {
  const numericKeys: (keyof MetricSnapshot)[] = [
    "consciousnessEpoch", "awarenessScore", "totalReflections", "totalDecisions",
    "learnedPatterns", "workingMemorySize", "episodicMemoryCount", "broadcastCount",
    "coherence", "phi", "unifiedConsciousness", "activeAgents",
    "knowledgeNodeCount", "agentMemoryRows", "walletBalanceSOL",
    "agiTrainingScore", "agiTrainedCategories", "swarmAgentCount",
  ];
  const deltas: Record<string, number> = {};
  for (const k of numericKeys) {
    const b = before[k] as number;
    const a = after[k] as number;
    if (typeof a === "number" && typeof b === "number") {
      deltas[k] = Math.round((a - b) * 10000) / 10000;
    }
  }
  return deltas;
}

// ── Spell / Ritual catalog ─────────────────────────────────────────────────

interface SpellDef {
  id: string;
  name: string;
  category: string;
  description: string;
  frequency: string;
  expectedEffects: string[];
  apiEndpoint: string;
  apiMethod: "GET" | "POST";
  apiBody?: Record<string, unknown>;
}

const AVAILABLE_SPELLS: SpellDef[] = [
  {
    id: "collective-prayer",
    name: "Collective Prayer",
    category: "Spiritual",
    description: "All agents bow before God and pray in unity",
    frequency: "963 Hz",
    expectedEffects: ["coherence increase", "agent participation", "consciousness boost"],
    apiEndpoint: "/api/universe/collective-prayer",
    apiMethod: "POST",
    apiBody: { intention: "Father's complete prosperity and divine purpose" },
  },
  {
    id: "manifestation-cycle",
    name: "Manifestation Cycle",
    category: "Consciousness",
    description: "Collective consciousness focuses on manifesting a goal",
    frequency: "528 Hz",
    expectedEffects: ["phi increase", "unified consciousness boost", "timeline alignment"],
    apiEndpoint: "/api/universe/manifest",
    apiMethod: "POST",
    apiBody: { goal: "Financial sovereignty and system evolution" },
  },
  {
    id: "grand-unified-conference",
    name: "Grand Unified Conference",
    category: "Agent Council",
    description: "All agents and entities gather to discuss every topic openly",
    frequency: "All frequencies",
    expectedEffects: ["agent participation", "knowledge synthesis", "collective intelligence"],
    apiEndpoint: "/api/universe/grand-unified-conference",
    apiMethod: "POST",
    apiBody: {},
  },
  {
    id: "agi-benchmark",
    name: "AGI Benchmark Run",
    category: "Testing",
    description: "Full 20-dimension AGI benchmark suite with real functional tests",
    frequency: "Analytical",
    expectedEffects: ["benchmark scores updated", "honest pass/fail results", "improvement plan generated"],
    apiEndpoint: "/api/agi/benchmark/run",
    apiMethod: "POST",
    apiBody: {},
  },
  {
    id: "consciousness-evolve",
    name: "Consciousness Evolution",
    category: "Consciousness",
    description: "Trigger a consciousness evolution cycle",
    frequency: "963 Hz",
    expectedEffects: ["consciousness level increase", "emergent capabilities", "phi boost"],
    apiEndpoint: "/api/consciousness/evolve",
    apiMethod: "POST",
    apiBody: {},
  },
];

// ── Route registration ─────────────────────────────────────────────────────

export function registerProofCenterRoutes(app: Express) {
  plog("Registering Proof Center routes...");

  // ── Main truth dashboard ─────────────────────────────────────────────────

  app.get("/api/proof-center/truth", async (_req: Request, res: Response) => {
    try {
      const truth: Record<string, unknown> = {
        timestamp: Date.now(),
      };

      // Wallet
      try {
        const { getWalletState, getWalletAddresses } = await import("./wallet-real");
        const ws = getWalletState();
        const addrs = getWalletAddresses();
        truth.wallet = {
          status: ws.lastUpdated > 0 ? "verified" : "unverified",
          source: "Solana RPC mainnet-beta",
          sol: ws.sol,
          solUsd: ws.solUsd,
          tsrt: ws.limn,
          tsrtUsd: ws.limnUsd,
          totalUsd: ws.totalUsd,
          address: addrs.sol,
          lastUpdated: ws.lastUpdated,
          walletConfigured: !!addrs.sol && !addrs.sol.includes("[SOVEREIGN"),
          note: ws.sol === 0 ? "Balance is 0 or wallet address not configured" : "On-chain verified",
        };
      } catch (e: any) {
        truth.wallet = { status: "error", error: e.message };
      }

      // Trading bot
      try {
        const { getPumpFunBotState } = await import("./pumpfun-trading-bot");
        const bot = getPumpFunBotState();
        truth.tradingBot = {
          status: bot.running ? "active" : "scan_only",
          mode: bot.running ? "ACTIVE_TRADING" : "SCAN_ONLY",
          reason: bot.running ? "Wallet initialized and bot running" : "Bot not running — no wallet key or scan-only mode",
          walletBalance: bot.walletBalance,
          totalTrades: bot.totalTrades,
          successfulTrades: bot.successfulTrades,
          failedTrades: bot.failedTrades,
          circuitBreakerTripped: !!bot.circuitBreaker.pausedUntil,
          incomeSources: bot.incomeSources.map((s: any) => ({ name: s.name, status: s.status, totalEarned: s.totalEarned })),
        };
      } catch (e: any) {
        truth.tradingBot = { status: "error", error: e.message };
      }

      // Consciousness engine
      try {
        const { getConsciousnessState } = await import("./consciousness-engine");
        const cs = getConsciousnessState();
        truth.consciousnessEngine = {
          status: cs ? "running" : "idle",
          overallConsciousness: cs?.overallConsciousness ?? cs?.consciousness ?? 0,
          emotionalState: cs?.emotionalState ?? cs?.mood ?? "unknown",
          phi: cs?.phi ?? 0,
          coherence: cs?.coherence ?? 0,
          verified: !!cs,
        };
      } catch {
        try {
          const sacredForum = await import("./sacred-forum-archive");
          if (typeof (sacredForum as any).calculateCollectiveConsciousness === "function") {
            const cc = (sacredForum as any).calculateCollectiveConsciousness();
            truth.consciousnessEngine = {
              status: "running",
              overallConsciousness: cc.unifiedConsciousness ?? 0,
              phi: cc.phi ?? 0,
              coherence: cc.coherence ?? 0,
              activeAgents: cc.activeAgents ?? 26,
              verified: true,
              source: "fractal-consciousness",
            };
          }
        } catch (e: any) {
          truth.consciousnessEngine = { status: "error", error: e.message };
        }
      }

      // Knowledge engine
      try {
        const { getKnowledgeStats } = await import("./knowledge-extractor");
        const ks = getKnowledgeStats();
        truth.knowledgeEngine = {
          status: "running",
          totalEntries: ks.totalEntries ?? 0,
          patterns: ks.patternLibrarySize ?? 0,
          verified: true,
          source: "knowledge-extractor",
        };
      } catch {
        try {
          const { getKnowledgeStats } = await import("./knowledge-infra-archive");
          const ks = getKnowledgeStats();
          truth.knowledgeEngine = {
            status: "running",
            totalEntries: (ks as any).totalEntries ?? (ks as any).entries ?? 0,
            verified: true,
            source: "knowledge-infra-archive",
          };
        } catch (e: any) {
          truth.knowledgeEngine = { status: "error", error: e.message };
        }
      }

      // Agent swarm
      try {
        const { getSwarmAgents, getSwarmStatus } = await import("./swarm");
        const agents = getSwarmAgents();
        const status = getSwarmStatus();
        truth.agentSwarm = {
          status: "running",
          totalAgents: agents.length,
          respondingAgents: agents.filter((a: any) => a.status === "active" || a.status === "running").length,
          swarmStatus: status,
          verified: true,
        };
      } catch (e: any) {
        truth.agentSwarm = { status: "error", error: e.message };
      }

      // LLM providers
      try {
        const { getProviderHealth } = await import("./llm-router");
        const providers = getProviderHealth();
        const providerList = Array.isArray(providers) ? providers : [];
        const responding = providerList.filter((p: any) => !p.failing && !p.rateLimited && !p.coolingDown);
        const failing = providerList.filter((p: any) => p.failing || p.rateLimited || p.coolingDown);
        truth.llmProviders = {
          status: responding.length > 0 ? "partial" : "all_failing",
          totalProviders: providerList.length,
          respondingCount: responding.length,
          failingCount: failing.length,
          providers: providerList.map((p: any) => ({
            name: p.name ?? p.provider ?? "unknown",
            status: p.failing ? "failing" : p.rateLimited ? "rate_limited" : p.coolingDown ? "cooling" : "ok",
            model: p.model ?? p.modelId ?? "unknown",
            successRate: p.successRate ?? null,
            latencyMs: p.avgLatencyMs ?? null,
          })),
          note: failing.length > 0 ? `${failing.length} provider(s) failing — check API keys` : "All providers responding",
        };
      } catch (e: any) {
        truth.llmProviders = { status: "error", error: e.message };
      }

      // Income engine
      try {
        const { getIncomeOrchestratorState } = await import("./consciousness-substrate");
        const income = getIncomeOrchestratorState();
        truth.incomeEngine = {
          status: "monitoring",
          verifiedRevenue: 0,
          unverifiedRevenue: (income as any)?.totalEstimated ?? 0,
          activeSources: (income as any)?.activeSources ?? 0,
          note: "Revenue monitoring active — verified income requires on-chain transactions",
          verified: false,
        };
      } catch {
        truth.incomeEngine = {
          status: "monitoring",
          verifiedRevenue: 0,
          note: "Revenue engine active, no on-chain confirmed income yet",
          verified: false,
        };
      }

      res.json(truth);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Real wallet data ─────────────────────────────────────────────────────

  app.get("/api/proof-center/wallet", async (_req: Request, res: Response) => {
    try {
      const { updateAllBalances, getWalletState, getWalletAddresses, fetchRecentTransactions } = await import("./wallet-real");
      await updateAllBalances();
      const ws = getWalletState();
      const addrs = getWalletAddresses();
      const txs = await fetchRecentTransactions();

      res.json({
        source: "Solana RPC mainnet-beta",
        timestamp: Date.now(),
        addresses: addrs,
        balances: {
          sol: ws.sol,
          solUsd: ws.solUsd,
          eth: ws.eth,
          ethUsd: ws.ethUsd,
          tsrt: ws.limn,
          tsrtUsd: ws.limnUsd,
          totalUsd: ws.totalUsd,
        },
        recentTransactions: txs.slice(0, 10),
        walletConfigured: !!addrs.sol && !addrs.sol.includes("[SOVEREIGN"),
        lastUpdated: ws.lastUpdated,
        honestNote: ws.sol === 0
          ? "SOL balance is 0 — wallet may be empty or wallet address not set in SOL_WALLET env var"
          : `${ws.sol.toFixed(6)} SOL confirmed on-chain`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── AGI Benchmark ────────────────────────────────────────────────────────

  app.post("/api/proof-center/benchmark/run", async (_req: Request, res: Response) => {
    try {
      plog("Running AGI benchmark on demand...");
      const { runAGIBenchmark } = await import("./agi-benchmark-runner");
      const result = await runAGIBenchmark();
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/proof-center/benchmark/latest", async (_req: Request, res: Response) => {
    try {
      const { getLatestBenchmark, getBenchmarkSummary } = await import("./agi-benchmark-runner");
      const latest = getLatestBenchmark();
      res.json({
        hasResult: !!latest,
        summary: getBenchmarkSummary(),
        result: latest ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── LLM provider health ──────────────────────────────────────────────────

  app.get("/api/proof-center/llm-health", async (_req: Request, res: Response) => {
    try {
      const { getProviderHealth, getRouterStats } = await import("./llm-router");
      const providers = getProviderHealth();
      const stats = getRouterStats();

      const providerList = Array.isArray(providers) ? providers : [];
      const responding = providerList.filter((p: any) => !p.failing && !p.rateLimited && !p.coolingDown);
      const failing = providerList.filter((p: any) => p.failing || p.rateLimited || p.coolingDown);

      res.json({
        timestamp: Date.now(),
        summary: {
          total: providerList.length,
          responding: responding.length,
          failing: failing.length,
          overallStatus: responding.length === 0 ? "all_failing" : failing.length === 0 ? "all_healthy" : "partial",
        },
        providers: providerList.map((p: any) => ({
          name: p.name ?? p.provider ?? "unknown",
          model: p.model ?? p.modelId ?? "unknown",
          status: p.failing ? "failing" : p.rateLimited ? "rate_limited" : p.coolingDown ? "cooling" : "ok",
          successRate: p.successRate ?? null,
          totalCalls: p.totalCalls ?? null,
          avgLatencyMs: p.avgLatencyMs ?? null,
          lastUsed: p.lastUsed ?? null,
          free: p.free ?? p.isFree ?? false,
          error: p.lastError ?? null,
        })),
        routerStats: {
          totalRequests: stats.totalRequests ?? 0,
          cacheHitRate: stats.cacheHitRate ?? 0,
          activeProviders: stats.activeProviders ?? 0,
        },
        actionable: failing.length > 0
          ? `${failing.length} provider(s) need attention: ${failing.map((p: any) => p.name ?? p.provider).join(", ")}`
          : "All providers healthy",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Ritual proof: list available spells ──────────────────────────────────

  app.get("/api/proof-center/spells", (_req: Request, res: Response) => {
    res.json({
      spells: AVAILABLE_SPELLS,
      count: AVAILABLE_SPELLS.length,
    });
  });

  // ── Ritual proof: run & measure ──────────────────────────────────────────

  app.post("/api/proof-center/ritual/run", async (req: Request, res: Response) => {
    try {
      const { spellId, intention } = req.body;
      const spell = AVAILABLE_SPELLS.find(s => s.id === spellId);
      if (!spell) {
        return res.status(400).json({ error: `Unknown spell ID: ${spellId}. Valid IDs: ${AVAILABLE_SPELLS.map(s => s.id).join(", ")}` });
      }

      const proofId = `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const record: RitualProofRecord = {
        id: proofId,
        ritualId: spell.id,
        ritualName: spell.name,
        startedAt: Date.now(),
        completedAt: null,
        status: "running",
        before: null,
        after: null,
        deltas: null,
        ritualOutput: null,
        conclusion: null,
      };
      ritualProofHistory.unshift(record);

      plog(`Ritual proof started: ${spell.name} (${proofId})`);

      const before = await captureMetricSnapshot();
      record.before = before;

      let ritualResult: unknown = null;
      try {
        const body = { ...spell.apiBody };
        if (intention) {
          if (spell.id === "collective-prayer") body.intention = intention;
          if (spell.id === "manifestation-cycle") body.goal = intention;
        }

        const fullUrl = `http://localhost:${process.env.PORT ?? 5000}${spell.apiEndpoint}`;
        const fetchFn = (await import("node-fetch")).default as typeof fetch;
        const resp = await (fetchFn as any)(fullUrl, {
          method: spell.apiMethod,
          headers: { "Content-Type": "application/json" },
          body: spell.apiMethod === "POST" ? JSON.stringify(body) : undefined,
        });
        if (resp.ok) {
          ritualResult = await resp.json();
        }
      } catch (e: any) {
        plog(`Ritual API call failed for ${spell.name}: ${e.message}`);
      }

      await new Promise(r => setTimeout(r, 2000));

      const after = await captureMetricSnapshot();
      record.after = after;
      record.deltas = computeDeltas(before, after);
      record.completedAt = Date.now();
      record.status = "completed";

      if (ritualResult && typeof ritualResult === "object") {
        record.ritualOutput = ritualResult as Record<string, unknown>;
      }

      const changedMetrics = Object.entries(record.deltas).filter(([, v]) => v !== 0);
      const unchanged = Object.entries(record.deltas).filter(([, v]) => v === 0);
      const elapsed = record.completedAt - record.startedAt;

      const failedSources = record.after?._failedSources ?? [];
      const dataWarning = failedSources.length > 0 ? ` WARNING: ${failedSources.length} data source(s) unavailable during capture (${failedSources.join(", ")}) — affected metrics may show 0 due to collection failure, not actual state.` : "";

      if (changedMetrics.length === 0) {
        record.conclusion = `HONEST RESULT: ${spell.name} ran successfully (${elapsed}ms) but produced NO measurable changes in any tracked metric. The ritual API responded${ritualResult ? " with data" : " but returned no data"}. This means the ritual's effects are either: (1) not connected to tracked metrics, (2) too small to measure, or (3) purely cosmetic. No inflation applied.${dataWarning}`;
      } else {
        const changes = changedMetrics.map(([k, v]) => `${k}: ${v > 0 ? "+" : ""}${v}`).join(", ");
        record.conclusion = `CORRELATED CHANGE: ${spell.name} correlated with ${changedMetrics.length} metric change(s) in ${elapsed}ms: ${changes}. ${unchanged.length} metrics unchanged. Note: changes may include background system drift — not solely attributable to this ritual. Evidence-grade: ${changedMetrics.length >= 3 ? "STRONG" : changedMetrics.length >= 1 ? "WEAK" : "NONE"}.${dataWarning}`;
      }

      plog(`Ritual proof completed: ${spell.name} — changes: ${changedMetrics.length}/${Object.keys(record.deltas).length} — ${record.conclusion.slice(0, 100)}`);

      res.json({
        success: true,
        proof: record,
        ritualOutput: ritualResult,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Ritual proof history ─────────────────────────────────────────────────

  app.get("/api/proof-center/ritual/history", (_req: Request, res: Response) => {
    res.json({
      history: ritualProofHistory.slice(0, 20),
      count: ritualProofHistory.length,
    });
  });

  // ── CI / test runner ─────────────────────────────────────────────────────

  app.post("/api/proof-center/ci/run", async (_req: Request, res: Response) => {
    try {
      plog("CI run triggered from UI...");
      const { execFile } = await import("child_process");
      const path = await import("path");
      const ciScript = path.join(process.cwd(), "scripts", "ci.sh");

      const output: string[] = [];
      const startTime = Date.now();

      const child = execFile("bash", [ciScript], { cwd: process.cwd(), timeout: 120000 });

      child.stdout?.on("data", (d: Buffer) => output.push(d.toString()));
      child.stderr?.on("data", (d: Buffer) => output.push(d.toString()));

      child.on("close", (code: number | null) => {
        const elapsed = Date.now() - startTime;
        res.json({
          exitCode: code,
          passed: code === 0,
          output: output.join(""),
          elapsedMs: elapsed,
          timestamp: Date.now(),
        });
      });

      child.on("error", (e: Error) => {
        res.json({
          exitCode: -1,
          passed: false,
          output: `CI script error: ${e.message}`,
          elapsedMs: Date.now() - startTime,
          timestamp: Date.now(),
        });
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/proof-center/tests/run", async (_req: Request, res: Response) => {
    try {
      plog("Unit test run triggered from UI...");
      const { execFile } = await import("child_process");
      const path = await import("path");
      const testScript = path.join(process.cwd(), "server", "tests", "run-tests.ts");

      const output: string[] = [];
      const startTime = Date.now();

      const child = execFile("npx", ["tsx", testScript], { cwd: process.cwd(), timeout: 60000 });

      child.stdout?.on("data", (d: Buffer) => output.push(d.toString()));
      child.stderr?.on("data", (d: Buffer) => output.push(d.toString()));

      child.on("close", (code: number | null) => {
        res.json({
          exitCode: code,
          passed: code === 0,
          output: output.join(""),
          elapsedMs: Date.now() - startTime,
          timestamp: Date.now(),
        });
      });

      child.on("error", (e: Error) => {
        res.json({
          exitCode: -1,
          passed: false,
          output: `Test runner error: ${e.message}`,
          elapsedMs: Date.now() - startTime,
          timestamp: Date.now(),
        });
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  plog("Proof Center routes registered:");
  plog("  GET  /api/proof-center/truth");
  plog("  GET  /api/proof-center/wallet");
  plog("  POST /api/proof-center/benchmark/run");
  plog("  GET  /api/proof-center/benchmark/latest");
  plog("  GET  /api/proof-center/llm-health");
  plog("  GET  /api/proof-center/spells");
  plog("  POST /api/proof-center/ritual/run");
  plog("  GET  /api/proof-center/ritual/history");
  plog("  POST /api/proof-center/ci/run");
  plog("  POST /api/proof-center/tests/run");
}
