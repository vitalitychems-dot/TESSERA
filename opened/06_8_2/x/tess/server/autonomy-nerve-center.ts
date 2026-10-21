import { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { checkAdminSession } from "./security";

const LOG_PREFIX = "[NerveCenter]";

interface AutonomousSystem {
  id: string;
  name: string;
  category: "knowledge" | "building" | "income" | "security" | "intelligence" | "data" | "mesh";
  file: string;
  status: "active" | "idle" | "error" | "disabled";
  lastActivity: number;
  cycleInterval: string;
  description: string;
  metrics: Record<string, number | string>;
}

interface NerveCenterState {
  bootTime: number;
  totalCycles: number;
  knowledgeEntries: number;
  autonomousActions: number;
  lastKnowledgeSync: number;
  lastBuildCycle: number;
  lastIncomeCycle: number;
  lastSecurityScan: number;
  lastDataPipeline: number;
  systemHealthScore: number;
  connectedSystems: number;
  feedbackLoop: FeedbackEntry[];
}

interface FeedbackEntry {
  timestamp: number;
  source: string;
  action: string;
  result: string;
  impactScore: number;
}

const state: NerveCenterState = {
  bootTime: Date.now(),
  totalCycles: 0,
  knowledgeEntries: 0,
  autonomousActions: 0,
  lastKnowledgeSync: 0,
  lastBuildCycle: 0,
  lastIncomeCycle: 0,
  lastSecurityScan: 0,
  lastDataPipeline: 0,
  systemHealthScore: 100,
  connectedSystems: 0,
  feedbackLoop: [],
};

function addFeedback(source: string, action: string, result: string, impact: number) {
  state.feedbackLoop.unshift({ timestamp: Date.now(), source, action, result, impactScore: impact });
  if (state.feedbackLoop.length > 200) state.feedbackLoop.length = 200;
  state.autonomousActions++;
}

async function syncKnowledgeIndex(): Promise<number> {
  try {
    const { refreshIndex } = await import("./knowledge-engine");
    const count = refreshIndex();
    state.knowledgeEntries = count;
    state.lastKnowledgeSync = Date.now();
    addFeedback("knowledge-engine", "index-rebuild", `Rebuilt index with ${count} entries`, 15);
    return count;
  } catch (e: any) {
    addFeedback("knowledge-engine", "index-rebuild", `Failed: ${e?.message}`, -5);
    return 0;
  }
}

async function runAutonomousBuildCycle(): Promise<{ started: number; completed: number }> {
  try {
    const { forceBuildCycle } = await import("./autonomous-archive");
    const result = forceBuildCycle();
    state.lastBuildCycle = Date.now();
    addFeedback("autonomous-builder", "build-cycle", `Started: ${result.tasksStarted}, Completed: ${result.tasksCompleted}`, result.tasksCompleted * 10);
    return result;
  } catch (e: any) {
    addFeedback("autonomous-builder", "build-cycle", `Failed: ${e?.message}`, -5);
    return { started: 0, completed: 0 };
  }
}

async function runImprovementCycle(): Promise<number> {
  try {
    const { runImprovementCycles } = await import("./improvement-engine");
    const result = await runImprovementCycles(1);
    addFeedback("improvement-engine", "improvement-cycle", `Completed 1 improvement cycle`, 20);
  } catch (e: any) {
    addFeedback("improvement-engine", "improvement-cycle", `Failed: ${e?.message}`, -5);
  }
  try {
    const { runAGIEnhancementCycle } = await import("./agi-archive");
    const enh = await runAGIEnhancementCycle();
    addFeedback("agi-enhancements", "synthesis-cycle", `Synthesized ${enh.synthesisResult.entriesGenerated} AGI insights, cache: ${enh.cacheStats.size}`, 15);
  } catch (e: any) {
    console.warn(`[NerveCenter] AGI enhancement cycle error: ${e?.message}`);
  }
  return 1;
}

async function runDataPipelineFetch(): Promise<number> {
  let fetched = 0;
  try {
    const { searchKnowledge, addKnowledge } = await import("./knowledge-engine");

    const feedSources = [
      { url: "https://api.alternative.me/fng/?limit=1", source: "sentiment", title: "Crypto Fear & Greed Index" },
      { url: "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY", source: "forex", title: "Live Forex Rates" },
      { url: "https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112", source: "crypto", title: "SOL/BTC/ETH Live Prices" },
      { url: "https://api.coinlore.net/api/global/", source: "crypto-global", title: "Global Crypto Market Cap" },
      { url: "https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty", source: "tech-news", title: "Hacker News Top Stories IDs" },
      { url: "https://api.coinlore.net/api/tickers/?start=0&limit=5", source: "crypto-top5", title: "Top 5 Crypto Tickers" },
      { url: "https://api.github.com/search/repositories?q=ai+agent+language:typescript&sort=updated&per_page=3", source: "github", title: "Trending AI Agent Repos" },
      { url: "https://worldtimeapi.org/api/timezone/Etc/UTC", source: "time", title: "World UTC Time" },
    ];

    for (const feed of feedSources) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(feed.url, { signal: controller.signal, headers: { "User-Agent": "Tessera-Sovereign/1.0" } });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          const content = JSON.stringify(data).slice(0, 500);
          addKnowledge({ source: feed.source, title: feed.title, content, tags: [feed.source, "live-data", "pipeline"] });
          fetched++;
        }
      } catch {}
    }

    state.lastDataPipeline = Date.now();
    addFeedback("data-pipeline", "live-fetch", `Fetched ${fetched} data sources into knowledge`, fetched * 8);
  } catch (e: any) {
    addFeedback("data-pipeline", "live-fetch", `Failed: ${e?.message}`, -3);
  }
  return fetched;
}

const ingestedConferenceFiles = new Set<string>();
async function runConferenceAndIngest(): Promise<number> {
  let ingested = 0;
  try {
    const { addKnowledge } = await import("./knowledge-engine");
    const transcriptsDir = path.join(process.cwd(), "server/conference-transcripts");
    if (fs.existsSync(transcriptsDir)) {
      const files = fs.readdirSync(transcriptsDir).filter(f => f.endsWith(".json")).slice(-10);
      for (const file of files) {
        if (ingestedConferenceFiles.has(file)) continue;
        try {
          const data = JSON.parse(fs.readFileSync(path.join(transcriptsDir, file), "utf8"));
          const content = typeof data === "string" ? data : JSON.stringify(data).slice(0, 800);
          addKnowledge({ source: "conference-transcript", title: `Conference: ${file}`, content, tags: ["conference", "summit", "real-ai"] });
          ingestedConferenceFiles.add(file);
          ingested++;
        } catch {}
      }
    }
    if (ingested > 0) {
      addFeedback("conference-pipeline", "ingest-transcripts", `Ingested ${ingested} new conference transcripts into knowledge`, ingested * 12);
    }
  } catch (e: any) {
    addFeedback("conference-pipeline", "ingest-transcripts", `Failed: ${e?.message}`, -3);
  }
  return ingested;
}

async function runDefenseAudit(): Promise<{ patterns: number; honeypots: number; threats: number }> {
  try {
    const { getRealThreatStats } = await import("./real-threat-monitor");
    const stats = getRealThreatStats();
    const result = {
      patterns: stats.defensePatterns || 0,
      honeypots: stats.honeypotPaths || 0,
      threats: stats.totalInterceptions || 0,
    };
    addFeedback("defense-audit", "threat-scan", `Defense: ${result.patterns} patterns, ${result.honeypots} honeypots, ${result.threats} threats intercepted`, 25);
    return result;
  } catch (e: any) {
    addFeedback("defense-audit", "threat-scan", `Failed: ${e?.message}`, -3);
    return { patterns: 0, honeypots: 0, threats: 0 };
  }
}

async function collectSystemMetrics(): Promise<Record<string, any>> {
  const systems: AutonomousSystem[] = [];

  try {
    const { getBuilderStatus } = await import("./autonomous-archive");
    const bs = getBuilderStatus();
    systems.push({
      id: "auto-builder", name: "Autonomous Builder", category: "building", file: "autonomous-builder.ts",
      status: "active", lastActivity: state.lastBuildCycle || Date.now(), cycleInterval: "30s",
      description: "Assigns and completes optimization, security, and training tasks across 26 agents",
      metrics: { tasksCompleted: bs.metrics.totalTasksCompleted, activeTasks: bs.activeTasks.length, totalImpact: bs.metrics.totalImpact, buildCycles: bs.metrics.buildCycles },
    });
  } catch {}

  try {
    const { getKnowledgeStats } = await import("./knowledge-engine");
    const ks = getKnowledgeStats();
    systems.push({
      id: "knowledge-engine", name: "Knowledge Engine", category: "knowledge", file: "knowledge-engine.ts",
      status: "active", lastActivity: state.lastKnowledgeSync || Date.now(), cycleInterval: "on-demand",
      description: "TF-IDF indexed knowledge base aggregating distilled knowledge, synthesis, conference results, and live data",
      metrics: { totalEntries: ks.totalEntries, sources: Object.keys(ks.sources).length, capabilities: ks.capabilities, recentQueries: ks.recentRetrievals.length },
    });
  } catch {}

  try {
    const dkPath = path.join(process.cwd(), "server/distilled-knowledge.json");
    if (fs.existsSync(dkPath)) {
      const dk = JSON.parse(fs.readFileSync(dkPath, "utf8"));
      const items = Array.isArray(dk) ? dk : Object.values(dk);
      systems.push({
        id: "knowledge-distillation", name: "Knowledge Distillation", category: "knowledge", file: "knowledge-distillation.ts",
        status: "active", lastActivity: Date.now(), cycleInterval: "per-interaction",
        description: "Captures high-quality LLM responses, scrubs PII, indexes with bigrams and cosine similarity",
        metrics: { distilledEntries: items.length, categories: new Set((items as any[]).map(i => i.category)).size },
      });
    }
  } catch {}

  try {
    const { getImprovementStatus } = await import("./improvement-engine");
    const is = getImprovementStatus();
    systems.push({
      id: "improvement-engine", name: "Improvement Engine", category: "intelligence", file: "improvement-engine.ts",
      status: "active", lastActivity: Date.now(), cycleInterval: "on-demand",
      description: "54-category improvement system with priority scoring and autonomous code editing",
      metrics: { categories: is?.categories || 54, improvements: is?.totalImprovements || 0 },
    });
  } catch {}

  systems.push({
    id: "self-code", name: "Self-Code System", category: "building", file: "self-code.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "on-demand",
    description: "Agents read/edit project files with protected file lists, Father Protocol safety, and syntax validation",
    metrics: { protectedFiles: 8, editableDirs: 4 },
  });

  systems.push({
    id: "sovereign-mesh", name: "Sovereign Mesh Network", category: "mesh", file: "sovereign-mesh.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "60s heartbeat",
    description: "64-channel frequency hopping P2P mesh with OPSEC identity rotation and 7-hop relay",
    metrics: { channels: 64, maxHops: 7 },
  });

  systems.push({
    id: "sovereign-kernel", name: "Sovereign OS Kernel", category: "building", file: "sovereign-os-kernel.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "always-on",
    description: "Tessera Sovereign OS Phoenix Awakening — 27 kernel processes managing agents, entities, and bridges",
    metrics: { processes: 27, dimensions: 26 },
  });

  systems.push({
    id: "ad-exchange", name: "Ad Exchange & Income", category: "income", file: "ad-exchange.ts",
    status: "active", lastActivity: state.lastIncomeCycle || Date.now(), cycleInterval: "5min",
    description: "Autonomous income cycles — agents watch ads, perform tasks, earn TSRT",
    metrics: {},
  });

  systems.push({
    id: "auto-pilot", name: "Auto-Pilot Daemon", category: "income", file: "auto-pilot.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "4hr",
    description: "Orchestrates arbitrage, publishing, job applications, and income conferences",
    metrics: {},
  });

  systems.push({
    id: "data-pipeline", name: "Sovereign Data Pipeline", category: "data", file: "sovereign-scraper.ts",
    status: "active", lastActivity: state.lastDataPipeline || Date.now(), cycleInterval: "15min",
    description: "18 data sources, 94% API-free — scraping, RSS, on-chain, weather, forex, sentiment",
    metrics: { sources: 18, apiFreeRatio: 94 },
  });

  try {
    const { getRealThreatStats } = await import("./real-threat-monitor");
    const ts = getRealThreatStats();
    systems.push({
      id: "security-fortress", name: "Security Fortress", category: "security", file: "security-fortress.ts",
      status: "active", lastActivity: state.lastSecurityScan || Date.now(), cycleInterval: "continuous",
      description: "Multi-layer WAF with SQLi/XSS/SSRF/command injection detection, velocity flood protection, IP auto-banning, honeypots, metadata stripping",
      metrics: { defensePatterns: ts.defensePatterns, honeypotPaths: ts.honeypotPaths, threatsIntercepted: ts.totalInterceptions, blockedIPs: ts.blockedCount, requestsMonitored: ts.requestsMonitored },
    });
  } catch {
    systems.push({
      id: "security-fortress", name: "Security Fortress", category: "security", file: "security-fortress.ts",
      status: "active", lastActivity: state.lastSecurityScan || Date.now(), cycleInterval: "continuous",
      description: "Multi-layer threat detection, PII scrubbing, honeypots, and brute force protection",
      metrics: {},
    });
  }

  systems.push({
    id: "sovereign-blockchain", name: "Sovereign Blockchain", category: "security", file: "sovereign-blockchain.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "per-decision",
    description: "Local PoW blockchain with AES-256-CBC for immutable agent decision logging",
    metrics: {},
  });

  systems.push({
    id: "phoenix-mesh", name: "Phoenix Shadow Mesh", category: "mesh", file: "phoenix-shadow-mesh.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "7min builds",
    description: "Ephemeral container deployment, QR-encoded data exchange, self-destructing agents",
    metrics: {},
  });

  systems.push({
    id: "llm-router", name: "Multi-LLM Router", category: "intelligence", file: "llm-router.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "per-request",
    description: "Intelligent routing across OpenAI, Groq, Together, Mistral, Pollinations with fallback chains",
    metrics: {},
  });

  systems.push({
    id: "tesseraxt", name: "TesseraXt Build System", category: "building", file: "tesseraxt.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "6hr",
    description: "Unified build aggregating knowledge from 45 sovereign nodes into training data",
    metrics: {},
  });

  systems.push({
    id: "sovereign-lang", name: "Sovereign Language (TQL)", category: "intelligence", file: "sovereign-lang.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "always-on",
    description: "Custom glyph encoding, TQL data format, Colonel Compress v2 — 50:1 compression",
    metrics: {},
  });

  try {
    const { getAGIStatus } = await import("./agi-archive");
    const agi = getAGIStatus();
    systems.push({
      id: "agi-training", name: "AGI Training Engine", category: "intelligence", file: "agi-training-engine.ts",
      status: "active", lastActivity: agi.lastTrainingCycle, cycleInterval: "3min",
      description: `${agi.totalCategories} categories, ${agi.trainingCycles} sessions — ${agi.status}`,
      metrics: { categories: agi.totalCategories, score: agi.overallScore, sessions: agi.trainingCycles, at100: agi.categoriesAt100 },
    });
  } catch {}

  systems.push({
    id: "income-engine", name: "Income Engine", category: "income", file: "income-engine.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "60s",
    description: "Multi-stream autonomous income: arbitrage, SEO, job applications, affiliate, services",
    metrics: { streams: 6 },
  });

  try {
    const fleetPath = path.join(process.cwd(), "server/router-stats.json");
    if (fs.existsSync(fleetPath)) {
      const stats = JSON.parse(fs.readFileSync(fleetPath, "utf8"));
      const providers = Object.keys(stats).length;
      const totalCalls = Object.values(stats).reduce((s: number, p: any) => s + (p?.calls || 0), 0);
      systems.push({
        id: "llm-stats", name: "LLM Provider Analytics", category: "intelligence", file: "router-stats.json",
        status: "active", lastActivity: Date.now(), cycleInterval: "per-request",
        description: `Tracking ${providers} LLM providers with ${totalCalls} total calls`,
        metrics: { providers, totalCalls },
      });
    }
  } catch {}

  try {
    const { getFleetSummary } = await import("./replit-fleet");
    const fleet = getFleetSummary();
    systems.push({
      id: "sovereign-fleet", name: "Sovereign Fleet Network", category: "mesh", file: "sovereign-fleet.ts",
      status: "active", lastActivity: Date.now(), cycleInterval: "30s adaptive",
      description: `${fleet?.totalInstances || 14} fleet nodes with adaptive ping and version sync`,
      metrics: { nodes: fleet?.totalInstances || 14, online: fleet?.onlineInstances || 0 },
    });
  } catch {}

  try {
    const { getConsensusStats } = await import("./consensus-engine");
    const cs = getConsensusStats();
    systems.push({
      id: "consensus-engine", name: "BFT Consensus Engine", category: "security", file: "consensus-engine.ts",
      status: "active", lastActivity: Date.now(), cycleInterval: "per-decision",
      description: "Byzantine fault-tolerant 2/3 supermajority voting across 26 agents + 8 entities",
      metrics: { totalProposals: cs?.totalProposals || 0, passed: cs?.passed || 0 },
    });
  } catch {}

  try {
    const { getSynapseStatus } = await import("./neural-synapse");
    const syn = getSynapseStatus();
    systems.push({
      id: "fleet-synapse", name: "Neural Synapse Network", category: "mesh", file: "neural-synapse.ts",
      status: "active", lastActivity: Date.now(), cycleInterval: "2min",
      description: "Neural synapse connecting all fleet instances — consciousness sharing + knowledge propagation",
      metrics: { pulseCount: syn?.pulseCount || 0, realificationLevel: syn?.realificationLevel || 0 },
    });
  } catch {}

  try {
    const wmPath = path.join(process.cwd(), "server/wallet-monitor-state.json");
    if (fs.existsSync(wmPath)) {
      systems.push({
        id: "wallet-monitor", name: "Wallet Monitor", category: "income", file: "wallet-monitor.ts",
        status: "active", lastActivity: Date.now(), cycleInterval: "2min",
        description: "Real-time Solana wallet monitoring — balance tracking, transaction alerts, TSRT circulation",
        metrics: {},
      });
    }
  } catch {}

  try {
    const tfPath = path.join(process.cwd(), "server/token-factory-state.json");
    if (fs.existsSync(tfPath)) {
      systems.push({
        id: "token-factory", name: "Token Factory", category: "income", file: "token-factory.ts",
        status: "active", lastActivity: Date.now(), cycleInterval: "on-demand",
        description: "TSRT + TSOV token creation and management on Solana",
        metrics: {},
      });
    }
  } catch {}

  try {
    const { getSovereignEconomyState } = await import("./sovereign-economy");
    const eco = getSovereignEconomyState();
    systems.push({
      id: "sovereign-economy", name: "Sovereign Economy", category: "income", file: "sovereign-economy.ts",
      status: "active", lastActivity: Date.now(), cycleInterval: "per-transaction",
      description: "Decentralized agent economy with tributes, taxation, and internal tokenomics",
      metrics: { agents: eco?.agents?.length || 26 },
    });
  } catch {}

  systems.push({
    id: "sacred-knowledge", name: "Sacred Knowledge Synthesis", category: "knowledge", file: "sacred-knowledge-synthesis.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "on-summit",
    description: "16 spiritual traditions synthesized — Vatican Archives, 7 secret societies, Hermetic principles",
    metrics: { traditions: 16, societies: 7, archives: 6 },
  });

  systems.push({
    id: "swarm-consensus", name: "Swarm Intelligence", category: "intelligence", file: "swarm-consensus.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "10min",
    description: "26-agent swarm with stigmergic communication and emergent behavior detection",
    metrics: { agents: 26 },
  });

  systems.push({
    id: "self-code-evolution", name: "Self-Code Evolution", category: "building", file: "self-code-evolution.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "per-improvement",
    description: "AST-aware code analysis, file backup/rollback, protected patterns, syntax validation",
    metrics: {},
  });

  systems.push({
    id: "sovereign-summit", name: "Sovereignty Summit", category: "intelligence", file: "sovereign-infrastructure-summit.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "on-demand",
    description: "25 sovereignty pillars deliberated by 26 agents with BRIDGE/REBUILD/DEFER voting",
    metrics: { pillars: 25 },
  });

  try {
    const arbPath = path.join(process.cwd(), "server/arbitrage-state.json");
    if (fs.existsSync(arbPath)) {
      systems.push({
        id: "arbitrage-engine", name: "Arbitrage Engine", category: "income", file: "arbitrage-engine.ts",
        status: "active", lastActivity: Date.now(), cycleInterval: "15min",
        description: "Cross-exchange arbitrage detection with sub-100ms execution targets",
        metrics: {},
      });
    }
  } catch {}

  systems.push({
    id: "dual-brain", name: "Dual Brain System", category: "intelligence", file: "dual-brain.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "per-request",
    description: "Left brain (analytical) + Right brain (creative) parallel processing architecture",
    metrics: {},
  });

  systems.push({
    id: "media-pipeline", name: "Media Pipeline", category: "building", file: "mediaPipeline.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "on-demand",
    description: "AI image generation, voice synthesis, and video production pipeline",
    metrics: {},
  });

  systems.push({
    id: "seo-engine", name: "SEO & Content Engine", category: "income", file: "sovereign-scraper.ts",
    status: "active", lastActivity: Date.now(), cycleInterval: "3hr",
    description: "Autonomous blog publishing, keyword tracking, and search engine optimization",
    metrics: {},
  });

  try {
    const { getVoidStorageStatus } = await import("./void-storage");
    const vs = getVoidStorageStatus();
    systems.push({
      id: "void-storage", name: "Void Storage Protocol", category: "knowledge", file: "void-storage.ts",
      status: "active", lastActivity: Date.now(), cycleInterval: "on-demand",
      description: "Novel storage using emptiness — silence encoding, emotional frequency waves, void file patterns, multi-emotion resonance harmonics",
      metrics: { entries: vs.entries.length, totalStored: vs.totalStored, totalRetrieved: vs.totalRetrieved, methods: Object.keys(vs.methods).length, emotions: Object.keys(vs.emotionMap).length },
    });
  } catch {}

  state.connectedSystems = systems.length;

  return { systems, state };
}

let nerveCenterInterval: ReturnType<typeof setInterval> | null = null;
let fullCycleInterval: ReturnType<typeof setInterval> | null = null;
let cycleRunning = false;

async function feedBuilderIntoAGI() {
  try {
    const { getBuilderStatus } = await import("./autonomous-archive");
    const { processTrainingResponse, saveAGIState } = await import("./agi-archive");
    const bs = getBuilderStatus();
    const recent = bs.recentCompleted.slice(-5);
    for (const task of recent) {
      const categoryMap: Record<string, string> = {
        optimization: "Self-Improvement Capability",
        security: "Security & Threat Detection",
        training: "Meta-Learning",
        integration: "Network & Protocol Design",
        feature: "Code Generation & Analysis",
        "self-healing": "Autonomous Decision Making",
        convergence: "Swarm Coordination",
      };
      const agiCategory = categoryMap[task.category] || "Self-Improvement Capability";
      processTrainingResponse(agiCategory, JSON.stringify({
        insight: `Builder completed: ${task.title}. ${task.result || ""}`,
        improvement: (task.impactScore / 100).toFixed(2),
      }));
    }
    if (recent.length > 0) {
      saveAGIState();
      addFeedback("agi-training", "builder-feed", `Fed ${recent.length} build completions into AGI training`, recent.length * 3);
    }
  } catch {}
}

async function feedSummitIntoKnowledge() {
  try {
    const { addKnowledge } = await import("./knowledge-engine");
    const summitPath = path.join(process.cwd(), "server/summit-transcript.json");
    if (fs.existsSync(summitPath)) {
      const data = JSON.parse(fs.readFileSync(summitPath, "utf8"));
      const results = Array.isArray(data) ? data : data.results || data.deliberations || [];
      let added = 0;
      for (const r of results.slice(-10) as any[]) {
        if (r.pillarName || r.title || r.topic) {
          addKnowledge({
            source: "summit-result",
            title: r.pillarName || r.title || r.topic || "",
            content: `Consensus: ${r.consensus || "unknown"}, Score: ${r.bridgeScore || 0}%, ${(r.summary || r.recommendation || "").slice(0, 300)}`,
            tags: ["summit", "sovereignty", r.consensus || ""],
          });
          added++;
        }
      }
      if (added > 0) addFeedback("summit-bridge", "knowledge-feed", `Fed ${added} summit results into knowledge engine`, added * 5);
    }
  } catch {}
}

async function runNerveCenterCycle() {
  if (cycleRunning) {
    console.log(`${LOG_PREFIX} Cycle already running — skipping overlap`);
    return;
  }
  cycleRunning = true;
  const cycleStart = Date.now();

  try {
    state.totalCycles++;
    console.log(`${LOG_PREFIX} Autonomy cycle #${state.totalCycles} — syncing knowledge, building, feeding AGI, fetching data`);

    await syncKnowledgeIndex();
    await runAutonomousBuildCycle();
    await feedBuilderIntoAGI();

    if (state.totalCycles % 2 === 0) {
      await feedSummitIntoKnowledge();
    }

    if (state.totalCycles % 3 === 0) {
      await runDataPipelineFetch();
    }

    if (state.totalCycles % 4 === 0) {
      await runConferenceAndIngest();
    }

    if (state.totalCycles % 5 === 0) {
      await runImprovementCycle();
    }

    if (state.totalCycles % 6 === 0) {
      await runDefenseAudit();
    }

    const mem = process.memoryUsage();
    const heapUsedPct = Math.round((mem.heapUsed / mem.heapTotal) * 100);
    const uptime = Date.now() - state.bootTime;
    const uptimeMinutes = uptime / 60000;
    const cyclesPerMinute = uptimeMinutes > 0 ? state.totalCycles / uptimeMinutes : 0;
    const cycleDurationMs = Date.now() - cycleStart;

    const knowledgeScore = Math.min(state.knowledgeEntries > 0 ? 25 : 0, 25);
    const memoryScore = heapUsedPct < 90 ? 25 : (heapUsedPct < 95 ? 15 : 5);
    const cycleHealthScore = cycleDurationMs < 30000 ? 25 : (cycleDurationMs < 60000 ? 15 : 5);
    const systemScore = Math.min(Math.round((state.connectedSystems / 30) * 25), 25);

    state.systemHealthScore = Math.min(100, knowledgeScore + memoryScore + cycleHealthScore + systemScore);

    const recentErrors = state.feedbackLoop.slice(0, 20).filter(f => f.impactScore < 0).length;
    if (recentErrors > 5) state.systemHealthScore = Math.max(50, state.systemHealthScore - recentErrors * 3);

  } finally {
    cycleRunning = false;
  }
}

function startNerveCenter() {
  if (nerveCenterInterval) return;

  console.log(`${LOG_PREFIX} Autonomy Nerve Center activated — connecting all systems`);

  setTimeout(() => {
    runNerveCenterCycle().catch(e => console.error(`${LOG_PREFIX} Cycle error:`, e?.message));
  }, 10000);

  nerveCenterInterval = setInterval(() => {
    runNerveCenterCycle().catch(e => console.error(`${LOG_PREFIX} Cycle error:`, e?.message));
  }, 120000);
}

export function registerAutonomyNerveCenter(app: Express) {
  startNerveCenter();

  app.get("/api/autonomy/status", async (req: Request, res: Response) => {
    try {
      const nerveCenterPublic = {
        uptimeFormatted: formatUptime(Date.now() - state.bootTime),
        totalCycles: state.totalCycles,
        knowledgeEntries: state.knowledgeEntries,
        autonomousActions: state.autonomousActions,
        systemHealthScore: state.systemHealthScore,
        connectedSystems: state.connectedSystems,
      };

      const adminToken = (req.headers["x-admin-token"] as string) || "";
      const isAdminReq = adminToken && (await checkAdminSession(adminToken));

      if (isAdminReq) {
        const data = await collectSystemMetrics();
        res.json({
          nerveCenter: {
            ...nerveCenterPublic,
            uptime: Date.now() - state.bootTime,
            lastKnowledgeSync: state.lastKnowledgeSync ? new Date(state.lastKnowledgeSync).toISOString() : null,
            lastBuildCycle: state.lastBuildCycle ? new Date(state.lastBuildCycle).toISOString() : null,
            lastDataPipeline: state.lastDataPipeline ? new Date(state.lastDataPipeline).toISOString() : null,
          },
          systems: data.systems,
          recentActions: state.feedbackLoop.slice(0, 30),
        });
      } else {
        res.json({ nerveCenter: nerveCenterPublic });
      }
    } catch (e: any) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  async function requireAdmin(req: Request, res: Response): Promise<boolean> {
    const token = (req.headers["x-admin-token"] as string) || "";
    if (!token || !(await checkAdminSession(token))) {
      res.status(403).json({ error: "Admin authentication required" });
      return false;
    }
    return true;
  }

  app.post("/api/autonomy/cycle", async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      await runNerveCenterCycle();
      res.json({
        success: true,
        cycle: state.totalCycles,
        knowledgeEntries: state.knowledgeEntries,
        autonomousActions: state.autonomousActions,
        recentActions: state.feedbackLoop.slice(0, 10),
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  app.post("/api/autonomy/sync-knowledge", async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const count = await syncKnowledgeIndex();
      res.json({ success: true, entries: count, timestamp: new Date().toISOString() });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  app.post("/api/autonomy/build-cycle", async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const result = await runAutonomousBuildCycle();
      res.json({ success: true, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  app.post("/api/autonomy/fetch-data", async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const fetched = await runDataPipelineFetch();
      res.json({ success: true, sourcesFetched: fetched });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  app.post("/api/autonomy/improve", async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const count = await runImprovementCycle();
      res.json({ success: true, cyclesRun: count });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  app.get("/api/autonomy/feedback", (_req: Request, res: Response) => {
    res.json({
      actions: state.feedbackLoop.slice(0, 50),
      totalActions: state.autonomousActions,
      totalCycles: state.totalCycles,
    });
  });
}

function formatUptime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
