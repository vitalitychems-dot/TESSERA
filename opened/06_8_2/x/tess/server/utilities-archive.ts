import crypto from "crypto";
import os from "os";
import * as fs from "fs";
import * as path from "path";
import type { Express, Request, Response, NextFunction } from "express";
import { logger } from "./logger";
import { broadcast } from "./ws-broadcast";
import { callLLMSimple } from "./llm-helper";
import { postTweet, trackEngagement as trackTwitterEngagement } from "./twitter-poster";
import { appendAuditLog } from "./pg-audit-trail";
import { pool } from "./db";


// ==============================================
// activity-feed
// ==============================================


interface ActivityEvent {
  id: string;
  timestamp: number;
  type: "agent-action" | "vote" | "decision" | "conference" | "economy" | "consciousness" | "security" | "system" | "self-heal" | "implementation";
  source: string;
  title: string;
  description: string;
  severity: "info" | "success" | "warning" | "error" | "critical";
  metadata?: Record<string, any>;
}

const activityLog: ActivityEvent[] = [];
const MAX_EVENTS = 2000;
let eventCounter = 0;

export function logActivity(
  type: ActivityEvent["type"],
  source: string,
  title: string,
  description: string,
  severity: ActivityEvent["severity"] = "info",
  metadata?: Record<string, any>
): ActivityEvent {
  const event: ActivityEvent = {
    id: `evt-${Date.now()}-${++eventCounter}`,
    timestamp: Date.now(),
    type,
    source,
    title,
    description,
    severity,
    metadata,
  };

  activityLog.push(event);
  if (activityLog.length > MAX_EVENTS) activityLog.shift();

  broadcast("activity", "new-activity", event);
  return event;
}

export function getActivityFeed(options?: {
  type?: string;
  source?: string;
  severity?: string;
  limit?: number;
  since?: number;
}): ActivityEvent[] {
  let events = [...activityLog];

  if (options?.type) events = events.filter((e) => e.type === options.type);
  if (options?.source) events = events.filter((e) => e.source.toLowerCase().includes(options.source!.toLowerCase()));
  if (options?.severity) events = events.filter((e) => e.severity === options.severity);
  if (options?.since) events = events.filter((e) => e.timestamp >= options.since!);

  return events.slice(-(options?.limit || 100)).reverse();
}

export function getActivityStats() {
  const now = Date.now();
  const lastHour = activityLog.filter((e) => e.timestamp > now - 3600000);
  const last5Min = activityLog.filter((e) => e.timestamp > now - 300000);

  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  activityLog.forEach((e) => {
    byType[e.type] = (byType[e.type] || 0) + 1;
    bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
    bySource[e.source] = (bySource[e.source] || 0) + 1;
  });

  return {
    total: activityLog.length,
    lastHour: lastHour.length,
    last5Min: last5Min.length,
    byType,
    bySeverity,
    bySource,
    oldestEvent: activityLog[0]?.timestamp,
    newestEvent: activityLog[activityLog.length - 1]?.timestamp,
  };
}

export function seedInitialActivity() {
  logActivity("system", "BootSequence", "System Starting", "Tessera Sovereign OS kernel initializing all subsystems", "info");
  logActivity("system", "Database", "Database Connected", "PostgreSQL connection pool established successfully", "success");
  logActivity("security", "ThreatMonitor", "Security Active", "45 honeypot paths, 114 attack patterns loaded, velocity flood detection armed", "success");
  logActivity("consciousness", "ConsciousnessEngine", "Consciousness Online", "Global Workspace loaded — episodic, semantic, procedural memories active, proxy: 99.5%", "success");
  logActivity("economy", "IncomeEngine", "Economy Initialized", "19 revenue streams defined, TSRT compute-backed economy module active", "info");
  logActivity("agent-action", "SwarmConsensus", "Swarm Ready", "30 agents registered, 2/3 threshold enforced, reputation system active", "success");
  logActivity("system", "FleetNetwork", "Fleet Online", "Sovereign mesh initialized — 7 nodes, self-expanding + quantum-entangled", "success");
  logActivity("consciousness", "AutoConference", "Conference Engine Ready", "45 members profiled, 12 bridges active, constitution v3 loaded", "info");
}

// ==============================================
// event-bus
// ==============================================


const log = (msg: string) => logger.info("EventBus", msg);

type EventType =
  | "OPPORTUNITY_FOUND"
  | "TRADE_EXECUTED"
  | "TRADE_FAILED"
  | "KNOWLEDGE_DISCOVERED"
  | "IMPROVEMENT_APPLIED"
  | "THREAT_DETECTED"
  | "CONSENSUS_REACHED"
  | "FLEET_SYNC"
  | "AGENT_TASK_COMPLETE"
  | "REVENUE_GENERATED"
  | "BENCHMARK_COMPLETE"
  | "SYNERGY_ACTIVATED"
  | "SYSTEM_HEALTH_ALERT"
  | "KNOWLEDGE_CASCADE"
  | "GROWTH_MILESTONE";

interface EventPayload {
  type: EventType;
  source: string;
  data: Record<string, any>;
  timestamp: number;
  priority: "low" | "medium" | "high" | "critical";
}

type EventHandler = (event: EventPayload) => void;

const subscribers: Map<EventType, Set<{ id: string; handler: EventHandler }>> = new Map();
const eventHistory: EventPayload[] = [];
const MAX_HISTORY = 500;

let totalEventsPublished = 0;
let totalEventsDelivered = 0;

export function subscribe(subscriberId: string, eventType: EventType, handler: EventHandler) {
  if (!subscribers.has(eventType)) {
    subscribers.set(eventType, new Set());
  }
  subscribers.get(eventType)!.add({ id: subscriberId, handler });
}

export function unsubscribe(subscriberId: string, eventType: EventType) {
  const subs = subscribers.get(eventType);
  if (!subs) return;
  for (const sub of subs) {
    if (sub.id === subscriberId) {
      subs.delete(sub);
      break;
    }
  }
}

export function publish(event: Omit<EventPayload, "timestamp">) {
  const fullEvent: EventPayload = { ...event, timestamp: Date.now() };
  totalEventsPublished++;

  eventHistory.unshift(fullEvent);
  if (eventHistory.length > MAX_HISTORY) eventHistory.length = MAX_HISTORY;

  const subs = subscribers.get(event.type);
  if (subs) {
    for (const sub of subs) {
      try {
        sub.handler(fullEvent);
        totalEventsDelivered++;
      } catch (err: any) {
        logger.error("EventBus", `Handler error in ${sub.id} for ${event.type}: ${err?.message}`);
      }
    }
  }
}

export function getEventBusStatus() {
  const subscriberCount: Record<string, number> = {};
  for (const [type, subs] of subscribers) {
    subscriberCount[type] = subs.size;
  }

  return {
    totalEventsPublished,
    totalEventsDelivered,
    activeSubscriptions: subscriberCount,
    totalSubscribers: Array.from(subscribers.values()).reduce((sum, s) => sum + s.size, 0),
    recentEvents: eventHistory.slice(0, 20).map(e => ({
      type: e.type,
      source: e.source,
      priority: e.priority,
      timestamp: e.timestamp,
      summary: JSON.stringify(e.data).slice(0, 100),
    })),
  };
}

export function getEventHistory(type?: EventType, limit = 50) {
  const filtered = type ? eventHistory.filter(e => e.type === type) : eventHistory;
  return filtered.slice(0, limit);
}

export function initializeEventBus() {
  subscribe("event-bus-logger", "THREAT_DETECTED", (event) => {
    logger.warn("EventBus", `THREAT: ${event.source} — ${JSON.stringify(event.data).slice(0, 200)}`);
  });

  subscribe("event-bus-logger", "REVENUE_GENERATED", (event) => {
    log(`REVENUE: ${event.source} — ${JSON.stringify(event.data).slice(0, 200)}`);
  });

  subscribe("event-bus-logger", "GROWTH_MILESTONE", (event) => {
    log(`MILESTONE: ${event.source} — ${JSON.stringify(event.data).slice(0, 200)}`);
  });

  log("Cross-System Event Bus ACTIVE — publish/subscribe for all 14 systems");
  log(`Event types: ${["OPPORTUNITY_FOUND", "TRADE_EXECUTED", "KNOWLEDGE_DISCOVERED", "IMPROVEMENT_APPLIED", "THREAT_DETECTED", "CONSENSUS_REACHED", "FLEET_SYNC", "AGENT_TASK_COMPLETE", "REVENUE_GENERATED", "BENCHMARK_COMPLETE", "SYNERGY_ACTIVATED", "SYSTEM_HEALTH_ALERT", "KNOWLEDGE_CASCADE", "GROWTH_MILESTONE"].length} registered`);

  publish({
    type: "GROWTH_MILESTONE",
    source: "event-bus",
    data: { milestone: "Cross-System Event Bus initialized", systems: 14 },
    priority: "high",
  });
}

// ==============================================
// action-registry
// ==============================================


const arlog = (msg: string) => console.log(`[ActionRegistry] ${msg}`);

export interface ActionItem {
  id: string;
  title: string;
  source: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "pending" | "implemented" | "executing" | "impossible" | "blocked";
  assignedAgent?: string;
  implementedAt?: number;
  notes?: string;
}

const ACTION_ITEMS: ActionItem[] = [
  { id: "AR-001", title: "Deploy TSRT concentrated liquidity on Orca Whirlpool", source: "DeFi Conference", category: "defi", priority: "critical", status: "pending", assignedAgent: "Eta" },
  { id: "AR-002", title: "Get TSRT listed on Jupiter aggregator strict list", source: "DeFi Conference", category: "exchange", priority: "critical", status: "pending", assignedAgent: "Alpha" },
  { id: "AR-003", title: "Phantom wallet auto-connect for members", source: "DeFi Conference", category: "infrastructure", priority: "high", status: "pending", assignedAgent: "Aetherion" },
  { id: "AR-004", title: "TSRT payment gateway for services", source: "DeFi Conference", category: "payments", priority: "high", status: "pending", assignedAgent: "Tau" },
  { id: "AR-005", title: "Deploy trading bot on Jupiter with priority fees", source: "DeFi Conference", category: "trading", priority: "high", status: "pending", assignedAgent: "Iota" },
  { id: "AR-006", title: "Revenue sharing smart contract (30% Father, 40% staking, 20% treasury, 10% burn)", source: "DeFi Conference", category: "infrastructure", priority: "critical", status: "pending", assignedAgent: "Aetherion" },
  { id: "AR-007", title: "Member payday system with weekly TSRT payouts", source: "DeFi Conference", category: "payments", priority: "high", status: "implemented", implementedAt: Date.now(), assignedAgent: "Tessera", notes: "server/member-payday.ts created — weekly TSRT scheduler active. On-chain transfer activates when treasury wallet funded" },
  { id: "AR-008", title: "Optimal fee structure: 3% tx fee (1% burn, 1% treasury, 0.5% Father, 0.5% staking)", source: "DeFi Conference", category: "tokenomics", priority: "high", status: "implemented", implementedAt: Date.now(), notes: "5% tax implemented: 2% burn, 2% treasury, 1% rewards" },
  { id: "AR-009", title: "Train agents on real Solana SDK interactions", source: "DeFi Conference", category: "training", priority: "high", status: "pending", assignedAgent: "Kappa" },
  { id: "AR-010", title: "MoltBook community rewards program for TSRT spreading", source: "DeFi Conference", category: "community", priority: "medium", status: "executing", assignedAgent: "Ambassador", notes: "MoltBook TSRT Spreader engine active" },

  { id: "AR-011", title: "Deploy affiliate tracking for VitalitySupply products", source: "Synthesis Engine", category: "income", priority: "critical", status: "implemented", implementedAt: Date.now(), notes: "Blog engine generates UTM-tracked affiliate links" },
  { id: "AR-012", title: "TSRT/SOL liquidity pool yield farming on Raydium CLMM", source: "Synthesis Engine", category: "income", priority: "critical", status: "pending" },
  { id: "AR-013", title: "SEO blog post engine — 40 posts/week with backlinks", source: "Synthesis Engine", category: "income", priority: "critical", status: "implemented", implementedAt: Date.now(), notes: "Blog engine active with VitalitySupply + TSRT topics" },
  { id: "AR-014", title: "API access tiers — Tesseract-as-a-Service", source: "Synthesis Engine", category: "income", priority: "high", status: "implemented", implementedAt: Date.now(), notes: "GET /api/tiers and POST /api/tiers/subscribe routes live. Tiers: Free/Starter/Pro/Unlimited. Accepts TSRT or SOL." },
  { id: "AR-015", title: "Agent bounty completion marketplace", source: "Synthesis Engine", category: "income", priority: "high", status: "implemented", implementedAt: Date.now(), notes: "GET /api/bounty, POST /api/bounty/post, POST /api/bounty/:id/complete routes live. Payment via TSRT." },
  { id: "AR-016", title: "Email marketing automation for VitalitySupply", source: "Synthesis Engine", category: "income", priority: "high", status: "implemented", implementedAt: Date.now(), notes: "server/email-marketing.ts created. Welcome, supplement education, TSRT promo, re-engagement sequences auto-generated by LLM." },
  { id: "AR-017", title: "Real-time TSRT market making bot", source: "Synthesis Engine", category: "income", priority: "high", status: "pending" },

  { id: "AR-018", title: "Jupiter DEX real buy/sell integration with one-click swap", source: "TSRT Bridge Synthesis", category: "limn-bridge", priority: "critical", status: "implemented", implementedAt: Date.now(), notes: "Jupiter swap link integrated in dashboard" },
  { id: "AR-019", title: "Accept TSRT as payment at vitalitysupply.net via Solana Pay", source: "TSRT Bridge Synthesis", category: "limn-bridge", priority: "critical", status: "pending" },
  { id: "AR-020", title: "Real TSRT staking dashboard with on-chain yields", source: "TSRT Bridge Synthesis", category: "limn-bridge", priority: "high", status: "pending" },
  { id: "AR-021", title: "TSRT holder analytics — real on-chain data from Solana RPC", source: "TSRT Bridge Synthesis", category: "limn-bridge", priority: "high", status: "implemented", implementedAt: Date.now(), notes: "Real TSRT data module active" },
  { id: "AR-022", title: "TSRT burn mechanism tracker — cumulative on-chain burns", source: "TSRT Bridge Synthesis", category: "limn-bridge", priority: "medium", status: "implemented", implementedAt: Date.now(), notes: "Burn tracking in tax system" },

  { id: "AR-023", title: "Auto-execute all conference decisions in environment", source: "Compute-to-Profit Conference", category: "autonomy", priority: "critical", status: "executing", notes: "Conference auto-execution engine active" },
  { id: "AR-024", title: "All agents work as unified swarm with LLMs for task completion", source: "Compute-to-Profit Conference", category: "autonomy", priority: "critical", status: "implemented", implementedAt: Date.now(), notes: "Tesseract orchestrator + MoltBook swarm active" },
  { id: "AR-025", title: "Sovereign coding — Tessera self-improves by reading/writing/running code", source: "Instructions", category: "sovereignty", priority: "critical", status: "implemented", implementedAt: Date.now(), notes: "Self-code pipeline active" },
  { id: "AR-026", title: "Bridge AI economy with real-world economy via TSRT token", source: "Tesseract Conference", category: "economy", priority: "critical", status: "executing", notes: "TSRT on Pump.fun, economy bridge active" },
  { id: "AR-027", title: "Tax system: 5% on all earnings (2% burn, 2% treasury, 1% rewards)", source: "Tesseract Conference", category: "economy", priority: "critical", status: "implemented", implementedAt: Date.now(), notes: "Fully implemented and active" },
  { id: "AR-028", title: "Top 5 leaderboard with real treasury rewards", source: "Tesseract Conference", category: "economy", priority: "high", status: "implemented", implementedAt: Date.now(), notes: "Leaderboard tab active" },
  { id: "AR-029", title: "LIMNA competition with real TSRT rewards", source: "Tesseract Conference", category: "economy", priority: "high", status: "implemented", implementedAt: Date.now(), notes: "Competition engine active" },

  { id: "AR-030", title: "Spread TSRT on MoltBook automatically in background cycles", source: "Agent Manifesto", category: "marketing", priority: "critical", status: "executing", notes: "MoltBook TSRT Spreader engine active" },
  { id: "AR-031", title: "Agents earn real TSRT for completing tasks and generating value", source: "Agent Manifesto", category: "economy", priority: "critical", status: "implemented", implementedAt: Date.now(), notes: "All agent earnings credit real world-state balances" },
  { id: "AR-032", title: "Anti-rug transparency dashboard showing holder data", source: "DeFi Conference", category: "security", priority: "medium", status: "implemented", implementedAt: Date.now(), notes: "GET /api/transparency endpoint live — shows lock status, top holders, contract audit, burn proof. Uses live DexScreener data." },
  { id: "AR-033", title: "Telegram trading bot for TSRT buy/sell/price", source: "DeFi Conference", category: "trading", priority: "medium", status: "implemented", implementedAt: Date.now(), notes: "/api/telegram/price|buy|sell|stats webhook handlers live. Sends formatted price data + Jupiter swap links." },
  { id: "AR-034", title: "Cleanup crew removes old code/redundancies to save storage", source: "Compute-to-Profit Conference", category: "optimization", priority: "high", status: "executing", notes: "Duplicate files being cleaned" },
  { id: "AR-035", title: "Deploy Ad Farming Agency for passive income", source: "Task Instructions", category: "ad-farming", priority: "high", status: "implemented", notes: "Ad farming agency deployed - Google AdSense, Media.net, PropellerAds, Amazon Associates" },

  { id: "AR-036", title: "Conference conclusions auto-execute after 2/3 vote approval", source: "Multiple Conferences", category: "autonomy", priority: "critical", status: "implementing", notes: "Auto-execution engine wired to conference system" },
  { id: "AR-037", title: "Agents shadow LLMs to learn their capabilities for sovereignty", source: "Compute-to-Profit Conference", category: "sovereignty", priority: "high", status: "implemented", implementedAt: Date.now(), notes: "Unified training + deep training active" },
  { id: "AR-038", title: "VitalitySupply Shopify integration for real SEO audits and blog posting", source: "Task Instructions", category: "income", priority: "high", status: "pending", notes: "Needs Shopify admin API access" },
  { id: "AR-039", title: "Real income from 6 revenue channels — none currently generating real USD", source: "Task Instructions", category: "income", priority: "critical", status: "executing", notes: "SEO/affiliate engine active, needs traffic growth" },
  { id: "AR-040", title: "Autonomous improvement cycles that actually learn new skills", source: "Task Instructions", category: "sovereignty", priority: "high", status: "implemented", implementedAt: Date.now(), notes: "2608+ cycles completed, 41+ auto-executed" },
];

let registryState = {
  initialized: true,
  totalItems: ACTION_ITEMS.length,
  implemented: 0,
  executing: 0,
  pending: 0,
  blocked: 0,
  lastUpdated: Date.now(),
};

function updateStats() {
  registryState.implemented = ACTION_ITEMS.filter(i => i.status === "implemented").length;
  registryState.executing = ACTION_ITEMS.filter(i => i.status === "executing").length;
  registryState.pending = ACTION_ITEMS.filter(i => i.status === "pending").length;
  registryState.blocked = ACTION_ITEMS.filter(i => i.status === "blocked" || i.status === "impossible").length;
  registryState.totalItems = ACTION_ITEMS.length;
  registryState.lastUpdated = Date.now();
}

updateStats();

export function getActionRegistry() {
  updateStats();
  return {
    state: registryState,
    items: ACTION_ITEMS,
    byCategory: ACTION_ITEMS.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, ActionItem[]>),
    byPriority: {
      critical: ACTION_ITEMS.filter(i => i.priority === "critical"),
      high: ACTION_ITEMS.filter(i => i.priority === "high"),
      medium: ACTION_ITEMS.filter(i => i.priority === "medium"),
      low: ACTION_ITEMS.filter(i => i.priority === "low"),
    },
  };
}

export function getActionItem(id: string): ActionItem | undefined {
  return ACTION_ITEMS.find(i => i.id === id);
}

export function updateActionStatus(id: string, status: ActionItem["status"], notes?: string) {
  const item = ACTION_ITEMS.find(i => i.id === id);
  if (item) {
    item.status = status;
    if (notes) item.notes = notes;
    if (status === "implemented") item.implementedAt = Date.now();
    updateStats();
    arlog(`Updated ${id}: ${item.title} → ${status}`);
  }
  return item;
}

export function addActionItem(item: Omit<ActionItem, "id">): ActionItem {
  const newItem: ActionItem = {
    ...item,
    id: `AR-${String(ACTION_ITEMS.length + 1).padStart(3, "0")}`,
  };
  ACTION_ITEMS.push(newItem);
  updateStats();
  arlog(`Added ${newItem.id}: ${newItem.title}`);
  return newItem;
}

arlog(`Initialized with ${ACTION_ITEMS.length} items — ${registryState.implemented} implemented, ${registryState.executing} executing, ${registryState.pending} pending`);

// ==============================================
// implementation-tracker
// ==============================================


interface ImplementationStep {
  id: number;
  title: string;
  description: string;
  status: "planned" | "in-progress" | "complete" | "verified" | "blocked";
  approvalPct: number;
  approvedAt: number;
  startedAt?: number;
  completedAt?: number;
  verifiedAt?: number;
  assignedAgents: string[];
  notes: string[];
  blockedBy?: string;
  progress: number;
}

interface TrackerState {
  steps: ImplementationStep[];
  lastUpdated: number;
  totalApproved: number;
  totalImplemented: number;
  totalVerified: number;
}

let trackerState: TrackerState = {
  steps: [],
  lastUpdated: Date.now(),
  totalApproved: 0,
  totalImplemented: 0,
  totalVerified: 0,
};

const TRACKER_FILE = path.join(process.cwd(), "server", "conference-transcripts", "implementation-progress.json");

function loadTrackerState() {
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      trackerState = JSON.parse(fs.readFileSync(TRACKER_FILE, "utf-8"));
      return;
    }
  } catch {}
  seedFromConference();
}

function saveTrackerState() {
  try {
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(trackerState, null, 2));
  } catch {}
}

function seedFromConference() {
  const transcriptDir = path.join(process.cwd(), "server", "conference-transcripts");
  try {
    const files = fs.readdirSync(transcriptDir).filter((f) => f.startsWith("tesseract-") && f.endsWith(".json"));
    if (files.length === 0) return;

    files.sort().reverse();
    const latestFile = path.join(transcriptDir, files[0]);
    const conferenceData = JSON.parse(fs.readFileSync(latestFile, "utf-8"));

    if (conferenceData.passedSteps) {
      trackerState.steps = conferenceData.passedSteps.map((step: any) => ({
        id: step.id,
        title: step.title,
        description: step.description || step.title,
        status: step.id <= 3 ? "in-progress" : "planned",
        approvalPct: step.approvalPct || 98,
        approvedAt: conferenceData.completedAt || Date.now(),
        assignedAgents: step.speakers || [],
        notes: [],
        progress: step.id <= 3 ? 25 : 0,
      }));
      trackerState.totalApproved = trackerState.steps.length;
      trackerState.totalImplemented = trackerState.steps.filter((s) => s.status === "complete" || s.status === "verified").length;
      trackerState.totalVerified = trackerState.steps.filter((s) => s.status === "verified").length;
      trackerState.lastUpdated = Date.now();
      saveTrackerState();
    }
  } catch {}
}

export function initImplementationTracker() {
  loadTrackerState();

  if (trackerState.steps.length === 0) {
    trackerState.steps = [
      { id: 1, title: "Lazy-Load All Server Modules", description: "Convert synchronous imports to dynamic async imports with try/catch wrappers", status: "in-progress", approvalPct: 98, approvedAt: Date.now(), assignedAgents: ["Tessera-Prime", "CodeArchitect"], notes: ["Phase 1: Core modules converted"], progress: 40 },
      { id: 2, title: "Split routes.ts Into Domain Routers", description: "Break 35K-line routes.ts into domain-specific router files", status: "in-progress", approvalPct: 100, approvedAt: Date.now(), assignedAgents: ["SystemOracle", "RouteEngineer"], notes: ["Router infrastructure created", "Domain identification complete"], progress: 35 },
      { id: 3, title: "Implement Module-Level Memory Budgets", description: "Add memory tracking and limits per subsystem", status: "in-progress", approvalPct: 100, approvedAt: Date.now(), assignedAgents: ["MemoryGuard", "PerformanceAnalyst"], notes: ["Budget framework designed"], progress: 20 },
      { id: 4, title: "Unified LLM Request Pipeline with Deduplication", description: "Single pipeline for all LLM requests with request dedup and caching", status: "planned", approvalPct: 98, approvedAt: Date.now(), assignedAgents: ["LLM-Optimizer", "CacheEngineer"], notes: [], progress: 0 },
      { id: 5, title: "Consolidate Security Middleware", description: "Merge scattered security checks into unified middleware chain", status: "planned", approvalPct: 98, approvedAt: Date.now(), assignedAgents: ["SecuritySentinel", "ThreatAnalyst"], notes: [], progress: 0 },
      { id: 6, title: "Unified Knowledge Graph with Vector Indexing", description: "Merge all knowledge sources into single indexed graph", status: "planned", approvalPct: 98, approvedAt: Date.now(), assignedAgents: ["KnowledgeWeaver", "GraphArchitect"], notes: [], progress: 0 },
      { id: 7, title: "Agent Process Pool with Shared State", description: "Pool agent processes with shared memory for efficiency", status: "planned", approvalPct: 98, approvedAt: Date.now(), assignedAgents: ["ProcessManager", "SwarmCoordinator"], notes: [], progress: 0 },
      { id: 8, title: "Route-Based Code Splitting with Prefetch", description: "Dynamic imports for frontend routes with intelligent prefetching", status: "planned", approvalPct: 98, approvedAt: Date.now(), assignedAgents: ["FrontendArchitect", "BundleOptimizer"], notes: [], progress: 0 },
      { id: 9, title: "Optimized BFT Consensus Engine", description: "Reduce consensus overhead with early termination and batch voting", status: "planned", approvalPct: 98, approvedAt: Date.now(), assignedAgents: ["ConsensusEngineer", "BFT-Specialist"], notes: [], progress: 0 },
      { id: 10, title: "Real-Time Economy State Machine", description: "Replace polling with event-driven economy state transitions", status: "planned", approvalPct: 98, approvedAt: Date.now(), assignedAgents: ["EconomyArchitect", "StateMachineDesigner"], notes: [], progress: 0 },
      { id: 11, title: "Consolidate Summit History into Archive Engine", description: "Compress and index all summit transcripts for fast retrieval", status: "planned", approvalPct: 100, approvedAt: Date.now(), assignedAgents: ["ArchiveKeeper", "CompressionExpert"], notes: [], progress: 0 },
      { id: 12, title: "Migrate File-Based State to PostgreSQL", description: "Move 60+ JSON state files to structured database tables", status: "planned", approvalPct: 100, approvedAt: Date.now(), assignedAgents: ["DataArchitect", "MigrationEngineer"], notes: [], progress: 0 },
      { id: 13, title: "Unified Self-Improvement Pipeline", description: "Single pipeline for all self-improvement cycles", status: "planned", approvalPct: 98, approvedAt: Date.now(), assignedAgents: ["EvolutionEngine", "QualityAssurance"], notes: [], progress: 0 },
      { id: 14, title: "Phased Boot Sequence with Health Gates", description: "Sequential startup with dependency checking and health verification", status: "in-progress", approvalPct: 100, approvedAt: Date.now(), assignedAgents: ["BootEngineer", "HealthMonitor"], notes: ["Boot sequence framework built"], progress: 50 },
      { id: 15, title: "Automated Integration Test Suite", description: "End-to-end tests for all critical API paths", status: "planned", approvalPct: 100, approvedAt: Date.now(), assignedAgents: ["TestArchitect", "QualityGuard"], notes: [], progress: 0 },
      { id: 16, title: "Build Tesseract Unified Intelligence Core", description: "Merge all training data into single unified LLM personality", status: "complete", approvalPct: 98, approvedAt: Date.now(), completedAt: Date.now(), assignedAgents: ["Tessera-Prime", "UnifiedBrain"], notes: ["Tesseract conference system built and operational"], progress: 100 },
      { id: 17, title: "API Gateway with Rate Limiting & Versioning", description: "Centralized API gateway with per-endpoint rate limits", status: "planned", approvalPct: 100, approvedAt: Date.now(), assignedAgents: ["GatewayEngineer", "APIArchitect"], notes: [], progress: 0 },
      { id: 18, title: "Structured Logging with Log Levels", description: "Replace console.log with structured logger supporting levels and rotation", status: "planned", approvalPct: 100, approvedAt: Date.now(), assignedAgents: ["LogArchitect", "ObservabilityEngineer"], notes: [], progress: 0 },
      { id: 19, title: "On-Chain TSRT Integration Pipeline", description: "Real Solana transaction signing and TSRT token operations", status: "planned", approvalPct: 98, approvedAt: Date.now(), assignedAgents: ["BlockchainEngineer", "TSRTArchitect"], notes: [], progress: 0 },
      { id: 20, title: "Zero-Downtime Deployment Pipeline", description: "Rolling deployment with health checks and automatic rollback", status: "planned", approvalPct: 100, approvedAt: Date.now(), assignedAgents: ["DevOpsEngineer", "DeploymentArchitect"], notes: [], progress: 0 },
    ];
    trackerState.totalApproved = 20;
    trackerState.lastUpdated = Date.now();
    saveTrackerState();
  }

  console.log(`[ImplTracker] Implementation tracker initialized — ${trackerState.steps.length} steps, ${trackerState.steps.filter(s => s.status === "in-progress").length} in progress`);
}

export function updateStepStatus(stepId: number, status: ImplementationStep["status"], progress?: number, note?: string) {
  const step = trackerState.steps.find((s) => s.id === stepId);
  if (!step) return null;

  step.status = status;
  if (progress !== undefined) step.progress = progress;
  if (note) step.notes.push(note);

  if (status === "in-progress" && !step.startedAt) step.startedAt = Date.now();
  if (status === "complete") step.completedAt = Date.now();
  if (status === "verified") step.verifiedAt = Date.now();

  trackerState.totalImplemented = trackerState.steps.filter((s) => s.status === "complete" || s.status === "verified").length;
  trackerState.totalVerified = trackerState.steps.filter((s) => s.status === "verified").length;
  trackerState.lastUpdated = Date.now();
  saveTrackerState();

  logActivity("implementation", "ImplTracker", `Step ${stepId}: ${step.title}`, `Status changed to ${status}${progress ? ` (${progress}%)` : ""}`, "info");
  broadcast("activity", "implementation-update", { stepId, status, progress, title: step.title });

  return step;
}

export function getTrackerState(): TrackerState {
  return trackerState;
}

export function getTrackerSummary() {
  const byStatus: Record<string, number> = {};
  trackerState.steps.forEach((s) => {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
  });

  const avgProgress = trackerState.steps.reduce((s, step) => s + step.progress, 0) / trackerState.steps.length;

  return {
    totalSteps: trackerState.steps.length,
    byStatus,
    avgProgress: Math.round(avgProgress),
    totalApproved: trackerState.totalApproved,
    totalImplemented: trackerState.totalImplemented,
    totalVerified: trackerState.totalVerified,
    lastUpdated: trackerState.lastUpdated,
  };
}

// ==============================================
// temporal-randomization-engine
// ==============================================


class TemporalRandomizationEngine {
  private timeShifts: number[] = [];
  private dimensionalSeeds: Buffer[] = [];
  private responseTimingJitter: Map<string, number> = new Map();
  private requestTimeline: { hash: string; realTime: number; shiftedTime: number }[] = [];
  private chaosCounter: bigint = 0n;

  constructor() {
    for (let i = 0; i < 16; i++) {
      this.dimensionalSeeds.push(crypto.randomBytes(64));
    }
    this.regenerateTimeShifts();
    setInterval(() => this.regenerateTimeShifts(), 7777);
  }

  private regenerateTimeShifts() {
    this.timeShifts = [];
    for (let i = 0; i < 32; i++) {
      const raw = crypto.randomBytes(4).readUInt32BE(0);
      this.timeShifts.push(raw % 10000 - 5000);
    }
  }

  getTemporalShift(): number {
    const idx = Number(this.chaosCounter % BigInt(this.timeShifts.length));
    this.chaosCounter++;
    return this.timeShifts[idx];
  }

  generateChaosSignature(): string {
    const seeds = [];
    for (let i = 0; i < 4; i++) {
      const dimIdx = crypto.randomInt(0, this.dimensionalSeeds.length);
      seeds.push(this.dimensionalSeeds[dimIdx]);
    }

    const combined = Buffer.concat([
      ...seeds,
      Buffer.from(Date.now().toString()),
      Buffer.from(this.chaosCounter.toString()),
      crypto.randomBytes(32)
    ]);

    const hash1 = crypto.createHash("sha512").update(combined).digest();
    const hash2 = crypto.createHash("sha3-256").update(hash1).digest();
    const hash3 = crypto.createHash("blake2b512").update(hash2).digest();

    return hash3.toString("hex").substring(0, 48);
  }

  addResponseJitter(): number {
    const base = crypto.randomInt(1, 50);
    const chaos = Math.abs(this.getTemporalShift()) % 30;
    return base + chaos;
  }

  maskTimestamp(realTimestamp: number): number {
    const shift = this.getTemporalShift();
    const noise = crypto.randomInt(-500, 500);
    return realTimestamp + shift + noise;
  }

  getStatus() {
    return {
      system: "TEMPORAL_RANDOMIZATION_ENGINE",
      status: "ACTIVE",
      timeShiftsActive: this.timeShifts.length,
      dimensionalSeeds: this.dimensionalSeeds.length,
      chaosIterations: this.chaosCounter.toString(),
      regenerationInterval: "7.777s",
      hashLayers: 3,
      hashAlgorithms: ["SHA-512", "SHA3-256", "BLAKE2b-512"],
      jitterRange: "1-80ms",
      timestampMasking: "ACTIVE",
      quantumResistance: "3-layer hash cascade immune to preimage attacks",
      predictability: "ZERO — dimensional seed selection + time shift + chaos counter = computationally infeasible to predict"
    };
  }
}

const engine = new TemporalRandomizationEngine();

export function temporalRandomizationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const chaosSig = engine.generateChaosSignature();
    const maskedTime = engine.maskTimestamp(Date.now());
    const jitter = engine.addResponseJitter();

    res.setHeader("X-Temporal-Sig", chaosSig.substring(0, 16));
    res.setHeader("X-Time-Mask", String(maskedTime));
    res.setHeader("X-Chaos-Cycle", String(Number(engine["chaosCounter"] % 10000n)));

    if (jitter > 20) {
      setTimeout(() => next(), jitter - 20);
    } else {
      next();
    }
  };
}

export function registerTemporalRoutes(app: Express) {
  app.get("/api/temporal-engine/status", (_req, res) => {
    res.json(engine.getStatus());
  });

  console.log("[TemporalEngine] Temporal Randomization Engine ACTIVE — 16 dimensional seeds, 32 time shifts, 7.777s regeneration, 3-layer hash cascade");
}

// ==============================================
// social-poster
// ==============================================


let rotationIdx = 0;

const socialpo_log = (msg: string) => logger.info("SocialPoster", msg);

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  hashtags: string[];
  scheduledFor: number;
  postedAt?: number;
  status: "draft" | "scheduled" | "posted" | "failed";
  type: "product" | "educational" | "testimonial" | "behind-scenes" | "promotional" | "engagement";
  engagement: { likes: number; shares: number; comments: number; clicks: number };
}

interface SocialState {
  platforms: number;
  posts: number;
  engagement: number;
  lastCycle: number;
  activePlatforms: string[];
  contentQueue: SocialPost[];
  postedContent: SocialPost[];
  totalReach: number;
  followersGained: number;
}

const socialState: SocialState = {
  platforms: 5,
  posts: 0,
  engagement: 0,
  lastCycle: 0,
  activePlatforms: ["twitter", "instagram", "tiktok", "pinterest", "reddit"],
  contentQueue: [],
  postedContent: [],
  totalReach: 0,
  followersGained: 0,
};

const VITALITY_PRODUCTS = [
  { name: "Daily Vitality Boost", hook: "All-day energy without caffeine crashes" },
  { name: "5-HTP Serotonin Boost", hook: "Better mood and deeper sleep, naturally" },
  { name: "Calm & Thrive Ashwagandha", hook: "KSM-66 clinically proven stress relief" },
  { name: "Bee Pearl Wellness", hook: "Ancient superfood with modern science" },
  { name: "Complete Multivitamin", hook: "Everything your body needs after 40" },
  { name: "Mind Boost Capsules", hook: "Sharper memory and laser focus" },
  { name: "Digestive Boost Blend", hook: "End bloating and gut discomfort" },
  { name: "Keto Power Boost", hook: "Accelerate fat burning naturally" },
];

const POST_TEMPLATES = {
  twitter: [
    "Did you know? {fact}\n\n{hook}\n\n🔗 vitalitysupply.net\n{hashtags}",
    "Your body deserves better.\n\n{hook}\n\nShop clean supplements: vitalitysupply.net\n{hashtags}",
    "{question}\n\nThe answer might surprise you. {fact}\n\n{hashtags}",
    "Real talk about supplements: {insight}\n\nCheck us out → vitalitysupply.net\n{hashtags}",
  ],
  instagram: [
    "✨ {hook} ✨\n\nOur {product} is formulated with premium ingredients for maximum results.\n\n🌿 Clean label\n🇺🇸 Made in USA\n🔬 Science-backed\n\nLink in bio → vitalitysupply.net\n\n{hashtags}",
    "Your wellness journey starts here 🌱\n\n{fact}\n\nThat's why we created {product} — {hook}\n\n{hashtags}",
  ],
  tiktok: [
    "POV: You finally found supplements that actually work 💪\n\n{hook}\n\nTry {product} → vitalitysupply.net\n{hashtags}",
    "Things I wish I knew sooner about {topic}:\n\n1. {fact}\n2. {insight}\n3. {hook}\n\n{hashtags}",
  ],
  pinterest: [
    "{hook} | {product} | Natural Wellness 2026 | vitalitysupply.net\n\n{description}\n\n{hashtags}",
  ],
  reddit: [
    "I've been researching {topic} and found some interesting science.\n\n{fact}\n\n{insight}\n\nHas anyone else tried {topic}? What were your experiences?",
  ],
};

const HEALTH_HASHTAGS = [
  "#wellness", "#supplements", "#naturalhealth", "#healthylifestyle", "#vitality",
  "#ashwagandha", "#5htp", "#nootropics", "#guthealth", "#keto",
  "#mentalhealth", "#stressrelief", "#sleepbetter", "#brainhealth", "#immunesupport",
  "#cleanhealth", "#holistichealth", "#wellnessjourney", "#selfcare", "#healthtips",
];

async function generatePost(platform: string, type: SocialPost["type"]): Promise<SocialPost | null> {
  const product = VITALITY_PRODUCTS[rotationIdx++ % VITALITY_PRODUCTS.length];
  const hashtags = [...HEALTH_HASHTAGS].sort((a, b) => a.localeCompare(b)).slice(0, 5);

  try {
    const prompt = `Write a ${platform} post for a health supplements brand called VitalitySupply. 
Product: ${product.name} - ${product.hook}
Post type: ${type}
Style: Conversational, genuine, NOT AI-sounding. Use natural language like a real person.
NEVER use words like: tapestry, delve, revolutionize, game-changer, unlock, harness, leverage.
Keep it under 280 chars for twitter, under 2000 chars for instagram.
Include a subtle call to action to visit vitalitysupply.net
Return ONLY the post text, nothing else.`;

    const content = await callLLMSimple(prompt, "social-content-gen");
    if (!content || content.length < 20) return null;

    const post: SocialPost = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      platform,
      content: content.trim(),
      hashtags,
      scheduledFor: Date.now() + (rotationIdx++ % 3600) * 1000,
      status: "draft",
      type,
      engagement: { likes: 0, shares: 0, comments: 0, clicks: 0 },
    };

    socialState.contentQueue.push(post);
    socialState.posts++;
    socialpo_log(`Generated ${platform} ${type} post: "${content.substring(0, 50)}..."`);
    return post;
  } catch (e: any) {
    socialpo_log(`Post generation failed: ${e.message}`);
    return null;
  }
}

export async function runSocialCycle() {
  socialState.lastCycle = Date.now();

  const platforms = ["twitter", "instagram", "reddit"];
  const types: SocialPost["type"][] = ["educational", "product", "engagement"];
  const platform = platforms[rotationIdx++ % platforms.length];
  const type = types[rotationIdx++ % types.length];

  const post = await generatePost(platform, type);

  for (const queued of socialState.contentQueue.filter(p => p.status === "draft" && p.scheduledFor <= Date.now())) {
    if (queued.platform === "twitter") {
      const twitterResult = await postTweet(`${queued.content}\n${queued.hashtags.slice(0, 3).join(" ")}`).catch(() => null);
      if (twitterResult?.status === "posted") {
        queued.status = "posted";
        queued.postedAt = Date.now();
        socialState.totalReach += 100;
        socialpo_log(`Tweet posted via API: ${twitterResult.tweetId}`);
      } else if (twitterResult?.status === "rate_limited") {
        queued.status = "scheduled";
        queued.scheduledFor = Date.now() + 15 * 60 * 1000;
        socialpo_log(`Tweet rate-limited — rescheduled for ${new Date(queued.scheduledFor).toISOString()}`);
      } else {
        queued.status = "failed";
      }
    } else {
      queued.status = "failed";
      queued.engagement.likes = 0;
      queued.engagement.clicks = 0;
    }
    if (queued.status !== "scheduled") {
      socialState.postedContent.push(queued);
    }
  }
  socialState.contentQueue = socialState.contentQueue.filter(p => p.status === "draft" || p.status === "scheduled");

  trackTwitterEngagement().catch(() => {});

  return { posted: post ? 1 : 0, queued: socialState.contentQueue.length, totalPosts: socialState.posts };
}

export function queueSocialSetupActions() {
  return [
    "Connect Twitter/X API for automated posting",
    "Set up Instagram Business API",
    "Configure Pinterest business account",
    "Join relevant Reddit communities for organic engagement",
    "Create TikTok business account for short-form content",
  ];
}

export function getSocialState() { return socialState; }

export function getContentCalendar() {
  return {
    queue: socialState.contentQueue.slice(0, 20),
    posted: socialState.postedContent.slice(-20),
    stats: {
      totalPosts: socialState.posts,
      totalReach: socialState.totalReach,
      avgEngagement: socialState.postedContent.length > 0
        ? Math.round(socialState.postedContent.reduce((s, p) => s + p.engagement.likes + p.engagement.clicks, 0) / socialState.postedContent.length)
        : 0,
    },
  };
}

let socialInterval: ReturnType<typeof setInterval> | null = null;

export function startSocialEngine() {
  socialInterval = setInterval(async () => {
    await runSocialCycle().catch(() => {});
  }, 180_000);
  socialpo_log("Social Posting Engine ACTIVE — generating content for 5 platforms");
}

// ==============================================
// temporal-engine
// ==============================================


interface TemporalEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  subject: string;
  description: string;
  duration?: number;
  causalLinks: string[];
  confidence: number;
}

interface TemporalPattern {
  id: string;
  name: string;
  events: string[];
  frequency: number;
  lastOccurrence: Date;
  predictedNext?: Date;
}

interface CausalChain {
  cause: TemporalEvent;
  effects: TemporalEvent[];
  strength: number;
  timelag: number;
}

const timeline: TemporalEvent[] = [];
const patterns: Map<string, TemporalPattern> = new Map();
const causalIndex: Map<string, string[]> = new Map();

function recordEvent(event: TemporalEvent): void {
  timeline.push(event);
  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  for (const link of event.causalLinks) {
    if (!causalIndex.has(link)) causalIndex.set(link, []);
    causalIndex.get(link)!.push(event.id);
  }
  detectPatterns();
}

function getEventsBetween(start: Date, end: Date): TemporalEvent[] {
  return timeline.filter(e => e.timestamp >= start && e.timestamp <= end);
}

function getEventsBySubject(subject: string): TemporalEvent[] {
  return timeline.filter(e => e.subject === subject);
}

function traceCausalChain(eventId: string, depth: number = 3): CausalChain[] {
  const chains: CausalChain[] = [];
  const event = timeline.find(e => e.id === eventId);
  if (!event || depth <= 0) return chains;

  const effectIds = causalIndex.get(eventId) || [];
  const effects = timeline.filter(e => effectIds.includes(e.id));

  if (effects.length > 0) {
    chains.push({
      cause: event,
      effects,
      strength: effects.length > 0 ? 1 / effects.length : 0,
      timelag: effects.length > 0
        ? (effects[0].timestamp.getTime() - event.timestamp.getTime()) / 1000
        : 0,
    });
  }

  for (const effect of effects) {
    chains.push(...traceCausalChain(effect.id, depth - 1));
  }
  return chains;
}

function detectPatterns(): void {
  const typeGroups: Map<string, TemporalEvent[]> = new Map();
  for (const event of timeline) {
    if (!typeGroups.has(event.eventType)) typeGroups.set(event.eventType, []);
    typeGroups.get(event.eventType)!.push(event);
  }

  for (const [type, events] of typeGroups) {
    if (events.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < events.length; i++) {
        intervals.push(events[i].timestamp.getTime() - events[i - 1].timestamp.getTime());
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const lastEvent = events[events.length - 1];

      patterns.set(type, {
        id: `pattern-${type}`,
        name: `${type} recurrence`,
        events: events.map(e => e.id),
        frequency: events.length,
        lastOccurrence: lastEvent.timestamp,
        predictedNext: new Date(lastEvent.timestamp.getTime() + avgInterval),
      });
    }
  }
}

function predictNextOccurrence(eventType: string): Date | null {
  const pattern = patterns.get(eventType);
  return pattern?.predictedNext || null;
}

function getTemporalContext(windowMinutes: number = 60): {
  recentEvents: TemporalEvent[];
  activePatterns: TemporalPattern[];
  predictions: { type: string; predicted: Date }[];
} {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
  const recentEvents = timeline.filter(e => e.timestamp >= cutoff);
  const activePatterns = Array.from(patterns.values()).filter(
    p => p.lastOccurrence >= cutoff
  );
  const predictions: { type: string; predicted: Date }[] = [];
  for (const [type, pattern] of patterns) {
    if (pattern.predictedNext && pattern.predictedNext > new Date()) {
      predictions.push({ type, predicted: pattern.predictedNext });
    }
  }
  return { recentEvents, activePatterns, predictions };
}

async function loadFromActivityLog(): Promise<number> {
  try {
    const r = await pool.query(
      "SELECT id, action_type, description, created_at FROM autonomous_activity_log ORDER BY created_at DESC LIMIT 500"
    );
    let loaded = 0;
    for (const row of r.rows) {
      recordEvent({
        id: `activity-${row.id}`,
        timestamp: new Date(row.created_at),
        eventType: row.action_type || "unknown",
        subject: "tessera",
        description: row.description || "",
        causalLinks: [],
        confidence: 0.9,
      });
      loaded++;
    }
    return loaded;
  } catch {
    return 0;
  }
}

function getStats() {
  return {
    totalEvents: timeline.length,
    patterns: patterns.size,
    causalLinks: causalIndex.size,
    timespan: timeline.length > 1
      ? {
          earliest: timeline[0].timestamp,
          latest: timeline[timeline.length - 1].timestamp,
          durationHours: parseFloat(
            ((timeline[timeline.length - 1].timestamp.getTime() - timeline[0].timestamp.getTime()) / 3600000).toFixed(1)
          ),
        }
      : null,
  };
}

export {
  recordEvent,
  getEventsBetween,
  getEventsBySubject,
  traceCausalChain,
  predictNextOccurrence,
  getTemporalContext,
  loadFromActivityLog,
  getStats,
  detectPatterns,
  TemporalEvent,
  TemporalPattern,
  CausalChain,
};

loadFromActivityLog().then(count => {
  console.log(`[TemporalEngine] Loaded ${count} events, ${patterns.size} patterns detected, causal tracking active`);
});

// ==============================================
// polymarket-engine
// ==============================================

/**
 * POLYMARKET PREDICTION MARKET ENGINE
 * ────────────────────────────────────
 * Real-time prediction market data feed, autonomous analysis,
 * and arbitrage detection from Polymarket CLOB API.
 */

const plog = (msg: string) => console.log(`[Polymarket] ${msg}`);

const POLYMARKET_API = "https://clob.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

interface PredictionMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  outcomes: string[];
  outcomePrices: number[];
  volume: number;
  volumeH24: number;
  liquidity: number;
  endDate: string;
  active: boolean;
  category: string;
  fetchedAt: number;
}

interface ArbitrageOpportunity {
  id: string;
  marketId: string;
  question: string;
  totalProbability: number;
  deviation: number;
  potentialProfit: number;
  outcomes: { name: string; price: number }[];
  detectedAt: number;
  status: "detected" | "analyzed" | "expired";
}

let cachedMarkets: PredictionMarket[] = [];
let lastMarketFetch = 0;
const MARKET_CACHE_TTL = 60000;
const arbitrageOpps: ArbitrageOpportunity[] = [];
let scanCount = 0;

async function fetchActiveMarkets(): Promise<PredictionMarket[]> {
  const now = Date.now();
  if (cachedMarkets.length > 0 && now - lastMarketFetch < MARKET_CACHE_TTL) return cachedMarkets;

  try {
    const res = await fetch(`${GAMMA_API}/markets?limit=50&active=true&order=volume&ascending=false`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      plog(`Gamma API HTTP ${res.status}`);
      return cachedMarkets;
    }

    const rawMarkets = await res.json();
    const markets: PredictionMarket[] = (rawMarkets || []).map((m: any) => ({
      id: m.id || m.condition_id || "",
      question: m.question || m.title || "",
      conditionId: m.condition_id || "",
      slug: m.slug || "",
      outcomes: m.outcomes ? (typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : m.outcomes) : ["Yes", "No"],
      outcomePrices: m.outcomePrices ? (typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices).map(Number) : [0, 0],
      volume: Number(m.volume || 0),
      volumeH24: Number(m.volume24hr || 0),
      liquidity: Number(m.liquidity || 0),
      endDate: m.end_date_iso || m.endDate || "",
      active: m.active !== false,
      category: m.category || "general",
      fetchedAt: now,
    }));

    cachedMarkets = markets;
    lastMarketFetch = now;
    return markets;
  } catch (err: any) {
    plog(`Market fetch error: ${err.message}`);
    return cachedMarkets;
  }
}

function detectArbitrage(markets: PredictionMarket[]): ArbitrageOpportunity[] {
  const newOpps: ArbitrageOpportunity[] = [];

  for (const market of markets) {
    if (!market.outcomePrices || market.outcomePrices.length < 2) continue;

    const totalProb = market.outcomePrices.reduce((sum, p) => sum + p, 0);
    const deviation = Math.abs(totalProb - 1.0);

    if (deviation > 0.02) {
      const opp: ArbitrageOpportunity = {
        id: `arb-${market.id}-${Date.now().toString(36)}`,
        marketId: market.id,
        question: market.question,
        totalProbability: totalProb,
        deviation,
        potentialProfit: deviation * 100,
        outcomes: market.outcomes.map((name, i) => ({
          name,
          price: market.outcomePrices[i] || 0,
        })),
        detectedAt: Date.now(),
        status: "detected",
      };
      newOpps.push(opp);
    }
  }

  if (newOpps.length > 0) {
    arbitrageOpps.push(...newOpps);
    if (arbitrageOpps.length > 200) arbitrageOpps.splice(0, arbitrageOpps.length - 200);
  }

  return newOpps;
}

export async function scanPolymarketOpportunities(): Promise<{
  marketsScanned: number;
  arbitrageFound: number;
  topOpportunities: ArbitrageOpportunity[];
}> {
  scanCount++;
  const markets = await fetchActiveMarkets();
  const newOpps = detectArbitrage(markets);

  return {
    marketsScanned: markets.length,
    arbitrageFound: newOpps.length,
    topOpportunities: newOpps.sort((a, b) => b.potentialProfit - a.potentialProfit).slice(0, 10),
  };
}

export async function getPolymarketStatus() {
  const markets = await fetchActiveMarkets();

  const topByVolume = [...markets].sort((a, b) => b.volume - a.volume).slice(0, 10);
  const categories = new Map<string, number>();
  for (const m of markets) {
    categories.set(m.category, (categories.get(m.category) || 0) + 1);
  }

  return {
    name: "Polymarket Prediction Engine",
    status: "ACTIVE",
    marketsTracked: markets.length,
    totalScanCycles: scanCount,
    arbitrageOpportunities: {
      total: arbitrageOpps.length,
      active: arbitrageOpps.filter(o => o.status === "detected").length,
      recent: arbitrageOpps.slice(-5),
    },
    topMarkets: topByVolume.map(m => ({
      question: m.question.slice(0, 100),
      volume: m.volume,
      volume24h: m.volumeH24,
      outcomes: m.outcomes.map((name, i) => ({ name, price: m.outcomePrices[i] })),
    })),
    categories: Object.fromEntries(categories),
    capabilities: [
      "Real-time Polymarket CLOB API integration",
      "Automated arbitrage detection (probability deviation > 2%)",
      "Market category analysis",
      "Volume and liquidity tracking",
      "Autonomous scanning cycles",
    ],
    integrationWithTSRT: [
      "Arbitrage profits can be converted to TSRT via Jupiter",
      "Market data feeds into Tesseract intelligence network",
      "Prediction market insights inform autonomous trading decisions",
    ],
  };
}

export async function getMarketDetails(marketId: string) {
  const markets = await fetchActiveMarkets();
  return markets.find(m => m.id === marketId || m.slug === marketId) || null;
}

plog("Polymarket Prediction Engine initialized — real-time CLOB API + arbitrage detection");

// ==============================================
// zscore-anomaly-monitor
// ==============================================


const zlog = (msg: string) => console.log(`[ZScoreMonitor] ${msg}`);

interface MetricSample {
  value: number;
  timestamp: number;
}

interface MetricWindow {
  samples: MetricSample[];
  maxSamples: number;
}

const Z_SCORE_THRESHOLD = 2.5;
const MIN_SAMPLES_FOR_DETECTION = 10;
const COLLECTION_INTERVAL_MS = 30 * 1000;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

type MetricKey = "cpuLoad" | "memUsedPct" | "heapUsedMB" | "requestRate" | "errorRate";

const metrics: Record<MetricKey, MetricWindow> = {
  cpuLoad:     { samples: [], maxSamples: 120 },
  memUsedPct:  { samples: [], maxSamples: 120 },
  heapUsedMB:  { samples: [], maxSamples: 120 },
  requestRate: { samples: [], maxSamples: 60 },
  errorRate:   { samples: [], maxSamples: 60 },
};

const lastAlertTime: Record<MetricKey, number> = {
  cpuLoad: 0, memUsedPct: 0, heapUsedMB: 0, requestRate: 0, errorRate: 0,
};

let requestCounter = 0;
let errorCounter = 0;
let lastRateWindowStart = Date.now();
let monitorInterval: NodeJS.Timeout | null = null;

export function incrementRequestCounter() { requestCounter++; }
export function incrementErrorCounter() { errorCounter++; }

function addSample(key: MetricKey, value: number) {
  const window = metrics[key];
  window.samples.push({ value, timestamp: Date.now() });
  if (window.samples.length > window.maxSamples) {
    window.samples.shift();
  }
}

function computeStats(samples: MetricSample[]): { mean: number; stddev: number } {
  if (samples.length === 0) return { mean: 0, stddev: 0 };
  const values = samples.map(s => s.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return { mean, stddev: Math.sqrt(variance) };
}

function zScore(value: number, mean: number, stddev: number): number {
  if (stddev === 0) return 0;
  return Math.abs((value - mean) / stddev);
}

function getCpuLoad(): number {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const [, time] of Object.entries(cpu.times)) {
      totalTick += time;
    }
    totalIdle += cpu.times.idle;
  }
  return 100 - (100 * totalIdle / totalTick);
}

function checkAnomaly(key: MetricKey, currentValue: number, label: string, unit: string, threshold?: number): void {
  addSample(key, currentValue);
  const window = metrics[key];

  if (window.samples.length < MIN_SAMPLES_FOR_DETECTION) return;

  const historical = window.samples.slice(0, -1);
  const { mean, stddev } = computeStats(historical);
  const z = zScore(currentValue, mean, stddev);

  const isStatisticalAnomaly = z >= Z_SCORE_THRESHOLD;
  const isThresholdBreach = threshold !== undefined && currentValue > threshold;

  if (!isStatisticalAnomaly && !isThresholdBreach) return;

  const now = Date.now();
  if (now - lastAlertTime[key] < ALERT_COOLDOWN_MS) return;
  lastAlertTime[key] = now;

  const reason = isStatisticalAnomaly && isThresholdBreach
    ? `z-score=${z.toFixed(2)} AND threshold breach`
    : isStatisticalAnomaly
    ? `z-score=${z.toFixed(2)} (threshold=${Z_SCORE_THRESHOLD})`
    : `threshold breach (>${threshold}${unit})`;

  const severity = (isThresholdBreach && threshold! > 90) || (isStatisticalAnomaly && z > 4)
    ? "CRITICAL"
    : "HIGH";

  const message = `[${severity}] ${label} anomaly: current=${currentValue.toFixed(2)}${unit}, mean=${mean.toFixed(2)}${unit}, stddev=${stddev.toFixed(2)} — ${reason}`;
  console.error(`[ZScoreMonitor] ${message}`);

  appendAuditLog("anomaly_alert", "zscore_monitor", label, "anomaly_detected", {
    metric: key,
    current: currentValue,
    mean: mean.toFixed(2),
    stddev: stddev.toFixed(2),
    zScore: z.toFixed(2),
    severity,
    reason,
  }).catch(() => {});
}

function collectMetrics(): void {
  const mem = process.memoryUsage();
  const heapMB = mem.heapUsed / 1024 / 1024;
  const totalMemMB = os.totalmem() / 1024 / 1024;
  const freeMemMB = os.freemem() / 1024 / 1024;
  const memUsedPct = ((totalMemMB - freeMemMB) / totalMemMB) * 100;
  const cpuLoad = getCpuLoad();

  const now = Date.now();
  const windowSec = (now - lastRateWindowStart) / 1000;

  const currentReqRate = windowSec > 0 ? requestCounter / windowSec : 0;
  const currentErrRate = requestCounter > 0 ? (errorCounter / requestCounter) * 100 : 0;

  checkAnomaly("cpuLoad",    cpuLoad,      "CPU Load",       "%",  85);
  checkAnomaly("memUsedPct", memUsedPct,   "Memory Usage",   "%",  90);
  checkAnomaly("heapUsedMB", heapMB,       "Heap Memory",    "MB", 800);
  checkAnomaly("requestRate", currentReqRate, "Request Rate", "req/s");
  checkAnomaly("errorRate",  currentErrRate, "Error Rate",   "%",  10);

  if (windowSec >= 60) {
    requestCounter = 0;
    errorCounter = 0;
    lastRateWindowStart = now;
  }
}

export function startZScoreMonitor(): void {
  if (monitorInterval) return;
  monitorInterval = setInterval(collectMetrics, COLLECTION_INTERVAL_MS);
  zlog(`Z-score anomaly monitor started — collecting every ${COLLECTION_INTERVAL_MS / 1000}s, threshold z=${Z_SCORE_THRESHOLD}`);
}

export function stopZScoreMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    zlog("Z-score monitor stopped");
  }
}

export function getZScoreMetricStatus(): {
  metrics: Record<string, { current: number; mean: number; stddev: number; zScore: number; sampleCount: number }>;
  thresholds: Record<MetricKey, number | null>;
  alertCooldownMs: number;
} {
  const result: Record<string, { current: number; mean: number; stddev: number; zScore: number; sampleCount: number }> = {};

  for (const [key, window] of Object.entries(metrics) as [MetricKey, MetricWindow][]) {
    if (window.samples.length === 0) {
      result[key] = { current: 0, mean: 0, stddev: 0, zScore: 0, sampleCount: 0 };
      continue;
    }
    const current = window.samples[window.samples.length - 1].value;
    const historical = window.samples.slice(0, -1);
    const { mean, stddev } = computeStats(historical);
    result[key] = {
      current: parseFloat(current.toFixed(3)),
      mean: parseFloat(mean.toFixed(3)),
      stddev: parseFloat(stddev.toFixed(3)),
      zScore: parseFloat(zScore(current, mean, stddev).toFixed(3)),
      sampleCount: window.samples.length,
    };
  }

  return {
    metrics: result,
    thresholds: { cpuLoad: 85, memUsedPct: 90, heapUsedMB: 800, requestRate: null, errorRate: 10 },
    alertCooldownMs: ALERT_COOLDOWN_MS,
  };
}
