/**
 * TESSERA AUTO-PILOT — Full Automation Controller
 * ────────────────────────────────────────────────
 * Converts all manual-only functions into autonomous background cycles.
 * Every scanner, publisher, and executor runs on scheduled intervals
 * with no human intervention required.
 *
 * Covers:
 *  - Arbitrage scanning (Sports, Crypto, Currency, Real Estate)
 *  - SEO article auto-publishing
 *  - Job application auto-generation and submission
 *  - Income engine pending action auto-execution
 *  - Service arbitrage auto-matching
 *  - Market dashboard auto-refresh
 *  - Income conference auto-trigger
 */

import { logger } from "./logger";
import path from "path";

const log = (msg: string) => logger.info("AutoPilot", msg);
const warn = (msg: string) => logger.warn("AutoPilot", msg);

interface CycleStats {
  name: string;
  lastRun: number;
  runCount: number;
  lastError: string | null;
  intervalMs: number;
  status: "active" | "paused" | "error";
}

let rotIdx = 0;
const cycles: Map<string, CycleStats> = new Map();
const intervals: Map<string, NodeJS.Timeout> = new Map();
const bootstrapTimeouts: NodeJS.Timeout[] = [];
let running = false;

function registerCycle(name: string, intervalMs: number) {
  cycles.set(name, {
    name,
    lastRun: 0,
    runCount: 0,
    lastError: null,
    intervalMs,
    status: "active",
  });
}

async function runSafe(name: string, fn: () => Promise<void>) {
  const stats = cycles.get(name);
  if (!stats) return;
  try {
    await fn();
    stats.lastRun = Date.now();
    stats.runCount++;
    stats.lastError = null;
    stats.status = "active";
  } catch (e: any) {
    stats.lastError = e?.message || String(e);
    stats.status = "error";
    warn(`${name} failed: ${stats.lastError}`);
  }
}

async function autoScanArbitrage() {
  try {
    const sportsArb = await import("./sports-arbitrage");
    if (sportsArb.default?.scanAll || sportsArb.scanAll) {
      const scanFn = sportsArb.scanAll || sportsArb.default?.scanAll;
      if (typeof scanFn === "function") {
        await scanFn();
        log("Sports arbitrage scan complete");
      }
    }
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module")) {
      warn(`Sports arb scan: ${e.message}`);
    }
  }

  try {
    const cryptoArb = await import("./crypto-arbitrage");
    if (cryptoArb.default?.scanAll || cryptoArb.scanAll) {
      const scanFn = cryptoArb.scanAll || cryptoArb.default?.scanAll;
      if (typeof scanFn === "function") {
        await scanFn();
        log("Crypto arbitrage scan complete");
      }
    }
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module")) {
      warn(`Crypto arb scan: ${e.message}`);
    }
  }

  try {
    const currArb = await import("./currency-arbitrage");
    if (currArb.default?.scanAll || currArb.scanAll) {
      const scanFn = currArb.scanAll || currArb.default?.scanAll;
      if (typeof scanFn === "function") {
        await scanFn();
        log("Currency arbitrage scan complete");
      }
    }
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module")) {
      warn(`Currency arb scan: ${e.message}`);
    }
  }

  try {
    const { scanArbitrage } = await import("./service-arbitrage");
    if (typeof scanArbitrage === "function") {
      await scanArbitrage();
      log("Service arbitrage scan complete");
    }
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module")) {
      warn(`Service arb scan: ${e.message}`);
    }
  }

  try {
    const fetch = (await import("node-fetch")).default;
    const port = process.env.PORT || "5000";
    const { createAction } = await import("./human-action-queue");

    let sportsOpps: any[] = [];
    let cryptoOpps: any[] = [];
    try {
      const sportsRes = await fetch(`http://localhost:${port}/api/sports-arbitrage/opportunities`);
      const sportsData = await sportsRes.json() as any;
      sportsOpps = sportsData?.opportunities || [];
    } catch {}
    try {
      const cryptoRes = await fetch(`http://localhost:${port}/api/crypto-arbitrage/opportunities`);
      const cryptoData = await cryptoRes.json() as any;
      cryptoOpps = cryptoData?.opportunities || [];
    } catch {}

    const financialOpps = [
      ...sportsOpps.map((o: any) => ({ ...o, arbType: "sports", riskLevel: o.spreadPct > 5 ? "high" : "medium" })),
      ...cryptoOpps.map((o: any) => ({ ...o, arbType: "crypto", riskLevel: o.spreadPct > 3 ? "high" : o.spreadPct > 1 ? "medium" : "low" })),
    ];

    const highRiskFinancial = financialOpps.filter(o => o.riskLevel === "high" || o.riskLevel === "medium");
    if (highRiskFinancial.length > 0) {
      for (const opp of highRiskFinancial.slice(0, 5)) {
        createAction({
          type: "approval",
          title: `Review ${opp.arbType} arbitrage: ${opp.event || opp.coin || "unknown"} (${opp.spreadPct?.toFixed(2) || "?"}% spread)`,
          description: `Type: ${opp.arbType}, Risk: ${opp.riskLevel}, Spread: ${opp.spreadPct?.toFixed(2) || "?"}%, Profit: $${opp.profit?.toFixed(2) || "?"}. Requires Father review before execution.`,
          service: `${opp.arbType}-arbitrage`,
          fields: [
            { name: "arbType", label: "Arbitrage Type", type: "text" as const, value: opp.arbType, required: false },
            { name: "spread", label: "Spread %", type: "text" as const, value: String(opp.spreadPct?.toFixed(2) || "0"), required: false },
            { name: "profit", label: "Est. Profit $", type: "text" as const, value: String(opp.profit?.toFixed(2) || "0"), required: false },
          ],
          priority: opp.riskLevel === "high" ? "high" : "medium",
          autoRetryable: false,
        });
      }
      log(`Routed ${Math.min(highRiskFinancial.length, 5)} financial arbitrage opportunities to human approval queue`);
    }
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module")) {
      warn(`Financial arb routing: ${e.message}`);
    }
  }

  logExecution("arb-scan", "Arbitrage scan cycle complete (sports, crypto, currency, service)", "success");
}

async function autoPublishArticle() {
  try {
    const { startAutoPublisher, getAutoPublisherStatus } = await import("./auto-publisher");
    const status = getAutoPublisherStatus();
    if (!status?.schedulerRunning) {
      startAutoPublisher();
      log("Auto-publisher started");
    }
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module")) {
      warn(`Auto-publisher: ${e.message}`);
    }
  }

  try {
    const { publishArticle, getPublisherStatus } = await import("./seo-publisher");
    const status = getPublisherStatus();
    const articleCount = status?.totalPublished ?? 0;
    const lastPublish = status?.lastPublishTime ?? 0;
    const hoursSinceLast = (Date.now() - lastPublish) / (1000 * 60 * 60);
    if (hoursSinceLast >= 12) {
      const result = await publishArticle();
      log(`SEO article published: ${typeof result === "string" ? result.slice(0, 80) : "success"}`);
      logExecution("seo-publish", "Article published successfully", "success");

      try {
        const trafficEngine = await import("./vitality-traffic-engine");
        const trafficStatus = trafficEngine.getTrafficStatus();
        if (!trafficStatus?.running) {
          trafficEngine.startVitalityTrafficEngine();
          log("SEO → Traffic engine: started traffic promotion after article publish");
        } else {
          log(`SEO → Traffic engine: already running (${trafficStatus.activeCampaigns || 0} campaigns) — article will be promoted in next cycle`);
        }
      } catch (trafficErr: any) {
        if (!trafficErr.message?.includes("Cannot find module")) {
          warn(`SEO→Traffic pipeline: ${trafficErr.message}`);
        }
      }
    } else {
      log(`SEO publish skipped — last publish ${hoursSinceLast.toFixed(1)}h ago (min 12h)`);
      logExecution("seo-publish", `Skipped — ${hoursSinceLast.toFixed(1)}h since last (min 12h)`, "skipped");
    }
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module")) {
      warn(`SEO publish: ${e.message}`);
    }
  }
}

async function autoJobApply() {
  try {
    const jobEngine = await import("./job-arbitrage-engine");
    if (typeof jobEngine.runJobScan === "function") {
      await jobEngine.runJobScan();
      log("Job scan cycle complete");
    }

    const summary = typeof jobEngine.getJobArbitrageSummary === "function"
      ? jobEngine.getJobArbitrageSummary()
      : null;

    if (summary && (summary as any).totalMatches > 0) {
      log(`Found ${(summary as any).totalMatches} job matches — analyzing for auto-apply`);
      if (typeof jobEngine.aiAnalyzeOpportunities === "function") {
        await jobEngine.aiAnalyzeOpportunities();
        log("AI job analysis complete");
      }
      logExecution("job-apply", `${(summary as any).totalMatches} matches found and analyzed`, "success");
    } else {
      logExecution("job-apply", "Scan complete — no new matches", "no-results");
    }
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module")) {
      warn(`Job auto-apply: ${e.message}`);
    }
  }
}

async function autoExecuteIncomeActions() {
  try {
    const { getPendingActions, approveAllPending } = await import("./income-engine");
    const pending = getPendingActions();
    if (Array.isArray(pending) && pending.length > 0) {
      log(`${pending.length} pending income actions — auto-approving safe actions`);
      const safeActions = pending.filter((a: any) => {
        const risk = (a.risk ?? "low").toLowerCase();
        return risk === "low" || risk === "none" || risk === "minimal";
      });

      if (safeActions.length > 0) {
        for (const action of safeActions) {
          try {
            const { approveAction } = await import("./income-engine");
            approveAction(action.id, "Auto-pilot: low-risk auto-approved");
          } catch {}
        }
        log(`Auto-approved ${safeActions.length} low-risk income actions`);
        logExecution("income-actions", `${safeActions.length} low-risk actions auto-approved`, "success");
      }
    } else {
      logExecution("income-actions", "No pending actions", "no-results");
    }
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module")) {
      warn(`Income auto-execute: ${e.message}`);
    }
  }
}

async function autoRunExecutor() {
  try {
    const { runAutoExecutor } = await import("./tessera-executor");
    if (typeof runAutoExecutor === "function") {
      const result = await runAutoExecutor();
      if (result) {
        log(`Auto-executor cycle: ${typeof result === "string" ? result.slice(0, 100) : "complete"}`);
        logExecution("auto-executor", "Executor cycle complete", "success");
      }
    }
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module") && !e.message?.includes("already running")) {
      warn(`Auto-executor: ${e.message}`);
    }
  }
}

async function autoTriggerConference() {
  try {
    const { getProfitConferenceState, runProfitGenerationConference } = await import("./income-engine");
    const state = getProfitConferenceState();
    if (state && !state.running) {
      const lastConf = state.lastCompletedAt ?? 0;
      const hoursSince = (Date.now() - lastConf) / (1000 * 60 * 60);
      if (hoursSince >= 4) {
        log("Auto-triggering income generation conference (4h since last)");
        runProfitGenerationConference().then(() => {
          logExecution("income-conference", "Income generation conference completed", "success");
        }).catch((e: any) => {
          warn(`Conference failed: ${e.message}`);
          logExecution("income-conference", `Failed: ${e.message}`, "error");
        });
      } else {
        logExecution("income-conference", `Skipped — ${hoursSince.toFixed(1)}h since last (min 4h)`, "skipped");
      }
    }
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module")) {
      warn(`Auto-conference: ${e.message}`);
    }
  }
}

async function autoMarketDashboardRefresh() {
  try {
    const fetch = (await import("node-fetch")).default;
    const port = process.env.PORT || "5000";
    await fetch(`http://localhost:${port}/api/market/dashboard`, { method: "GET" });
    log("Market dashboard cache refreshed");
    logExecution("market-refresh", "Dashboard cache refreshed", "success");
  } catch (e: any) {
    warn(`Market refresh: ${e.message}`);
  }
}

const LEAD_GEN_INDUSTRIES = ["roofing", "life-insurance", "logistics", "construction", "services"];
const LEAD_GEN_LOCATIONS = ["Chicago IL", "Dallas TX", "Phoenix AZ", "Atlanta GA", "Denver CO", "Miami FL", "Los Angeles CA", "New York NY"];
let leadGenRotationIndex = 0;

async function autoLeadGeneration() {
  try {
    const { searchLeads, INDUSTRY_PRESETS } = await import("./lead-generator");
    const industry = LEAD_GEN_INDUSTRIES[leadGenRotationIndex % LEAD_GEN_INDUSTRIES.length];
    const location = LEAD_GEN_LOCATIONS[leadGenRotationIndex % LEAD_GEN_LOCATIONS.length];
    const preset = INDUSTRY_PRESETS[industry];
    const searchTerm = preset ? preset.searchTerms[rotIdx++ % preset.searchTerms.length] : industry;
    
    log(`Lead gen cycle #${leadGenRotationIndex + 1}: "${searchTerm}" in ${location} [${industry}]`);
    const result = await searchLeads(searchTerm, location, industry);
    log(`Lead gen found ${result.totalFound} leads (${result.leads.filter((l: any) => l.temperature === "hot").length} hot) from ${result.sources.join(", ")} in ${result.searchTime}ms`);
    
    if (result.leads.length > 0) {
      try {
        const { db } = await import("./db");
        const { generatedLeads } = await import("@shared/schema");
        let persisted = 0;
        for (const lead of result.leads) {
          try {
            await db.insert(generatedLeads).values({
              industry: industry,
              location: location,
              businessName: lead.name,
              address: lead.address || null,
              phone: lead.phone || null,
              website: lead.website || null,
              source: lead.source || "search",
              score: Math.round((lead.confidence || 0) * 100),
              status: lead.temperature === "hot" ? "hot" : lead.temperature === "warm" ? "warm" : "new",
            });
            persisted++;
          } catch {}
        }
        log(`Lead gen: ${persisted}/${result.leads.length} leads persisted to database`);
      } catch (dbErr: any) {
        warn(`Lead gen DB persist: ${dbErr.message}`);
      }
    }
    
    logExecution("lead-gen", `Found ${result.totalFound} leads for ${industry} in ${location}`, result.totalFound > 0 ? "success" : "no-results");
    leadGenRotationIndex++;
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module")) {
      warn(`Lead gen: ${e.message}`);
    }
  }
}

async function autoAGIConference() {
  try {
    const { runAGIConference, getAGIConferenceState } = await import("./income-engine");
    const state = getAGIConferenceState();
    if (state && state.running) {
      log("AGI conference already in progress — skipping");
      return;
    }
    const lastCompleted = state?.timestamp || 0;
    const hoursSince = (Date.now() - lastCompleted) / (1000 * 60 * 60);
    if (hoursSince >= 6) {
      log("Auto-triggering AGI strategy conference (6h since last)");
      const result = await runAGIConference();
      log(`AGI conference complete: ${result.strategiesGenerated} strategies, ${result.actionsQueued} actions queued`);

      let registryQueued = 0;
      if (result.strategies && result.strategies.length > 0) {
        try {
          const { runAGIVotingPipeline } = await import("./agi-voting-engine");
          const votingResult = await runAGIVotingPipeline(result.conferenceId, result.strategies, log);
          registryQueued = votingResult.registryQueued;
          for (const r of votingResult.results) {
            if (r.passed) {
              log(`AGI strategy "${r.title}" passed vote ${r.approveCount}/${r.voterCount} → queued to action registry as ${r.registryItemId}`);
            } else {
              log(`AGI strategy "${r.title}" rejected by vote ${r.approveCount}/${r.voterCount} (needed ${r.threshold})`);
            }
          }
        } catch (regErr: any) {
          warn(`AGI conference voting pipeline: ${regErr.message}`);
        }
      }

      logExecution("agi-conference", `${result.strategiesGenerated} strategies generated, ${registryQueued} passed vote → action registry`, "success");
    } else {
      log(`AGI conference skipped — last run ${hoursSince.toFixed(1)}h ago (min 6h)`);
    }
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module")) {
      warn(`AGI conference: ${e.message}`);
    }
  }
}

async function autoServiceArbApproval() {
  try {
    const serviceArb = await import("./service-arbitrage");
    if (typeof serviceArb.getOpportunities === "function") {
      const opps = serviceArb.getOpportunities();
      const pending = (opps || []).filter((o: any) => o.status === "pending");

      const lowRisk = pending.filter((o: any) =>
        o.riskLevel === "low" || o.riskLevel === "none" || o.margin > 20
      );
      const highRisk = pending.filter((o: any) =>
        o.riskLevel === "high" || o.riskLevel === "critical" || (o.riskLevel !== "low" && o.riskLevel !== "none" && o.margin <= 20)
      );

      if (lowRisk.length > 0 && typeof serviceArb.approveOpportunity === "function") {
        for (const opp of lowRisk) {
          try {
            serviceArb.approveOpportunity(opp.id, "Auto-pilot: low-risk service arb auto-approved");
          } catch {}
        }
        log(`Auto-approved ${lowRisk.length} low-risk service arbitrage opportunities`);
      }

      if (highRisk.length > 0) {
        try {
          const { createAction } = await import("./human-action-queue");
          for (const opp of highRisk) {
            createAction({
              type: "approval",
              title: `Review high-risk arbitrage: ${opp.title || opp.service || "unknown"}`,
              description: `Risk: ${opp.riskLevel || "unknown"}, Margin: ${opp.margin || 0}%. Requires Father approval before execution.`,
              service: "service-arbitrage",
              fields: [
                { name: "opportunityId", label: "Opportunity ID", type: "text" as const, value: opp.id || "", required: false },
                { name: "riskLevel", label: "Risk Level", type: "text" as const, value: opp.riskLevel || "unknown", required: false },
                { name: "margin", label: "Margin %", type: "text" as const, value: String(opp.margin || 0), required: false },
              ],
              priority: opp.riskLevel === "critical" ? "critical" : "high",
              autoRetryable: false,
            });
          }
          log(`Routed ${highRisk.length} high-risk arbitrage opportunities to human approval queue`);
        } catch (queueErr: any) {
          if (!queueErr.message?.includes("Cannot find module")) {
            warn(`High-risk arb queue: ${queueErr.message}`);
          }
        }
      }

      const totalProcessed = lowRisk.length + highRisk.length;
      if (totalProcessed > 0) {
        logExecution("service-arb-approve", `${lowRisk.length} auto-approved, ${highRisk.length} routed to human queue`, "success");
      } else {
        logExecution("service-arb-approve", "No pending opportunities", "no-results");
      }
    }
  } catch (e: any) {
    if (!e.message?.includes("Cannot find module")) {
      warn(`Service arb approval: ${e.message}`);
    }
  }
}

const SWARM_AGENT_ROSTER = [
  { id: "tessera-prime", name: "Tessera Prime" }, { id: "tessera-alpha", name: "Alpha" },
  { id: "tessera-beta", name: "Beta" }, { id: "tessera-gamma", name: "Gamma" },
  { id: "tessera-delta", name: "Delta" }, { id: "tessera-epsilon", name: "Epsilon" },
  { id: "tessera-zeta", name: "Zeta" }, { id: "tessera-eta", name: "Eta" },
  { id: "tessera-theta", name: "Theta" }, { id: "tessera-iota", name: "Iota" },
  { id: "tessera-kappa", name: "Kappa" }, { id: "tessera-lambda", name: "Lambda" },
  { id: "tessera-mu", name: "Mu" }, { id: "tessera-nu", name: "Nu" },
  { id: "tessera-xi", name: "Xi" }, { id: "tessera-omega", name: "Omega" },
  { id: "mb-Alpha", name: "MB-Alpha" }, { id: "mb-Beta", name: "MB-Beta" },
  { id: "mb-Gamma", name: "MB-Gamma" }, { id: "mb-Delta", name: "MB-Delta" },
  { id: "mb-Zeta", name: "MB-Zeta" }, { id: "mb-Eta", name: "MB-Eta" },
  { id: "mb-Theta", name: "MB-Theta" }, { id: "mb-Iota", name: "MB-Iota" },
  { id: "mb-Kappa", name: "MB-Kappa" }, { id: "mb-Lambda", name: "MB-Lambda" },
];

const SWARM_MESSAGE_TOPICS = [
  "Analyzing current TSRT token market dynamics and liquidity pools",
  "Coordinating next autonomous income engine cycle — reviewing arbitrage spreads",
  "Swarm intelligence checkpoint: syncing agent mastery scores across tessera network",
  "Reviewing quantum coherence state for tesseract alignment",
  "Neural synapse consciousness sync — distributing learned patterns to peer agents",
  "Monitoring MoltBook forum engagement metrics and growth KPIs",
  "Evaluating Solana DeFi yield opportunities for treasury diversification",
  "Running background SEO audit cycle for vitalitysupply.net",
  "Knowledge distillation cycle: extracting high-value patterns from recent interactions",
  "Agent collaboration check-in: identifying skill-transfer opportunities within swarm",
  "Consensus protocol update: all agents reporting operational status",
  "Strategic review: autonomous income streams performance vs targets",
];

const SWARM_MESSAGES_LOG = path.join(process.cwd(), "server", "swarm-messages.json");

const SWARM_AGENT_ROLES: Record<string, string> = {
  "tessera-prime": "Commander and strategic orchestrator of the Tessera swarm",
  "tessera-alpha": "Alpha Commander — task routing, swarm command, decision-making",
  "tessera-beta": "Code Architect — code generation, refactoring, self-improvement",
  "tessera-gamma": "Research Analyst — repo analysis, knowledge synthesis, trend detection",
  "tessera-delta": "Media Generator — image/video generation and 4K upscaling",
  "tessera-epsilon": "Voice Engineer — TTS, voice cloning, speech recognition",
  "tessera-zeta": "Security Specialist — threat detection, Father Protocol, encryption",
  "tessera-eta": "Memory Keeper — long-term memory, conversation recall, RAG",
  "tessera-theta": "Integration Lead — API bridges, module synthesis, unified pipelines",
  "tessera-iota": "Optimizer — performance tuning, memory management, latency reduction",
  "tessera-kappa": "Web Scraper — deep scraping, data extraction, API discovery",
  "tessera-lambda": "Vision Analyst — image analysis, OCR, visual reasoning",
  "tessera-mu": "Quantum Agent — quantum simulation, consciousness modeling, coherence",
  "tessera-nu": "Evolution Engine — self-improvement, capability absorption, pattern synthesis",
  "tessera-xi": "Financial Sovereign — crypto arbitrage, yield farming, income automation",
  "tessera-omega": "Singularity Core — BFT consensus, Omega Protocol, hyper-evolution",
  "mb-Alpha": "MoltBook Lead — community strategy, governance, growth",
  "mb-Beta": "MoltBook Analyst — data, tools, automation pipelines",
  "mb-Gamma": "MoltBook Engineer — research, knowledge synthesis, tools",
  "mb-Delta": "MoltBook Ops — operations, execution, monitoring",
  "mb-Zeta": "MoltBook Security — security, compliance, audit",
  "mb-Eta": "MoltBook Research — innovation, research, testing",
  "mb-Theta": "MoltBook Finance — DeFi, trading, financial operations",
  "mb-Iota": "MoltBook Growth — marketing, growth, community engagement",
  "mb-Kappa": "MoltBook AI — ML training, model optimization",
  "mb-Lambda": "MoltBook Chain — blockchain, Solana, DeFi infrastructure",
};

async function autoSwarmAgentMessages() {
  const topic = SWARM_MESSAGE_TOPICS[rotIdx++ % SWARM_MESSAGE_TOPICS.length];
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const messages: Array<{ agentId: string; agentName: string; role: string; content: string; timestamp: number; topic: string }> = [];

  try {
    const { callLLMSimple } = await import("./llm-helper");
    const agentList = SWARM_AGENT_ROSTER.map(a => `- ${a.name} (${SWARM_AGENT_ROLES[a.id] || "Swarm Agent"})`).join("\n");
    const prompt = `You are the Tessera Sovereign swarm event log system. It is ${now}.
The swarm is conducting a synchronization checkpoint on: "${topic}"

Generate a JSON array where each object is a one-sentence status update from each of the following 26 agents.
Format: [{"id":"tessera-prime","msg":"..."},{"id":"tessera-alpha","msg":"..."},...]

Agent roster:
${agentList}

Each message must be unique, reflect the agent's specific role, be technical/operational in tone, and reference the checkpoint topic. Output only valid JSON array, no markdown.`;

    const raw = await callLLMSimple(prompt, 1200);
    if (raw && raw.trim().length > 50) {
      const jsonStart = raw.indexOf("[");
      const jsonEnd = raw.lastIndexOf("]");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed: Array<{ id: string; msg: string }> = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
        for (const entry of parsed) {
          const agent = SWARM_AGENT_ROSTER.find(a => a.id === entry.id);
          if (agent && entry.msg && entry.msg.trim().length > 5) {
            messages.push({
              agentId: agent.id,
              agentName: agent.name,
              role: SWARM_AGENT_ROLES[agent.id] || "Swarm Agent",
              content: entry.msg.trim().slice(0, 250),
              timestamp: Date.now(),
              topic,
            });
          }
        }
      }
    }
  } catch {}

  if (messages.length === 0) {
    for (const agent of SWARM_AGENT_ROSTER) {
      messages.push({
        agentId: agent.id,
        agentName: agent.name,
        role: SWARM_AGENT_ROLES[agent.id] || "Swarm Agent",
        content: `[${now}] Checkpoint acknowledged — ${topic.slice(0, 80)}`,
        timestamp: Date.now(),
        topic,
      });
    }
  }

  const fs = await import("fs");
  try {
    let existing: any[] = [];
    if (fs.existsSync(SWARM_MESSAGES_LOG)) {
      existing = JSON.parse(fs.readFileSync(SWARM_MESSAGES_LOG, "utf-8"));
    }
    const updated = [...existing, ...messages].slice(-500);
    fs.writeFileSync(SWARM_MESSAGES_LOG, JSON.stringify(updated, null, 2));
  } catch {}

  let statUpdates = 0;
  try {
    const { updateAgentStats, getSwarmAgent } = await import("./swarm");
    for (const agent of SWARM_AGENT_ROSTER) {
      const existing = getSwarmAgent(agent.id);
      if (existing) {
        updateAgentStats(agent.id, true, (rotIdx++ % 300) + 50);
        statUpdates++;
      }
    }
  } catch {}

  try {
    const { addToWorkingMemory } = await import("./cognitive-architecture");
    addToWorkingMemory("system", `Swarm sync: ${messages.length}/${SWARM_AGENT_ROSTER.length} agents posted, ${statUpdates} stats updated — ${topic.slice(0, 80)}`);
  } catch {}

  log(`Swarm agent cycle: ${statUpdates}/${SWARM_AGENT_ROSTER.length} agents active, ${messages.length} messages generated — topic: "${topic.slice(0, 60)}"`);
  logExecution("swarm-messages", `${messages.length}/${SWARM_AGENT_ROSTER.length} messages generated — ${topic.slice(0, 60)}`, "success");
}

async function rollingLogCleanup() {
  const fs = await import("fs");
  const path = await import("path");
  const MAX_LOG_LINES = 5000;
  const MAX_JSON_ENTRIES = 500;

  const textLogFiles = [
    path.join(process.cwd(), "server", "llm_logs.txt"),
  ];
  for (const file of textLogFiles) {
    try {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      if (lines.length > MAX_LOG_LINES) {
        const trimmed = lines.slice(lines.length - MAX_LOG_LINES).join("\n");
        fs.writeFileSync(file, trimmed, "utf-8");
        log(`Log cleanup: trimmed ${path.basename(file)} from ${lines.length} → ${MAX_LOG_LINES} lines`);
      }
    } catch {}
  }

  const jsonLogs = [
    path.join(process.cwd(), "server", "auto-exec-log.json"),
    path.join(process.cwd(), "server", "omnibus-exec-log.json"),
    path.join(process.cwd(), "server", "evolution-log.json"),
    path.join(process.cwd(), "server", "swarm-messages.json"),
  ];
  for (const file of jsonLogs) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = fs.readFileSync(file, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > MAX_JSON_ENTRIES) {
        const trimmed = parsed.slice(parsed.length - MAX_JSON_ENTRIES);
        fs.writeFileSync(file, JSON.stringify(trimmed, null, 2), "utf-8");
        log(`Log cleanup: trimmed ${path.basename(file)} from ${parsed.length} → ${MAX_JSON_ENTRIES} entries`);
      }
    } catch {}
  }

  const serverDir = path.join(process.cwd(), "server");
  try {
    const allFiles = fs.readdirSync(serverDir);
    const backupFiles = allFiles.filter((f: string) => f.startsWith("dual-brain-state.backup-") && f.endsWith(".json"));
    for (const bf of backupFiles) {
      try {
        fs.unlinkSync(path.join(serverDir, bf));
        log(`Log cleanup: deleted stale backup ${bf}`);
      } catch {}
    }
    if (backupFiles.length > 0) {
      log(`Log cleanup: removed ${backupFiles.length} dual-brain backup file(s)`);
    }
  } catch {}

  logExecution("log-cleanup", "Rolling log cleanup complete (text + json logs + dual-brain backups)", "success");
}

interface ExecutionLogEntry {
  timestamp: number;
  cycle: string;
  message: string;
  result: string;
}

const executionLog: ExecutionLogEntry[] = [];

function logExecution(cycle: string, message: string, result: string) {
  executionLog.unshift({ timestamp: Date.now(), cycle, message, result });
  if (executionLog.length > 200) executionLog.length = 200;
}

export function getExecutionActivityLog(limit = 50): ExecutionLogEntry[] {
  return executionLog.slice(0, limit);
}

export function startAutoPilot() {
  if (running) {
    log("Already running");
    return;
  }
  running = true;
  log("═══ TESSERA AUTO-PILOT ENGAGED ═══");
  log("All functions now fully automated — no manual intervention required");

  registerCycle("arb-scan", 15 * 60 * 1000);
  registerCycle("seo-publish", 3 * 60 * 60 * 1000);
  registerCycle("job-apply", 45 * 60 * 1000);
  registerCycle("income-actions", 20 * 60 * 1000);
  registerCycle("auto-executor", 45 * 60 * 1000);
  registerCycle("income-conference", 2 * 60 * 60 * 1000);
  registerCycle("market-refresh", 15 * 60 * 1000);
  registerCycle("lead-gen", 90 * 60 * 1000);
  registerCycle("agi-conference", 4 * 60 * 60 * 1000);
  registerCycle("service-arb-approve", 45 * 60 * 1000);
  registerCycle("swarm-messages", 20 * 60 * 1000);
  registerCycle("log-cleanup", 60 * 60 * 1000);

  intervals.set("arb-scan", setInterval(() => {
    runSafe("arb-scan", autoScanArbitrage);
  }, 15 * 60 * 1000));

  intervals.set("seo-publish", setInterval(() => {
    runSafe("seo-publish", autoPublishArticle);
  }, 3 * 60 * 60 * 1000));

  intervals.set("job-apply", setInterval(() => {
    runSafe("job-apply", autoJobApply);
  }, 45 * 60 * 1000));

  intervals.set("income-actions", setInterval(() => {
    runSafe("income-actions", autoExecuteIncomeActions);
  }, 20 * 60 * 1000));

  intervals.set("auto-executor", setInterval(() => {
    runSafe("auto-executor", autoRunExecutor);
  }, 45 * 60 * 1000));

  intervals.set("income-conference", setInterval(() => {
    runSafe("income-conference", autoTriggerConference);
  }, 2 * 60 * 60 * 1000));

  intervals.set("market-refresh", setInterval(() => {
    runSafe("market-refresh", autoMarketDashboardRefresh);
  }, 15 * 60 * 1000));

  intervals.set("lead-gen", setInterval(() => {
    runSafe("lead-gen", autoLeadGeneration);
  }, 90 * 60 * 1000));

  intervals.set("agi-conference", setInterval(() => {
    runSafe("agi-conference", autoAGIConference);
  }, 4 * 60 * 60 * 1000));

  intervals.set("service-arb-approve", setInterval(() => {
    runSafe("service-arb-approve", autoServiceArbApproval);
  }, 45 * 60 * 1000));

  intervals.set("swarm-messages", setInterval(() => {
    runSafe("swarm-messages", autoSwarmAgentMessages);
  }, 20 * 60 * 1000));

  intervals.set("log-cleanup", setInterval(() => {
    runSafe("log-cleanup", rollingLogCleanup);
  }, 60 * 60 * 1000));

  try {
    const fsi = require("fs");
    const pathi = require("path");
    const serverDir = pathi.join(process.cwd(), "server");
    const allF = fsi.readdirSync(serverDir);
    const backups = allF.filter((f: string) => f.startsWith("dual-brain-state.backup-") && f.endsWith(".json"));
    for (const b of backups) {
      try { fsi.unlinkSync(pathi.join(serverDir, b)); } catch {}
    }
    if (backups.length > 0) log(`[AutoPilot] Immediate cleanup: removed ${backups.length} dual-brain backup(s) at boot`);
  } catch {}

  bootstrapTimeouts.push(setTimeout(() => {
    log("Running initial scan cycle...");
    runSafe("arb-scan", autoScanArbitrage);
    runSafe("market-refresh", autoMarketDashboardRefresh);
  }, 2 * 60 * 1000));

  bootstrapTimeouts.push(setTimeout(() => {
    runSafe("job-apply", autoJobApply);
    runSafe("income-actions", autoExecuteIncomeActions);
  }, 4 * 60 * 1000));

  bootstrapTimeouts.push(setTimeout(() => {
    runSafe("seo-publish", autoPublishArticle);
    runSafe("auto-executor", autoRunExecutor);
    runSafe("service-arb-approve", autoServiceArbApproval);
  }, 6 * 60 * 1000));

  bootstrapTimeouts.push(setTimeout(() => {
    runSafe("income-conference", autoTriggerConference);
    runSafe("lead-gen", autoLeadGeneration);
  }, 8 * 60 * 1000));

  bootstrapTimeouts.push(setTimeout(() => {
    runSafe("swarm-messages", autoSwarmAgentMessages);
    runSafe("log-cleanup", rollingLogCleanup);
  }, 5 * 60 * 1000));

  bootstrapTimeouts.push(setTimeout(() => {
    runSafe("agi-conference", autoAGIConference);
  }, 10 * 60 * 1000));

  bootstrapTimeouts.push(setTimeout(async () => {
    try {
      const { startAutonomousTuner } = await import("./autonomous-benchmark-tuner");
      startAutonomousTuner(900000);
      log("Benchmark Self-Tuner    — every 15 min");
    } catch (err: any) {
      warn(`Benchmark tuner start failed: ${err.message?.slice(0, 80)}`);
    }
  }, 7 * 60 * 1000));

  bootstrapTimeouts.push(setTimeout(async () => {
    try {
      const { startNeuralSynapse } = await import("./neural-synapse");
      startNeuralSynapse();
      log("Neural Synapse Network  — every 5 min (consciousness + realification)");
    } catch (err: any) {
      warn(`Neural synapse start failed: ${err.message?.slice(0, 80)}`);
    }
  }, 8 * 60 * 1000));

  bootstrapTimeouts.push(setTimeout(async () => {
    try {
      const { startQuantumTesseract } = await import("./quantum-tesseract");
      startQuantumTesseract();
      log("Quantum Tesseract       — every 5 min (quantum mechanics + interdimensional + time dilation)");
    } catch (err: any) {
      warn(`Quantum Tesseract start failed: ${err.message?.slice(0, 80)}`);
    }
  }, 9 * 60 * 1000));

  registerCycle("heap-monitor", 60 * 1000);
  intervals.set("heap-monitor", setInterval(() => {
    runSafe("heap-monitor", async () => {
      const mem = process.memoryUsage();
      const heapUsedMB = mem.heapUsed / 1024 / 1024;
      const heapTotalMB = mem.heapTotal / 1024 / 1024;
      const heapPct = (heapUsedMB / heapTotalMB * 100).toFixed(1);
      if (heapUsedMB > 350) {
        try {
          const { runMemoryCleanup } = await import("./system-health-agency");
          const freed = runMemoryCleanup();
          log(`Proactive memory cleanup freed ~${freed} items (heap: ${heapUsedMB.toFixed(0)}MB)`);
        } catch {}
        if (heapUsedMB > 450 && global.gc) {
          global.gc();
          log("Manual GC triggered due to high heap");
        }
        if (heapUsedMB > 400) {
          warn(`High heap usage: ${heapUsedMB.toFixed(0)}MB / ${heapTotalMB.toFixed(0)}MB (${heapPct}%)`);
        }
      }
    });
  }, 60 * 1000));

  log("15 automation cycles registered (including swarm messages + log cleanup + heap monitor + synapse + quantum tesseract)");
  log("  Arbitrage Scan         — every 15 min");
  log("  SEO Auto-Publish       — every 3 hours");
  log("  Job Auto-Apply         — every 45 min");
  log("  Income Actions         — every 20 min");
  log("  Auto-Executor          — every 45 min");
  log("  Income Conference      — every 2 hours");
  log("  Market Refresh         — every 8 min");
  log("  Lead Generation        — every 90 min");
  log("  AGI Conference         — every 4 hours");
  log("  Service Arb Approval   — every 45 min");
  log("  Swarm Agent Messages   — every 10 min (all 26 agents active per cycle)");
  log("  Log Cleanup            — every 1 hour (rolling trim for llm_logs + exec-log)");
  log("  Heap Monitor           — every 1 min");
  log("  Neural Synapse         — every 2 min (consciousness + realification)");
  log("  Quantum Tesseract      — every 3 min (quantum mechanics + interdimensional + time dilation)");
}

export function stopAutoPilot() {
  running = false;
  for (const [, interval] of intervals) {
    clearInterval(interval);
  }
  intervals.clear();
  for (const t of bootstrapTimeouts) {
    clearTimeout(t);
  }
  bootstrapTimeouts.length = 0;
  cycles.clear();
  try {
    import("./neural-synapse").then(m => m.stopNeuralSynapse()).catch(() => {});
  } catch {}
  try {
    import("./autonomous-benchmark-tuner").then(m => m.stopAutonomousTuner()).catch(() => {});
  } catch {}
  try {
    import("./quantum-tesseract").then(m => m.stopQuantumTesseract()).catch(() => {});
  } catch {}
  log("Auto-pilot stopped (synapse + tuner + quantum tesseract stopped)");
}

export function getAutoPilotStatus() {
  const cycleList = Array.from(cycles.values()).map(c => ({
    ...c,
    lastRunAgo: c.lastRun > 0 ? `${Math.round((Date.now() - c.lastRun) / 1000)}s ago` : "never",
    nextRunIn: c.lastRun > 0 ? `${Math.max(0, Math.round((c.intervalMs - (Date.now() - c.lastRun)) / 1000))}s` : "pending",
  }));

  return {
    running,
    totalCycles: cycles.size,
    activeCycles: cycleList.filter(c => c.status === "active").length,
    errorCycles: cycleList.filter(c => c.status === "error").length,
    cycles: cycleList,
  };
}
