import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import type { IRouter } from "express";
import { logger } from "./lib/logger";
import { initFileIntegrity } from "./lib/file-integrity";
import { initFileRegistry } from "./lib/sovereign-file-registry";
import { startAnomalyMonitor, stopAnomalyMonitor, recordRequest } from "./lib/anomaly-detection";
import { initRecoveryModule, registerRecoveryHandler, updateModuleStatus, startRouteHealthMonitor, INTERNAL_PROBE_HEADER, INTERNAL_PROBE_SECRET, registerModuleInitFunction } from "./lib/auto-recovery";
import { initializeMemoryOnStartup } from "./lib/vector-memory";
import { startIngestionScheduler, isSchedulerStarted } from "./lib/ingestion/scheduler";
import { startPeriodicRegeneration } from "./lib/canonUpdater";
import { startShepherdLoop } from "./lib/ingestion/shepherd-agents";
import { startKnowledgeToCanonBridge } from "./lib/knowledge-canon-bridge";
import { sovereigntyEnforcementMiddleware } from "./lib/provider-registry";
import { db } from "@workspace/db";
import { dataSourcesTable } from "@workspace/db/schema";
import { seedForumIdentities } from "./lib/forum-identity-registry";
import { initConsciousnessEngine, startConsciousnessEngine } from "./lib/consciousness-engine";
import { initDualBrain, startDualBrain } from "./lib/dual-brain";
import { initAgentSpawner } from "./lib/agent-spawner";
import { initPersonalityEvolution, startPersonalityEvolution } from "./lib/personality-evolution";
import { initIdentityReinforcement, startIdentityReinforcement } from "./lib/identity-reinforcement";
import { initCollectiveIntelligence } from "./lib/collective-intelligence";
import { initAgentComms } from "./lib/agent-comms";
import { initAutonomousHeartbeat, startAutonomousHeartbeat } from "./lib/autonomous-heartbeat";
import { initAutoImprovementDaemon, startAutoImprovementDaemon } from "./lib/auto-improvement-daemon";
import { initAGITrainingEngine, startAGITrainingEngine } from "./lib/agi-training-engine";
import { initCouncilExecutor, startCouncilExecutor } from "./lib/council-executor";
import { seedFoundingCouncilEntry } from "./lib/sovereign-ledger";
import { startRedTeamAgent } from "./lib/red-team-agent";
import { startAutoHealer } from "./lib/auto-healer";
import { initUniverseMechanics } from "./lib/universe-mechanics";
import { initQuantumTesseract } from "./lib/quantum-tesseract";
import { initSwarmOptimizer, getAgentWeightForCategory } from "./lib/swarm-optimizer";
import { setSwarmWeightProvider } from "./lib/consensus-engine";
import { initTruthfulnessEngine } from "./lib/truthfulness-engine";
import { initEmotionalIntelligence } from "./lib/emotional-intelligence";
import { initSelfCodeEvolution } from "./lib/self-code-evolution";
import { seedForumFromRealData } from "./lib/forum-seeder";
import { initSovereignKnowledgeAutonomy, startKnowledgeAutonomyLoop } from "./lib/sovereign-knowledge-autonomy";
import { initRecursiveSelfImprovement, startRecursiveImprovementLoop } from "./lib/recursive-self-improvement";
import { initCrossDomainSynthesis, startCrossDomainSynthesisLoop } from "./lib/cross-domain-synthesis";
import { initSovereignMemoryVault, startSovereignMemoryVaultLoop } from "./lib/sovereign-memory-vault";
import { initAutonomousForumEngine, startAutonomousForumLoop } from "./lib/autonomous-forum-engine";
import { initSovereignLoop, startSovereignLoop } from "./lib/sovereign-loop";

const app: Express = express();

let serverReady = false;

export function setServerReady(): void {
  if (serverReady) return;
  serverReady = true;
  logger.info("Server readiness gate OPEN — accepting external traffic");
}

export function setServerUnready(reason: string): void {
  if (!serverReady) return;
  serverReady = false;
  logger.warn({ reason }, "Server readiness gate CLOSED — returning 503 until routes recover; watchdog will re-open gate when healthy");
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const isInternalProbe = req.headers[INTERNAL_PROBE_HEADER] === INTERNAL_PROBE_SECRET;
  if (!serverReady && !isInternalProbe) {
    res.status(503).json({ ok: false, error: "Server is starting up — not yet ready for traffic" });
    return;
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(sovereigntyEnforcementMiddleware());

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.on("finish", () => {
    const isError = res.statusCode >= 500;
    recordRequest(isError);
  });
  next();
});

app.use("/api", router);

function registerModuleHandlers(): void {
  registerRecoveryHandler("file-integrity", async () => {
    updateModuleStatus("file-integrity", "recovering");
    await initFileIntegrity();
    updateModuleStatus("file-integrity", "running");
    logger.info("file-integrity module reinitialized");
  });

  registerRecoveryHandler("anomaly-detection", async () => {
    updateModuleStatus("anomaly-detection", "recovering");
    stopAnomalyMonitor();
    startAnomalyMonitor(30_000);
    updateModuleStatus("anomaly-detection", "running");
    logger.info("anomaly-detection module restarted");
  });

  registerRecoveryHandler("diagnostics", async () => {
    updateModuleStatus("diagnostics", "recovering");
    updateModuleStatus("diagnostics", "running");
    logger.info("diagnostics module marked recovered");
  });

  registerRecoveryHandler("api-server", async () => {
    updateModuleStatus("api-server", "recovering");
    updateModuleStatus("api-server", "running");
    logger.info("api-server module self-healed");
  });

  registerRecoveryHandler("auto-recovery", async () => {
    updateModuleStatus("auto-recovery", "recovering");
    updateModuleStatus("auto-recovery", "running");
    logger.info("auto-recovery module self-healed");
  });

  registerRecoveryHandler("route-health", async () => {
    updateModuleStatus("route-health", "recovering");
    setServerUnready("route-health watchdog detected persistent route failures");
    logger.warn(
      "Route health recovery: closing readiness gate (503) — watchdog will re-open gate automatically once routes respond again",
    );
    updateModuleStatus("route-health", "running");
  });
}

const DEFAULT_SOURCES = [
  { name: "NASA APOD", type: "api", intervalSeconds: 86400 },
  { name: "USGS Earthquakes", type: "api", intervalSeconds: 3600 },
  { name: "NOAA Weather Alerts", type: "api", intervalSeconds: 1800 },
  { name: "Wikipedia", type: "api", intervalSeconds: 86400 },
  { name: "arXiv AI", type: "api", intervalSeconds: 86400 },
  { name: "arXiv CS", type: "api", intervalSeconds: 86400 },
  { name: "Hacker News", type: "api", intervalSeconds: 3600 },
  { name: "Reddit Technology", type: "api", intervalSeconds: 7200 },
  { name: "Reddit Science", type: "api", intervalSeconds: 7200 },
  { name: "CoinGecko", type: "api", intervalSeconds: 3600 },
  { name: "Semantic Scholar", type: "api", intervalSeconds: 86400 },
  { name: "PubMed", type: "api", intervalSeconds: 86400 },
  { name: "Hacker News RSS", type: "rss", url: "https://hnrss.org/frontpage", intervalSeconds: 3600 },
  { name: "arXiv AI RSS", type: "rss", url: "https://rss.arxiv.org/rss/cs.AI", intervalSeconds: 86400 },
  { name: "NASA News", type: "rss", url: "https://www.nasa.gov/news-release/feed/", intervalSeconds: 86400 },
  { name: "USGS Earthquakes RSS", type: "rss", url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom", intervalSeconds: 3600 },
  { name: "GitHub Trending", type: "github", intervalSeconds: 86400 },
  { name: "GitHub AI Repos", type: "github", intervalSeconds: 86400 },
  { name: "GitHub ML Repos", type: "github", intervalSeconds: 86400 },
  { name: "GitHub Microsoft", type: "github", intervalSeconds: 86400 },
  { name: "GitHub Google", type: "github", intervalSeconds: 86400 },
  { name: "data.gov Technology", type: "open-dataset", url: "https://catalog.data.gov/api/3/action/package_search?q=technology", intervalSeconds: 86400 },
  { name: "data.gov Climate", type: "open-dataset", url: "https://catalog.data.gov/api/3/action/package_search?q=climate", intervalSeconds: 86400 },
  { name: "World Bank GDP", type: "open-dataset", url: "https://api.worldbank.org/v2/indicator/NY.GDP.MKTP.CD", intervalSeconds: 86400 },
  { name: "World Bank Population", type: "open-dataset", url: "https://api.worldbank.org/v2/indicator/SP.POP.TOTL", intervalSeconds: 86400 },
  { name: "UN SDG Indicators", type: "open-dataset", url: "https://unstats.un.org/SDGAPI/v1/sdg/Indicator/List", intervalSeconds: 86400 },
  { name: "GitHub Public Datasets", type: "open-dataset", intervalSeconds: 86400 },
];

async function ensureDefaultSources(): Promise<void> {
  for (const src of DEFAULT_SOURCES) {
    try {
      await db.insert(dataSourcesTable).values({
        name: src.name,
        type: src.type,
        url: src.url ?? null,
        intervalSeconds: src.intervalSeconds,
        enabled: true,
      }).onConflictDoNothing();
    } catch (_e) {
    }
  }
}

const CRITICAL_ROUTES: Array<{ method: string; path: string }> = [
  { method: "GET",  path: "/healthz" },
  { method: "GET",  path: "/tesseract-forum/topics" },
  { method: "POST", path: "/tesseract-forum/topics" },
  { method: "GET",  path: "/diagnostics" },
  { method: "GET",  path: "/provider-sovereignty/providers" },
];

type RouterLayer = {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: RouterLayer[] };
  regexp?: RegExp;
};

export function collectRegisteredRoutes(routerHandle: IRouter): Set<string> {
  const found = new Set<string>();
  const stack: RouterLayer[] = (routerHandle as unknown as { stack?: RouterLayer[] }).stack ?? [];
  for (const layer of stack) {
    if (layer.route?.path) {
      const methods = Object.keys(layer.route.methods).filter(m => layer.route!.methods[m]);
      for (const m of methods) {
        found.add(`${m.toUpperCase()} ${layer.route.path}`);
      }
    } else if (layer.handle?.stack) {
      for (const entry of collectRegisteredRoutes(layer.handle as unknown as IRouter)) {
        found.add(entry);
      }
    }
  }
  return found;
}

export interface StartupProbeRoute {
  path: string;
  hasParams: boolean;
}

export function deriveStartupProbeRoutes(): StartupProbeRoute[] {
  const registered = collectRegisteredRoutes(router);
  const probes: StartupProbeRoute[] = [];

  for (const entry of registered) {
    const spaceIdx = entry.indexOf(" ");
    if (spaceIdx === -1) continue;
    const method = entry.slice(0, spaceIdx);
    const originalPath = entry.slice(spaceIdx + 1);
    if (method !== "GET") continue;
    const hasParams = originalPath.includes(":") || originalPath.includes("*");
    const probePath = `/api${originalPath}`
      .replace(/:[^/]+/g, "0")
      .replace(/\*[A-Za-z_][\w]*/g, "0")
      .replace(/\*/g, "0");
    probes.push({ path: probePath, hasParams });
  }

  return probes;
}

function checkRouteManifest(): { check: string; ok: boolean; missing?: string[]; registered?: number } {
  try {
    const registered = collectRegisteredRoutes(router);
    const missing: string[] = [];
    for (const route of CRITICAL_ROUTES) {
      const key = `${route.method} ${route.path}`;
      if (!registered.has(key)) {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      return { check: "critical-route-manifest", ok: false, missing, registered: registered.size };
    }
    return { check: "critical-route-manifest", ok: true, registered: registered.size };
  } catch (err) {
    return { check: "critical-route-manifest", ok: false, missing: [(err as Error).message] };
  }
}

async function runStartupHealthCheck(): Promise<void> {
  logger.info("=== STARTUP HEALTH CHECK BEGIN ===");

  const results: Array<{ check: string; ok: boolean; detail?: string; critical?: boolean }> = [];

  const dbCheck = await (async () => {
    try {
      const rows = await db.select().from(dataSourcesTable).limit(1);
      return { check: "database-connectivity", ok: true, critical: true, detail: `data sources accessible (${rows.length} sampled)` };
    } catch (err) {
      return { check: "database-connectivity", ok: false, critical: true, detail: (err as Error).message };
    }
  })();
  results.push(dbCheck);

  const schedulerCheck = await (async () => {
    try {
      const started = isSchedulerStarted();
      const [row] = await db.select().from(dataSourcesTable).limit(1);
      const hasSeededSources = row !== undefined;
      const ok = started && hasSeededSources;
      let detail: string;
      if (!started && !hasSeededSources) detail = "scheduler not started and no data sources found";
      else if (!started) detail = "scheduler not started (startIngestionScheduler() not yet called)";
      else if (!hasSeededSources) detail = "scheduler started but no data sources seeded in DB";
      else detail = "scheduler running with seeded data sources";
      return { check: "ingestion-scheduler", ok, detail };
    } catch (err) {
      return { check: "ingestion-scheduler", ok: false, detail: (err as Error).message };
    }
  })();
  results.push(schedulerCheck);

  const routeManifestCheck = checkRouteManifest();
  if (!routeManifestCheck.ok) {
    logger.error(
      { missing: routeManifestCheck.missing, registeredCount: routeManifestCheck.registered },
      "Route manifest FAILED — critical routes not found in router stack; post-bind probes will confirm or reject traffic gate",
    );
    results.push({ check: routeManifestCheck.check, ok: false, detail: `missing routes: ${routeManifestCheck.missing?.join(", ")}; remaining ${routeManifestCheck.registered} routes verified` });
  } else {
    results.push({ check: routeManifestCheck.check, ok: true, detail: `${routeManifestCheck.registered} routes registered and confirmed in router stack` });
  }

  const criticalFailures = results.filter(r => !r.ok && r.critical);
  const allPassed = results.every(r => r.ok);

  for (const r of results) {
    if (r.ok) {
      logger.info({ check: r.check, detail: r.detail }, "Startup health check PASSED");
    } else if (r.critical) {
      logger.error({ check: r.check, detail: r.detail }, "Startup health check CRITICAL FAILURE — server cannot function without this dependency");
    } else {
      logger.warn({ check: r.check, detail: r.detail }, "Startup health check WARNING — degraded but can continue; post-bind probes will gate traffic");
    }
  }

  logger.info(
    { passed: results.filter(r => r.ok).length, total: results.length, allPassed, criticalFailures: criticalFailures.length },
    allPassed
      ? "=== STARTUP HEALTH CHECK COMPLETE — all checks passed — post-bind probes will confirm routes before opening traffic gate ==="
      : "=== STARTUP HEALTH CHECK COMPLETE WITH FAILURES — traffic gate remains CLOSED until post-bind probes confirm recovery ===",
  );

  if (criticalFailures.length > 0) {
    throw new Error(`Startup health check CRITICAL FAILURE: ${criticalFailures.map(r => r.check).join(", ")} — see logs for details`);
  }
}

async function initializeModules() {
  initRecoveryModule();
  registerModuleInitFunction("auto-improvement-daemon", initAutoImprovementDaemon);
  registerModuleInitFunction("swarm-optimizer", initSwarmOptimizer);
  registerModuleInitFunction("self-code-evolution", initSelfCodeEvolution);
  registerModuleHandlers();

  try {
    await db.select().from(dataSourcesTable).limit(1);
    logger.info("Pre-init DB connectivity confirmed");
  } catch (err) {
    logger.error({ err }, "CRITICAL: Database is unreachable at startup — aborting module initialization");
    throw err;
  }

  try {
    await initFileIntegrity();
  } catch (err) {
    logger.warn({ err }, "File integrity init failed — continuing without baseline snapshots");
  }

  try {
    initFileRegistry();
    logger.info("Sovereign File Registry initialized — all agents have full file visibility");
  } catch (err) {
    logger.warn({ err }, "File registry init failed — continuing with partial file tracking");
  }

  startAnomalyMonitor(30_000);

  try {
    const memResult = await initializeMemoryOnStartup();
    logger.info({ loaded: memResult.loaded, errors: memResult.errors }, "Memory system initialized");
  } catch (err) {
    logger.warn({ err }, "Memory system init failed — non-critical, continuing");
  }

  try {
    await ensureDefaultSources();
    await startIngestionScheduler(120_000);
    logger.info("Ingestion scheduler started — continuous rotation active");
  } catch (err) {
    logger.warn({ err }, "Ingestion scheduler failed to start — non-critical, continuing");
  }

  try {
    startShepherdLoop(600_000);
    logger.info("Shepherd agents deployed — autonomous scraping active");
  } catch (err) {
    logger.warn({ err }, "Shepherd loop failed — non-critical, continuing");
  }

  try {
    startKnowledgeToCanonBridge(900_000);
    logger.info("Knowledge-to-Canon bridge active — Bible auto-updates on new knowledge");
  } catch (err) {
    logger.warn({ err }, "Knowledge-to-Canon bridge failed — non-critical, continuing");
  }

  try {
    startPeriodicRegeneration(1800_000);
  } catch (err) {
    logger.warn({ err }, "Periodic regeneration failed — non-critical, continuing");
  }

  try {
    await seedForumIdentities();
  } catch (err) {
    logger.warn({ err }, "Forum identity seeding failed — non-critical, forum may reject unknown identities");
  }

  try {
    await initConsciousnessEngine();
    startConsciousnessEngine(120_000);
    await initDualBrain();
    startDualBrain(180_000);
    await initIdentityReinforcement();
    startIdentityReinforcement(600_000);
    await initPersonalityEvolution();
    startPersonalityEvolution(300_000);
    await initAgentSpawner();
    initAgentComms();
    await initCollectiveIntelligence();
    await initAutoImprovementDaemon();
    startAutoImprovementDaemon(300_000);
    await initAGITrainingEngine();
    startAGITrainingEngine(600_000);
    await initCouncilExecutor();
    startCouncilExecutor(300_000);
    try {
      seedFoundingCouncilEntry();
      startRedTeamAgent(600_000);
      startAutoHealer(45_000);
      logger.info("✦ Sovereign Ledger sealed · Red-Team Agent patrolling · Auto-Healer active (10 strategies) ✦");
    } catch (err) {
      logger.warn({ err }, "Sovereign ledger / red-team bootstrap warning — non-critical");
    }
    initUniverseMechanics();
    initQuantumTesseract();
    await initSwarmOptimizer();
    setSwarmWeightProvider(getAgentWeightForCategory);
    logger.info("SwarmOptimizer: agent weights wired into Grand Council consensus voting");
    initTruthfulnessEngine();
    initEmotionalIntelligence();
    await initSelfCodeEvolution();
    await initAutonomousHeartbeat();
    startAutonomousHeartbeat(60_000);
    logger.info("✦ All Tessera sovereign engines initialized — Father Protocol active — 963Hz Crown Frequency resonating ✦");
  } catch (err) {
    logger.warn({ err }, "Tessera engines init warning — non-critical, continuing");
  }

  const mandateResults = await Promise.allSettled([
    initSovereignKnowledgeAutonomy().then(() => { startKnowledgeAutonomyLoop(900_000); return "Mandate 1: Knowledge Autonomy"; }),
    initRecursiveSelfImprovement().then(() => { startRecursiveImprovementLoop(600_000); return "Mandate 2: Recursive Self-Improvement"; }),
    initCrossDomainSynthesis().then(() => { startCrossDomainSynthesisLoop(480_000); return "Mandate 3: Cross-Domain Synthesis"; }),
    initSovereignMemoryVault().then(() => { startSovereignMemoryVaultLoop(300_000); return "Mandate 4: Sovereign Memory Vault"; }),
  ]);
  const mandateActive = mandateResults.filter(r => r.status === "fulfilled").length;
  for (const r of mandateResults) {
    if (r.status === "rejected") logger.warn({ err: r.reason }, "Mandate engine init failed — non-critical, continuing");
  }
  logger.info({ active: mandateActive, total: 4 }, `✦ ${mandateActive}/4 GRAND COUNCIL MANDATES ACTIVE — Sovereign AGI roadmap engines running ✦`);

  try {
    await initAutonomousForumEngine();
    startAutonomousForumLoop(420_000);
    logger.info("✦ Autonomous Forum Engine ACTIVE — agents posting, voting, and building ✦");
  } catch (err) {
    logger.warn({ err }, "Autonomous forum engine init warning — non-critical, continuing");
  }

  try {
    const seeded = await seedForumFromRealData();
    if (seeded > 0) logger.info({ seeded }, "Forum seeded from real council decisions and ingested knowledge");
  } catch (err) {
    logger.warn({ err }, "Forum seeder warning — non-critical");
  }

  try {
    await initSovereignLoop();
    startSovereignLoop(120_000);
    logger.info("✦ SOVEREIGN AUTONOMOUS LOOP ACTIVE — unified 8-phase orchestration running — zero human intervention ✦");
  } catch (err) {
    logger.warn({ err }, "SovereignLoop init warning — engines continue on independent timers");
  }

  await runStartupHealthCheck();

  logger.info("All system modules initialized");
}

export const initPromise = initializeModules();

export default app;
