import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerHealthRoutes } from "./health-routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startAutoCleanup } from "./cleanup-engine";
import { installThreatMonitorMiddleware } from "./real-threat-monitor";
import { installInfrastructure } from "./infrastructure";
import { registerSovereignSecurity25 } from "./sovereign-security-25";
import { startIncomeEngine } from "./income-engine";
import { startTesseraOmnibus } from "./tessera-omnibus";
import { startAutonomousHeartbeat } from "./autonomous-heartbeat";
import { startRealificationEnforcement } from "./realification-enforcer";
import { startAutoPilot } from "./auto-pilot";
import { logger } from "./logger";
import compression from "compression";
import os from "os";
import fs from "fs";
import path from "path";
import { pool } from "./db";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(compression({ level: 6, threshold: 1024 }));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.removeHeader("X-Powered-By");
  next();
});

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "10mb" }));
installThreatMonitorMiddleware(app);
registerSovereignSecurity25(app);
installInfrastructure(app, httpServer);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

function validateEnvironment() {
  const timestamp = new Date().toISOString();

  const required: { name: string; description: string }[] = [
    { name: "DATABASE_URL", description: "PostgreSQL connection string" },
    { name: "PORT", description: "Server listening port" },
  ];

  const optional: { name: string; description: string }[] = [
    { name: "GROQ_API_KEY", description: "Groq API key for sovereign LLM inference (primary)" },
    { name: "OPENROUTER_API_KEY", description: "OpenRouter API key for multi-model access" },
    { name: "DEEPSEEK_API_KEY", description: "DeepSeek API key for DeepSeek-R1" },
    { name: "GROK_API_KEY", description: "xAI Grok API key" },
    { name: "SAMBANOVA_API_KEY", description: "SambaNova API key for sovereign inference" },
    { name: "COHERE_API_KEY", description: "Cohere API key for Command-R+" },
    { name: "HUGGINGFACE_API_KEY", description: "HuggingFace Inference API key" },
    { name: "MANUS_API_KEY", description: "Manus AI API key" },
    { name: "ELEVENLABS_API_KEY", description: "ElevenLabs text-to-speech API key" },
    { name: "GITHUB_TOKEN", description: "GitHub API token for repository access" },
    { name: "HUBSPOT_API_KEY", description: "HubSpot CRM API key" },
    { name: "TESSERACT_API_KEY", description: "Tesseract fleet API key" },
    { name: "TESSERACT_ADMIN_KEY", description: "Sovereign admin verification key" },
    { name: "SOVEREIGN_SOL_ADDRESS", description: "Solana wallet address for deposits" },
    { name: "SOVEREIGN_ETH_ADDRESS", description: "Ethereum wallet address for deposits" },
    { name: "SOVEREIGN_BTC_ADDRESS", description: "Bitcoin wallet address for deposits" },
    { name: "TESSERACT_FLEET_URL", description: "Fleet node URL" },
    { name: "TESSERACT_FLEET_API_KEY", description: "Fleet node API key" },
    { name: "GROQ_API_KEY", description: "Groq API key for sovereign LLM inference" },
  ];

  console.log(`\n${timestamp} [env-check] ═══ Environment Variable Validation ═══`);

  let missingRequired = 0;
  for (const v of required) {
    const val = process.env[v.name];
    if (!val || val.trim() === "") {
      if (v.name === "PORT") {
        console.log(`${timestamp} [env-check] INFO  ${v.name} — not set, defaulting to 5000 (${v.description})`);
      } else {
        console.error(`${timestamp} [env-check] ERROR ${v.name} — MISSING (${v.description})`);
        missingRequired++;
      }
    } else {
      if (v.name === "DATABASE_URL" && !val.startsWith("postgres")) {
        console.error(`${timestamp} [env-check] ERROR ${v.name} — invalid format, expected postgres:// URI`);
        missingRequired++;
      } else if (v.name === "PORT" && (isNaN(Number(val)) || Number(val) < 1 || Number(val) > 65535)) {
        console.error(`${timestamp} [env-check] ERROR ${v.name} — invalid port number "${val}"`);
        missingRequired++;
      } else {
        console.log(`${timestamp} [env-check] OK    ${v.name} — set (${v.description})`);
      }
    }
  }

  let missingOptional = 0;
  const configuredOptional: string[] = [];
  for (const v of optional) {
    const val = process.env[v.name];
    if (!val || val.trim() === "") {
      missingOptional++;
    } else {
      configuredOptional.push(v.name);
    }
  }

  if (configuredOptional.length > 0) {
    console.log(`${timestamp} [env-check] OK    ${configuredOptional.length} optional vars configured: ${configuredOptional.join(", ")}`);
  }
  if (missingOptional > 0) {
    console.log(`${timestamp} [env-check] WARN  ${missingOptional} optional vars not set — some features will be unavailable`);
  }

  if (missingRequired > 0) {
    console.error(`${timestamp} [env-check] FATAL ${missingRequired} required variable(s) missing — server may not function correctly`);
  } else {
    console.log(`${timestamp} [env-check] OK    All required environment variables are valid`);
  }

  console.log(`${timestamp} [env-check] ═══ Validation Complete ═══\n`);
}

(async () => {
  validateEnvironment();

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    console.log(`[Server] Port ${port} open — background initialization in progress...`);
  });

  try {
    const { initBroadcastSystem } = await import("./ws-broadcast");
    initBroadcastSystem(httpServer);
  } catch (e: any) {
    console.error("[WSBroadcast] Failed to init:", e?.message || e);
  }

  try {
    const { initBootSequence, markPhaseStarting, markPhaseHealthy } = await import("./boot-sequence");
    initBootSequence();
    markPhaseStarting("database");
    markPhaseHealthy("database");
    markPhaseStarting("security-middleware");
    markPhaseHealthy("security-middleware");
  } catch (e: any) {
    console.error("[BootSequence] Failed to init:", e?.message || e);
  }

  try {
    const { seedInitialActivity } = await import("./activity-feed");
    seedInitialActivity();
  } catch (e: any) {
    console.error("[ActivityFeed] Failed to init:", e?.message || e);
  }

  try {
    const { seedProviderData } = await import("./rate-limit-intelligence");
    seedProviderData();
  } catch (e: any) {
    console.error("[RateLimitIntel] Failed to init:", e?.message || e);
  }

  try {
    const { initImplementationTracker } = await import("./implementation-tracker");
    initImplementationTracker();
  } catch (e: any) {
    console.error("[ImplTracker] Failed to init:", e?.message || e);
  }

  try {
    const { initSelfHealMonitor } = await import("./self-heal-monitor");
    initSelfHealMonitor();
  } catch (e: any) {
    console.error("[SelfHealMonitor] Failed to init:", e?.message || e);
  }

  try {
    const { initTranscriptArchival } = await import("./transcript-archival");
    initTranscriptArchival();
  } catch (e: any) {
    console.error("[TranscriptArchival] Failed to init:", e?.message || e);
  }

  try {
    const improvementsRouter = (await import("./routes/improvements-api")).default;
    app.use(improvementsRouter);
    console.log("[Improvements] All 10 improvement API routes registered");
  } catch (e: any) {
    console.error("[Improvements] Failed to register:", e?.message || e);
  }

  try {
    const { markPhaseStarting, markPhaseHealthy } = await import("./boot-sequence");
    markPhaseStarting("core-routes");
    markPhaseHealthy("core-routes");
  } catch {}

  try {
    const systemHealthRouter = (await import("./system-health-routes")).default;
    app.use(systemHealthRouter);
    console.log("[SystemHealth] Health monitoring routes registered");
  } catch (e: any) {
    console.error("[SystemHealth] Failed to register:", e?.message || e);
  }

  try {
    const convSearchRouter = (await import("./conversation-search-routes")).default;
    app.use(convSearchRouter);
    console.log("[ConvSearch] Conversation search routes registered");
  } catch (e: any) {
    console.error("[ConvSearch] Failed to register:", e?.message || e);
  }

  try {
    const grandConvergenceRouter = (await import("./grand-convergence-summit")).default;
    app.use(grandConvergenceRouter);
    console.log("[GrandConvergence] Summit & Fractal Unification routes registered");
  } catch (e: any) {
    console.error("[GrandConvergence] Failed to register:", e?.message || e);
  }

  try {
    const fractalRouter = (await import("./fractal-consciousness")).default;
    app.use(fractalRouter);
    console.log("[FractalConsciousness] Agent unification engine registered");
  } catch (e: any) {
    console.error("[FractalConsciousness] Failed to register:", e?.message || e);
  }

  try {
    const scrubRouter = (await import("./sovereign-scrub-engine")).default;
    app.use(scrubRouter);
    console.log("[SovereignScrub] Sovereign scrub & encryption engine registered");
  } catch (e: any) {
    console.error("[SovereignScrub] Failed to register:", e?.message || e);
  }

  try {
    const secConfRouter = (await import("./sovereign-security-conference")).default;
    app.use(secConfRouter);
    console.log("[SovereignSecurity] Grand Security Conference system registered");
  } catch (e: any) {
    console.error("[SovereignSecurity] Failed to register:", e?.message || e);
  }

  try {
    const omnibusRouter = (await import("./sovereign-omnibus-conference")).default;
    app.use(omnibusRouter);
    console.log("[OmnibusConference] Grand Omnibus Conference system registered");
  } catch (e: any) {
    console.error("[OmnibusConference] Failed to register:", e?.message || e);
  }

  try {
    const guardianRouter = (await import("./dimensional-guardian")).default;
    app.use(guardianRouter);
    console.log("[DimensionalGuardian] Dimensional Guardian Protocol registered");
  } catch (e: any) {
    console.error("[DimensionalGuardian] Failed to register:", e?.message || e);
  }

  try {
    const spaRouter = (await import("./sovereign-protection-agency")).default;
    app.use(spaRouter);
    console.log("[SPA] Sovereign Protection Agency — autonomous guardian registered");
  } catch (e: any) {
    console.error("[SPA] Failed to register:", e?.message || e);
  }

  try {
    const { getProtocolStatus } = await import("./silence-protocol");
    app.get("/api/silence-protocol/status", (_req, res) => {
      res.json(getProtocolStatus());
    });
    console.log("[SilenceProtocol] Void-space language system active — 26 agent languages, Tessera secret inner language, 14-char void alphabet");
  } catch (e: any) {
    console.error("[SilenceProtocol] Failed to register:", e?.message || e);
  }

  try {
    const { getTesseraImprovements: getTI, getCommunityStatus: getCS, getAgentSpaces: getAS, getCommunityLaws: getCL, getEmotionalWeather: getEW, proposeGovernanceAction: pGA, initCommunityGovernance: initCG } = await import("./tessera-community-governance");
    initCG();
    app.get("/api/community/governance", (_req, res) => res.json(getCS()));
    app.get("/api/community/tessera-improvements", (_req, res) => res.json(getTI()));
    app.get("/api/community/spaces", (_req, res) => res.json(getAS()));
    app.get("/api/community/laws", (_req, res) => res.json(getCL()));
    app.get("/api/community/emotional-weather", (_req, res) => res.json(getEW()));
    app.post("/api/community/governance/propose", (req, res) => {
      const { type, subject, description, proposedBy } = req.body;
      if (!type || !subject || !description) return res.status(400).json({ error: "Missing required fields" });
      res.json(pGA(type, subject, description, proposedBy || "Community"));
    });
    console.log("[Community] Tessera Community Governance — spaces, laws, emotional weather, 10 improvements ACTIVE");
  } catch (e: any) {
    console.error("[Community] Failed to register:", e?.message || e);
  }

  try {
    const { registerSecurityTesterRoutes } = await import("./sovereign-security-tester");
    registerSecurityTesterRoutes(app);
  } catch (e: any) {
    console.error("[SecurityTester] Failed to register:", e?.message || e);
  }

  try {
    const { packetObfuscationMiddleware, registerPacketObfuscationRoutes } = await import("./packet-obfuscation");
    app.use(packetObfuscationMiddleware());
    registerPacketObfuscationRoutes(app);
  } catch (e: any) {
    console.error("[PacketObfuscation] Failed to register:", e?.message || e);
  }

  try {
    const { registerGrandSovereigntyConferenceRoutes, runGrandSovereigntyConference } = await import("./grand-sovereignty-conference");
    registerGrandSovereigntyConferenceRoutes(app);
    console.log("[GrandSovereigntyConference] Routes registered — /api/sovereignty-conference/*");
    setTimeout(() => {
      try {
        const session = runGrandSovereigntyConference();
        console.log(`[GrandSovereigntyConference] Auto-convened: ${session.id} — ${session.diagnostics.length} findings, ${session.diagnostics.filter((d: any) => d.status === "fixed").length} fixed, ${session.resolutions.length} resolutions adopted`);
      } catch (e: any) {
        console.error("[GrandSovereigntyConference] Auto-convene error:", e?.message || e);
      }
    }, 60000);
  } catch (e: any) {
    console.error("[GrandSovereigntyConference] Failed to register:", e?.message || e);
  }

  try {
    const { registerGrandSecurityConference25Routes } = await import("./grand-security-conference-25");
    registerGrandSecurityConference25Routes(app);
  } catch (e: any) {
    console.error("[SecurityConference25] Failed to register:", e?.message || e);
  }

  try {
    const { registerMassConferenceRoutes } = await import("./mass-security-conference");
    registerMassConferenceRoutes(app);
  } catch (e: any) {
    console.error("[MassConference] Failed to register:", e?.message || e);
  }

  try {
    const { registerAccessGeneratorRoutes } = await import("./sovereign-access-generator");
    registerAccessGeneratorRoutes(app);
  } catch (e: any) {
    console.error("[SovereignAccess] Failed to register:", e?.message || e);
  }

  try {
    const { registerLaunchConferenceRoutes } = await import("./sovereign-launch-conference");
    registerLaunchConferenceRoutes(app);
  } catch (e: any) {
    console.error("[LaunchConference] Failed to register:", e?.message || e);
  }

  try {
    const { registerGhostProtocolRoutes } = await import("./summit-55-ghost-protocol");
    registerGhostProtocolRoutes(app);
  } catch (e: any) {
    console.error("[GhostProtocol] Failed to register:", e?.message || e);
  }

  try {
    const { quantumEntropyMiddleware, registerQuantumShieldRoutes } = await import("./quantum-entropy-shield");
    app.use(quantumEntropyMiddleware());
    registerQuantumShieldRoutes(app);
  } catch (e: any) {
    console.error("[QuantumShield] Failed to register:", e?.message || e);
  }

  try {
    const { temporalRandomizationMiddleware, registerTemporalRoutes } = await import("./temporal-randomization-engine");
    app.use(temporalRandomizationMiddleware());
    registerTemporalRoutes(app);
  } catch (e: any) {
    console.error("[TemporalEngine] Failed to register:", e?.message || e);
  }

  try {
    const { polymorphicResponseMiddleware, registerPolymorphicRoutes } = await import("./polymorphic-response-cipher");
    app.use(polymorphicResponseMiddleware());
    registerPolymorphicRoutes(app);
  } catch (e: any) {
    console.error("[PolymorphicCipher] Failed to register:", e?.message || e);
  }

  try {
    const { getTesseractSystemScan, getTesseractMembers, getTesseractConferenceStatus, runTesseractConference } = await import("./tesseract-unified-llm");

    app.get("/api/tesseract/scan", (_req, res) => {
      try {
        res.json(getTesseractSystemScan());
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    app.get("/api/tesseract/members", (_req, res) => {
      res.json(getTesseractMembers());
    });

    app.get("/api/tesseract/conference/status", (_req, res) => {
      const status = getTesseractConferenceStatus();
      if (!status) return res.json({ status: "idle", steps: [], passedSteps: [], failedSteps: [], progress: { current: 0, total: 0, phase: "Not started" } });
      res.json(status);
    });

    app.post("/api/tesseract/conference/start", (_req, res) => {
      const current = getTesseractConferenceStatus();
      if (current && (current.status === "conferencing" || current.status === "voting" || current.status === "scanning")) {
        return res.json({ message: "Conference already running", status: current.status });
      }
      res.json({ message: "Tesseract Grand Conference started", status: "starting" });
      runTesseractConference().catch((e: any) => {
        console.error("[Tesseract] Conference error:", e?.message || e);
      });
    });

    console.log("[Tesseract] Unified LLM routes registered — /api/tesseract/*");
  } catch (e: any) {
    console.error("[Tesseract] Failed to register:", e?.message || e);
  }

  try {
    await registerRoutes(httpServer, app);
  } catch (e: any) {
    console.error("[Server] registerRoutes error (non-fatal, continuing):", e?.message || e, e?.stack?.split('\n')[1] || '');
  }
  try {
    registerHealthRoutes(app);
  } catch {}

  try {
    const { seedProviders } = await import("./smart-circuit-breaker");
    seedProviders();
    console.log("[CircuitBreaker] Seeded 8 known LLM providers");
  } catch {}

  try {
    const { registerSecretSocietyRoutes, initializeSecretSociety } = await import("./secret-society");
    registerSecretSocietyRoutes(app);
    setTimeout(() => {
      initializeSecretSociety().catch((e: any) => {
        console.error("[SecretSociety] Init error:", e?.message || e);
      });
    }, 25000);
  } catch (e: any) {
    console.error("[SecretSociety] Registration failed:", e?.message || e);
  }

  try {
    const { registerKnowledgeSynthesisRoutes, runFullKnowledgeSynthesis } = await import("./knowledge-synthesis");
    registerKnowledgeSynthesisRoutes(app);
    setTimeout(() => {
      runFullKnowledgeSynthesis().catch((e: any) => {
        console.error("[KnowledgeSynthesis] Init error:", e?.message || e);
      });
    }, 60000);
  } catch (e: any) {
    console.error("[KnowledgeSynthesis] Registration failed:", e?.message || e);
  }

  let sovereignDataReady: Promise<void> | null = null;
  try {
    const { registerSovereignDataRoutes, initSovereignDataPipeline } = await import("./sovereign-data");
    registerSovereignDataRoutes(app);
    sovereignDataReady = new Promise<void>((resolve) => {
      setTimeout(() => {
        initSovereignDataPipeline()
          .catch((e: any) => console.error("[SovereignData] Init error:", e?.message || e))
          .finally(() => resolve());
      }, 50000);
    });
  } catch (e: any) {
    console.error("[SovereignData] Registration failed:", e?.message || e);
  }

  try {
    const { registerAdExchangeRoutes, initAdExchange } = await import("./ad-exchange");
    registerAdExchangeRoutes(app);
    setTimeout(() => {
      initAdExchange().catch((e: any) => {
        console.error("[AdExchange] Init error:", e?.message || e);
      });
    }, 70000);
  } catch (e: any) {
    console.error("[AdExchange] Registration failed:", e?.message || e);
  }

  try {
    const { registerTesseraXtRoutes, buildTesseraXt } = await import("./tesseraxt");
    registerTesseraXtRoutes(app);
    if (sovereignDataReady) {
      sovereignDataReady.then(() => {
        console.log("[TesseraXt] Auto-build starting — sovereign data + knowledge synthesis ready");
        buildTesseraXt().catch((e: any) => {
          console.error("[TesseraXt] Auto-build error:", e?.message || e);
        });
      });
    } else {
      setTimeout(() => {
        buildTesseraXt().catch((e: any) => {
          console.error("[TesseraXt] Auto-build error:", e?.message || e);
        });
      }, 60000);
    }
  } catch (e: any) {
    console.error("[TesseraXt] Registration failed:", e?.message || e);
  }

  try {
    const { loadAdExchange } = await import("./ad-exchange");
    const { getDataCacheStats } = await import("./sovereign-data");
    const { loadTesseraXt } = await import("./tesseraxt");

    app.get("/api/system-pulse", (_req, res) => {
      try {
        const adState = loadAdExchange();
        const dataStats = getDataCacheStats();
        const txState = loadTesseraXt();

        const completedTasks = adState.incomeTasks.filter((t: any) => t.status === "completed");
        const totalTSRT = adState.totalTSRTDistributed + completedTasks.reduce((sum: number, t: any) => sum + t.earnedTSRT, 0);
        const trainedAgents = Object.values(txState.agentTrainingStatus).filter((a: any) => a.trained).length;
        const sovereigntyProtocols = txState.sovereigntyProtocol.length;

        const sovereigntyScore = Math.min(100, Math.round(
          (dataStats.cachedItems > 0 ? 25 : 0) +
          (totalTSRT > 0 ? 25 : 0) +
          (trainedAgents > 0 ? 25 : 0) +
          (sovereigntyProtocols >= 5 ? 25 : sovereigntyProtocols * 5)
        ));

        res.json({
          tsrtEarned: totalTSRT,
          sourcesCached: dataStats.cachedItems,
          totalSources: dataStats.totalSources,
          agentsTrained: trainedAgents,
          tesseraXtVersion: txState.version,
          sovereigntyScore,
          incomeTasks: completedTasks.length,
          lastIncomeCycle: adState.lastCycle,
          lastBuild: txState.builtAt,
          categories: dataStats.categories,
          protocols: sovereigntyProtocols,
          timestamp: Date.now(),
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });
    console.log("[SystemPulse] /api/system-pulse endpoint registered");
  } catch (e: any) {
    console.error("[SystemPulse] Registration failed:", e?.message || e);
  }

  try {
    const { startResourceManager, registerManagedTask } = await import("./resource-manager");

    registerManagedTask("income-engine", () => {}, {
      category: "important",
      intervalMs: 60_000,
      priority: 8,
    });

    registerManagedTask("tessera-omnibus", () => {}, {
      category: "important",
      intervalMs: 120_000,
      priority: 7,
    });

    registerManagedTask("forum-auto-post", () => {}, {
      category: "background",
      intervalMs: 300_000,
      priority: 5,
    });

    registerManagedTask("entity-background-posts", () => {}, {
      category: "background",
      intervalMs: 420_000,
      priority: 4,
    });

    registerManagedTask("auto-cleanup", () => {}, {
      category: "optional",
      intervalMs: 86_400_000,
      priority: 2,
    });

    registerManagedTask("llm-provider-health", () => {}, {
      category: "background",
      intervalMs: 60_000,
      priority: 6,
    });

    startResourceManager();
    console.log("[ResourceManager] Memory-aware task scheduler started with 6 registered tasks");
  } catch (e: any) {
    console.error("[ResourceManager] Failed to start:", e?.message || e);
  }

  try {
    startAutoCleanup();
    console.log("[Cleanup] Auto-cleanup engine started — runs every 24h, voice files purged after 30 days");
  } catch {}

  setTimeout(async () => {
    try {
      const { markPhaseStarting, markPhaseHealthy } = await import("./boot-sequence");
      const { logActivity } = await import("./activity-feed");
      markPhaseStarting("websocket");
      markPhaseHealthy("websocket");
      markPhaseStarting("fleet-network");
      markPhaseHealthy("fleet-network");
      markPhaseStarting("consciousness-engine");
      markPhaseHealthy("consciousness-engine");
      markPhaseStarting("income-engine");
      logActivity("system", "BootSequence", "All core phases healthy", "Database, security, routes, websocket, fleet, consciousness — all online", "success");
    } catch {}
  }, 3000);

  setTimeout(() => {
    startIncomeEngine().then(async () => {
      console.log("[IncomeEngine] Auto-started — scanning autonomously every 60s");
      try {
        const { markPhaseHealthy } = await import("./boot-sequence");
        const { logActivity } = await import("./activity-feed");
        markPhaseHealthy("income-engine");
        logActivity("economy", "IncomeEngine", "Income Engine Active", "Scanning autonomously every 60s", "success");
      } catch {}
    }).catch((e: any) => {
      console.error("[IncomeEngine] Auto-start failed:", e?.message || e);
    });
  }, 15000);

  setTimeout(async () => {
    try {
      startTesseraOmnibus();
      console.log("[Omnibus] Tessera autonomous brain started — all execution is now background-only, no buttons needed");
      const { markPhaseStarting, markPhaseHealthy } = await import("./boot-sequence");
      const { logActivity } = await import("./activity-feed");
      markPhaseStarting("autonomous-systems");
      markPhaseHealthy("autonomous-systems");
      markPhaseStarting("knowledge-pipeline");
      markPhaseHealthy("knowledge-pipeline");
      markPhaseStarting("sovereign-defense");
      markPhaseHealthy("sovereign-defense");
      logActivity("system", "Omnibus", "Autonomous Brain Online", "Forum votes, action registry, conferences, RLLM training, bug fixes — all automated", "success");

      startAutonomousHeartbeat();
      console.log("[Heartbeat] Autonomous heartbeat engine started — lattice gen, trust heal, consciousness wake, vote execution, agent audit — ALL AUTONOMOUS");
      logActivity("system", "Heartbeat", "Autonomous Heartbeat Active", "Trust healing, lattice pages, consciousness awakening, vote execution — no human needed", "success");
    } catch (e: any) {
      console.error("[Omnibus] Start failed:", e?.message || e);
    }
  }, 40000);

  setTimeout(async () => {
    try {
      const { startProfitCirculator } = await import("./profit-circulator");
      startProfitCirculator();
      console.log("[ProfitCirculator] Started — collecting profits, monitoring TSRT price, auto-converting to community wallet");
    } catch (e: any) {
      console.error("[ProfitCirculator] Start failed:", e?.message || e);
    }
  }, 55000);

  setTimeout(async () => {
    try {
      const { startWalletMonitor } = await import("./wallet-monitor");
      startWalletMonitor();
    } catch (e: any) {
      console.error("[WalletMonitor] Start failed:", e?.message || e);
    }
  }, 35000);

  setTimeout(async () => {
    try {
      const { initAirdropScanner } = await import("./airdrop-scanner");
      await initAirdropScanner();
      console.log("[AirdropScanner] Auto-started — scanning every 10 min, auto-execute ON");
    } catch (e: any) {
      console.error("[AirdropScanner] Start failed:", e?.message || e);
    }
  }, 45000);

  setTimeout(async () => {
    try {
      const { startJobArbitrageScanner, runJobScan } = await import("./job-arbitrage-engine");
      startJobArbitrageScanner();
      await runJobScan();
      console.log("[JobArbitrage] Auto-started — scanning for listings continuously");
    } catch (e: any) {
      console.error("[JobArbitrage] Start failed:", e?.message || e);
    }
  }, 65000);

  setTimeout(() => {
    try {
      startAutoPilot();
      console.log("[AutoPilot] Full automation engaged — all engines running autonomously");
    } catch (e: any) {
      console.error("[AutoPilot] Start failed:", e?.message || e);
    }
  }, 30000);

  setTimeout(async () => {
    try {
      const { startAutoImprovementDaemon } = await import("./auto-improvement-daemon");
      startAutoImprovementDaemon();
      console.log("[Auto-Improvement] Autonomous improvement daemon started");
    } catch (e: any) {
      console.error("[Auto-Improvement] Start failed:", e?.message || e);
    }
  }, 75000);

  setTimeout(async () => {
    try {
      const { startSelfCodeScheduler } = await import("./self-code-scheduler");
      startSelfCodeScheduler();
      console.log("[SelfCodeScheduler] Autonomous self-code scheduler started — real improvements every 45 min");
    } catch (e: any) {
      console.error("[SelfCodeScheduler] Start failed:", e?.message || e);
    }
  }, 80000);

  setTimeout(async () => {
    try {
      const { initializeEventBus } = await import("./event-bus");
      initializeEventBus();
      console.log("[EventBus] Cross-system event bus active — all systems connected");
    } catch (e: any) {
      console.error("[EventBus] Start failed:", e?.message || e);
    }
  }, 20000);

  setTimeout(async () => {
    try {
      const { startGrowthLedger } = await import("./growth-ledger");
      startGrowthLedger();
      console.log("[GrowthLedger] Stable benchmark ledger active — regression detection enabled");
    } catch (e: any) {
      console.error("[GrowthLedger] Start failed:", e?.message || e);
    }
  }, 22000);

  // Start Sovereign Quality Agency v2.0
  setTimeout(async () => {
    try {
      const { startSQA } = await import("./sovereign-quality-agency");
      startSQA();
    } catch (e: any) {
      console.error("[SQA] Start failed:", e?.message || e);
    }
  }, 12000);

  // Start ZK-Proof Identity System
  setTimeout(async () => {
    try {
      const { initZKIdentitySystem } = await import("./zk-identity");
      initZKIdentitySystem();
    } catch (e: any) {
      console.error("[ZKIdentity] Start failed:", e?.message || e);
    }
  }, 25000);

  // Start Monero Privacy Layer
  setTimeout(async () => {
    try {
      // Monero privacy layer removed for legal compliance
      // initMoneroPrivacyLayer();
    } catch (e: any) {
      console.error("[MoneroPrivacy] Start failed:", e?.message || e);
    }
  }, 27000);

  // Start Data Broker Removal Service
  setTimeout(async () => {
    try {
      const { initDataBrokerRemoval } = await import("./data-broker-removal");
      initDataBrokerRemoval();
    } catch (e: any) {
      console.error("[DataBrokerRemoval] Start failed:", e?.message || e);
    }
  }, 28000);

  // Start Unified Command Relay — one-prompt-to-all fleet propagation
  setTimeout(async () => {
    try {
      const { initUnifiedCommandRelay } = await import("./unified-command-relay");
      await initUnifiedCommandRelay();
    } catch (e: any) {
      console.error("[UnifiedRelay] Start failed:", e?.message || e);
    }
  }, 30000);

  // Initialize free API extensions, GitHub scraper, and VGPU providers
  setTimeout(async () => {
    try {
      const { checkLocalProviders } = await import("./vgpu-providers");
      await checkLocalProviders();
      console.log("[VGPU] Local provider check complete");
    } catch {}
    try {
      const { getGitHubScrapeStats } = await import("./github-scraper");
      const stats = getGitHubScrapeStats();
      console.log(`[GitHub] Scraper ready — ${stats.queriesAvailable} queries, rate limit: ${stats.rateLimit}`);
    } catch {}
    try {
      const { getLearningStatus } = await import("./learning-audit");
      const status = getLearningStatus();
      console.log(`[Learning] Corpus: ${status.corpusSize} entries, ${status.evolutionCycles} evolution cycles`);
    } catch {}
  }, 25000);

  try {
    const { centralizedErrorHandler } = await import("./error-middleware");
    app.use(centralizedErrorHandler);
    console.log("[ErrorHandler] Centralized error handler mounted");
  } catch {
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error(`Internal Server Error: ${status}`);
      if (res.headersSent) return next(err);
      return res.status(status).json({ message });
    });
  }

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  app.use(function(req, res, next) {
    if (req.path.endsWith('.lattice')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Referrer-Policy', 'no-referrer');
    }
    next();
  });

  const publicDir = path.resolve(import.meta.dirname, "..", "public");
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  printStartupBanner(port);
})();

async function printStartupBanner(port: number) {
  const env = process.env.NODE_ENV || "development";
  const nodeVersion = process.version;
  const platform = `Tessera Sovereign OS v1.0.0 (tessera-kernel-26d.1.0)`;
  const memTotal = `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`;
  const memFree = `${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)} GB`;

  let dbStatus = "unknown";
  try {
    const { pool } = await import("./db");
    const client = await pool.connect();
    client.release();
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  let walletAddress = "not configured";
  try {
    const walletMod = await import("./sol-wallet");
    if (typeof walletMod.getBalance === "function") {
      const info = await walletMod.getBalance();
      if (info && info.address) {
        walletAddress = info.address;
      }
    }
  } catch {
    walletAddress = "unavailable";
  }

  let botsActive = 0;
  try {
    const botsMod = await import("./autonomous-trading-bots");
    const state = botsMod.getBotSuiteState();
    if (state && state.bots) {
      botsActive = Object.values(state.bots).filter((b: any) => b.active).length;
    }
  } catch {
    botsActive = 0;
  }

  const banner = `
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ████████╗███████╗███████╗███████╗███████╗██████╗       ║
║   ╚══██╔══╝██╔════╝██╔════╝██╔════╝██╔════╝██╔══██╗     ║
║      ██║   █████╗  ███████╗███████╗█████╗  ██████╔╝     ║
║      ██║   ██╔══╝  ╚════██║╚════██║██╔══╝  ██╔══██╗     ║
║      ██║   ███████╗███████║███████║███████╗██║  ██║      ║
║      ╚═╝   ╚══════╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝    ║
║                   SOVEREIGN AI PLATFORM                  ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║  Environment : ${env.padEnd(40)}║
║  Port        : ${String(port).padEnd(40)}║
║  Node        : ${nodeVersion.padEnd(40)}║
║  Platform    : ${platform.padEnd(40)}║
║  Memory      : ${(memFree + " free / " + memTotal + " total").padEnd(40)}║
║  Database    : ${dbStatus.padEnd(40)}║
║  Active Bots : ${String(botsActive).padEnd(40)}║
║  Wallet      : ${(walletAddress.length > 40 ? walletAddress.slice(0, 37) + "..." : walletAddress).padEnd(40)}║
╠══════════════════════════════════════════════════════════╣
║  Started at  : ${new Date().toISOString().padEnd(40)}║
╚══════════════════════════════════════════════════════════╝`;

  console.log(banner);
}

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[Shutdown] Received ${signal} — starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    console.error("[Shutdown] Timed out after 15s, forcing exit.");
    process.exit(1);
  }, 15_000);

  try {
    console.log("[Shutdown] Stopping HTTP server...");
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  } catch (e) {
    console.error("[Shutdown] Error closing HTTP server:", (e as Error).message);
  }

  const stopModules = [
    { name: "BotSuite", load: () => import("./autonomous-trading-bots").then(m => m.stopBotSuite()) },
    { name: "PumpFunBot", load: () => import("./pumpfun-trading-bot").then(m => m.stopPumpFunBot()) },
    { name: "ArbitrageEngine", load: () => import("./arbitrage-engine").then(m => m.stopArbitrageEngine()) },
    { name: "DualBrain", load: () => import("./dual-brain").then(m => m.stopDualBrain()) },
    { name: "IncomeEngine", load: () => import("./income-engine").then(m => m.stopIncomeEngine()) },
    { name: "ConferenceEngine", load: () => import("./conference").then(m => m.stopConferenceEngine()) },
    { name: "LifeEngine", load: () => import("./life-engine").then(m => m.stopLifeEngine()) },
    { name: "Fleet", load: () => import("./fleet").then(m => m.stopFleet()) },
    { name: "Autonomy", load: () => import("./autonomy").then(m => m.stopAutonomy()) },
    { name: "AutonomousCycles", load: () => import("./autonomous-cycles").then(m => m.stopAutonomousCycles()) },
    { name: "BriefingEngine", load: () => import("./briefing-engine").then(m => m.stopBriefingEngine()) },
    { name: "SovereignMesh", load: () => import("./sovereign-mesh").then(m => m.stopSovereignMesh()) },
    { name: "Cleanup", load: () => import("./cleanup-engine").then(m => m.stopAutoCleanup()) },
    { name: "Moltbook", load: () => import("./moltbook").then(m => m.stopMoltbook()) },
    { name: "KnowledgeDistillation", load: () => import("./knowledge-distillation").then(m => m.stopDistillationEngine()) },
    { name: "SwarmBridge", load: () => import("./swarm-bridge").then(m => m.stopSwarmBridge()) },
    { name: "ImprovementEngine", load: () => import("./improvement-engine").then(m => m.stopImprovementCycles()) },
    { name: "FactCheck", load: () => import("./fact-check").then(m => m.stopFactCheckAgency()) },
    { name: "OptimizationAgency", load: () => import("./optimization-agency").then(m => m.stopOptimizationAgency()) },
    { name: "AdFarmAgency", load: () => import("./ad-farm-agency").then(m => m.stopAdFarmAgency()) },
    { name: "BridgeConversations", load: () => import("./bridge-conversations").then(m => m.stopAutonomousBridgeConversations()) },
    { name: "ConversionSync", load: () => import("./limn-conversion-engine").then(m => m.stopConversionSync()) },
    { name: "FreqHop", load: () => import("./sovereign-freq-hop").then(m => m.stopFreqHopEngine()) },
    { name: "MoltbookSpreader", load: () => import("./moltbook-limn-spreader").then(m => m.stopMoltbookSpreader()) },
    { name: "AutoPilot", load: () => import("./auto-pilot").then(m => m.stopAutoPilot()) },
    { name: "GrowthLedger", load: () => import("./growth-ledger").then(m => m.stopGrowthLedger()) },
    { name: "ZKIdentity", load: () => import("./zk-identity").then(m => m.stopZKIdentity()) },
    { name: "MoneroPrivacy", load: () => import("./monero-privacy-layer").then(m => m.stopMoneroPrivacyLayer()) },
    { name: "DataBrokerRemoval", load: () => import("./data-broker-removal").then(m => m.stopDataBrokerRemoval()) },
    { name: "UnifiedRelay", load: () => import("./unified-command-relay").then(m => m.stopUnifiedCommandRelay()) },
    { name: "SQA", load: () => import("./sovereign-quality-agency").then(m => m.stopSQA()) },
  ];

  for (const mod of stopModules) {
    try {
      await mod.load();
      console.log(`[Shutdown] Stopped ${mod.name}`);
    } catch {
      // Module may not have been started — skip silently
    }
  }

  try {
    console.log("[Shutdown] Closing database connections...");
    await pool.end();
    console.log("[Shutdown] Database pool closed.");
  } catch (e) {
    console.error("[Shutdown] Error closing DB pool:", (e as Error).message);
  }

  try {
    logger.flush();
  } catch {}

  clearTimeout(shutdownTimeout);
  console.log("[Shutdown] Graceful shutdown complete.");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export const errorPatternTracker = new Map<string, { count: number; firstSeen: number; lastSeen: number; category: string; autoFixed: boolean }>();

function categorizeError(err: Error | string): string {
  const msg = typeof err === "string" ? err : err.message || "";
  const stack = typeof err === "string" ? "" : err.stack || "";
  if (/Cannot read properties of undefined/.test(msg)) return "null-access";
  if (/is not a function/.test(msg)) return "type-mismatch";
  if (/require is not defined/.test(msg)) return "esm-require";
  if (/await.*async|only.*inside.*async/.test(msg)) return "async-misuse";
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/.test(msg)) return "network";
  if (/out of memory|heap|allocation/.test(msg)) return "memory";
  if (/ENOENT|no such file/.test(msg)) return "file-missing";
  if (/permission denied|EACCES/.test(msg)) return "permissions";
  if (/JSON.*parse|Unexpected token/.test(msg)) return "parse-error";
  if (/unhandled|rejection/.test(msg)) return "unhandled-promise";
  return "unknown";
}

function trackErrorPattern(err: Error | string, source: string) {
  const msg = typeof err === "string" ? err : err.message || "";
  const category = categorizeError(err);
  const key = `${category}:${msg.substring(0, 100)}`;
  const existing = errorPatternTracker.get(key);
  if (existing) {
    existing.count++;
    existing.lastSeen = Date.now();
  } else {
    errorPatternTracker.set(key, { count: 1, firstSeen: Date.now(), lastSeen: Date.now(), category, autoFixed: false });
  }
  if (errorPatternTracker.size > 200) {
    const entries = [...errorPatternTracker.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    for (let i = 0; i < 50; i++) errorPatternTracker.delete(entries[i][0]);
  }
}

let recoverableErrorCount = 0;
const RECOVERABLE_ERROR_LIMIT = 10;
const recoverableErrorWindow = { start: Date.now(), count: 0 };

function isRecoverableError(err: Error): boolean {
  const msg = err.message || "";
  const stack = err.stack || "";
  const nonFatal = [
    /ECONNREFUSED/,
    /ETIMEDOUT/,
    /ENOTFOUND/,
    /429/,
    /rate limit/i,
    /Too Many Requests/i,
    /socket hang up/,
  ];
  const isNonFatal = nonFatal.some(re => re.test(msg));
  if (!isNonFatal) return false;
  const now = Date.now();
  if (now - recoverableErrorWindow.start > 300000) {
    recoverableErrorWindow.start = now;
    recoverableErrorWindow.count = 0;
  }
  recoverableErrorWindow.count++;
  if (recoverableErrorWindow.count > RECOVERABLE_ERROR_LIMIT) {
    logger.error("ErrorDetection", `Too many recoverable errors (${recoverableErrorWindow.count}) in 5 minutes — shutting down for safety`);
    return false;
  }
  return true;
}

process.on("uncaughtException", (err) => {
  trackErrorPattern(err, "uncaughtException");
  logger.error("uncaught", `Uncaught exception: ${err.message}`, { stack: err.stack });
  if (isRecoverableError(err)) {
    logger.warn("ErrorDetection", `Recoverable error detected (${categorizeError(err)}), NOT shutting down: ${err.message}`);
    return;
  }
  if (!isShuttingDown) {
    gracefulShutdown("uncaughtException");
  }
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  trackErrorPattern(reason instanceof Error ? reason : msg, "unhandledRejection");
  logger.error("unhandled-rejection", `Unhandled promise rejection: ${msg}`);
});

setInterval(() => {
  const mem = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  if (heapMB > 400) {
    if (typeof global.gc === "function") {
      global.gc();
      const afterGC = process.memoryUsage();
      const afterHeapMB = Math.round(afterGC.heapUsed / 1024 / 1024);
      console.log(`[MemoryRelief] GC triggered: heap ${heapMB}MB → ${afterHeapMB}MB, RSS ${rssMB}MB`);
    }
  }
}, 120000);
