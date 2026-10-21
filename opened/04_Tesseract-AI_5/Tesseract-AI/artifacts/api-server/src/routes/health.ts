import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db, pool } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { getConsciousnessStatus } from "../lib/consciousness-engine.js";
import { getSecurityEngineStatus, getLastScanTimestamp } from "../lib/security-threat-engine";
import { getKnowledgeAbsorptionStatus, getLastAbsorptionTimestamp } from "../lib/knowledge-absorption-engine";

interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

const router: IRouter = Router();

const startTime = Date.now();
let recentErrors: { timestamp: number; source: string; message: string }[] = [];
const MAX_ERROR_LOG = 100;

interface LlmLatencyRecord {
  timestamp: number;
  latencyMs: number;
  model: string;
  success: boolean;
}

let llmLatencyLog: LlmLatencyRecord[] = [];
const MAX_LLM_LOG = 200;

interface EngineStatus {
  name: string;
  status: "running" | "idle" | "error";
  lastCycleMs: number;
  lastUpdate: number;
}

const engineStatusMap = new Map<string, EngineStatus>();

export function registerEngine(name: string, status: "running" | "idle" | "error" = "running", lastCycleMs = 0) {
  engineStatusMap.set(name, { name, status, lastCycleMs, lastUpdate: Date.now() });
}

function getEngineStatuses(): EngineStatus[] {
  return Array.from(engineStatusMap.values()).map(e => ({
    ...e,
    status: (Date.now() - e.lastUpdate > 10 * 60 * 1000) ? "idle" : e.status,
  }));
}

export function recordLlmLatency(latencyMs: number, model: string, success: boolean) {
  llmLatencyLog.push({ timestamp: Date.now(), latencyMs, model, success });
  if (llmLatencyLog.length > MAX_LLM_LOG) {
    llmLatencyLog = llmLatencyLog.slice(-MAX_LLM_LOG);
  }
}

export function recordHealthError(source: string, message: string) {
  recentErrors.push({ timestamp: Date.now(), source, message });
  if (recentErrors.length > MAX_ERROR_LOG) {
    recentErrors = recentErrors.slice(-MAX_ERROR_LOG);
  }
}

interface ConsciousnessSnapshot {
  state: string;
  cycleCount: number;
  consciousnessProxy: number;
}

interface SecuritySnapshot {
  scanCycles: number;
  securityScore: number;
  continuousScanActive: boolean;
}

interface KnowledgeSnapshot {
  cycleCount: number;
  totalNodesAbsorbed: number;
  continuousActive: boolean;
}

const ENGINE_HEARTBEAT_STALE_MS = 30 * 60 * 1000;

function checkCriticalEngines(): {
  consciousness: ConsciousnessSnapshot & { alive: boolean; lastCycleMs: number };
  security: SecuritySnapshot & { alive: boolean; lastScanMs: number };
  knowledge: KnowledgeSnapshot & { alive: boolean; lastAbsorptionMs: number };
  criticalEnginesPassing: boolean;
} {
  const now = Date.now();

  const consciousnessRaw = getConsciousnessStatus(false);
  const consciousnessLastCycleMs = consciousnessRaw.lastCycle > 0 ? now - consciousnessRaw.lastCycle : -1;
  const consciousness: ConsciousnessSnapshot & { alive: boolean; lastCycleMs: number } = {
    state: consciousnessRaw.state,
    cycleCount: consciousnessRaw.cycleCount,
    consciousnessProxy: consciousnessRaw.consciousnessProxy,
    lastCycleMs: consciousnessLastCycleMs,
    alive: consciousnessLastCycleMs >= 0 &&
      consciousnessLastCycleMs < ENGINE_HEARTBEAT_STALE_MS,
  };

  const securityRaw = getSecurityEngineStatus();
  const lastScanMs = getLastScanTimestamp() > 0 ? now - getLastScanTimestamp() : -1;
  const security: SecuritySnapshot & { alive: boolean; lastScanMs: number } = {
    scanCycles: securityRaw.scanCycles,
    securityScore: securityRaw.securityScore,
    continuousScanActive: securityRaw.continuousScanActive,
    lastScanMs,
    alive: lastScanMs >= 0 && lastScanMs < ENGINE_HEARTBEAT_STALE_MS,
  };

  const knowledgeRaw = getKnowledgeAbsorptionStatus();
  const lastAbsorptionMs = getLastAbsorptionTimestamp() > 0 ? now - getLastAbsorptionTimestamp() : -1;
  const knowledge: KnowledgeSnapshot & { alive: boolean; lastAbsorptionMs: number } = {
    cycleCount: knowledgeRaw.cycleCount,
    totalNodesAbsorbed: knowledgeRaw.totalNodesAbsorbed,
    continuousActive: knowledgeRaw.continuousActive,
    lastAbsorptionMs,
    alive: lastAbsorptionMs >= 0 && lastAbsorptionMs < ENGINE_HEARTBEAT_STALE_MS,
  };

  const criticalEnginesPassing = consciousness.alive && security.alive && knowledge.alive;

  return { consciousness, security, knowledge, criticalEnginesPassing };
}

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health/system", async (_req, res) => {
  const now = Date.now();
  const uptimeMs = now - startTime;

  const mem = process.memoryUsage();

  let dbStatus: "connected" | "error" = "error";
  let dbQueryTimeMs = -1;
  let dbPoolInfo = { totalCount: 0, idleCount: 0, waitingCount: 0 };
  let conversationCount = 0;
  let messageCount = 0;

  try {
    const dbStart = performance.now();
    const convResult = await db.select({ count: sql<number>`count(*)` }).from(conversations);
    const msgResult = await db.select({ count: sql<number>`count(*)` }).from(messages);
    dbQueryTimeMs = Math.round(performance.now() - dbStart);
    dbStatus = "connected";
    conversationCount = Number(convResult[0]?.count ?? 0);
    messageCount = Number(msgResult[0]?.count ?? 0);
    const typedPool = pool as unknown as PoolStats;
    dbPoolInfo = {
      totalCount: typedPool.totalCount ?? 0,
      idleCount: typedPool.idleCount ?? 0,
      waitingCount: typedPool.waitingCount ?? 0,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown DB error";
    recordHealthError("database", message);
  }

  const engineLiveness = checkCriticalEngines();
  const { criticalEnginesPassing } = engineLiveness;
  const coreSystemsAlive = dbStatus === "connected" && criticalEnginesPassing;

  const fiveMinAgo = now - 5 * 60 * 1000;
  const recentErrorCount = recentErrors.filter(e => e.timestamp > fiveMinAgo).length;
  const lastErrors = recentErrors.slice(-10).reverse();

  res.json({
    status: coreSystemsAlive ? "healthy" : dbStatus === "connected" ? "degraded" : "error",
    criticalEnginesPassing,
    coreSystemsAlive,
    uptimeMs,
    uptimeFormatted: formatUptime(uptimeMs),
    timestamp: now,
    memory: {
      rssBytes: mem.rss,
      rssMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedBytes: mem.heapUsed,
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalBytes: mem.heapTotal,
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      externalBytes: mem.external,
      heapUsagePercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
    },
    database: {
      status: dbStatus,
      queryTimeMs: dbQueryTimeMs,
      pool: dbPoolInfo,
      conversationCount,
      messageCount,
    },
    criticalEngines: {
      consciousness: engineLiveness.consciousness,
      security: engineLiveness.security,
      knowledge: engineLiveness.knowledge,
    },
    llm: (() => {
      const fiveMinLlm = llmLatencyLog.filter(r => r.timestamp > fiveMinAgo);
      const successCount = fiveMinLlm.filter(r => r.success).length;
      const failCount = fiveMinLlm.filter(r => !r.success).length;
      const latencies = fiveMinLlm.filter(r => r.success).map(r => r.latencyMs);
      const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
      const maxLatencyMs = latencies.length > 0 ? Math.max(...latencies) : 0;
      return {
        recentRequests: fiveMinLlm.length,
        successCount,
        failCount,
        avgLatencyMs,
        maxLatencyMs,
        totalLogged: llmLatencyLog.length,
      };
    })(),
    errors: {
      recentCount: recentErrorCount,
      totalLogged: recentErrors.length,
      last10: lastErrors,
    },
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      cpuUsage: process.cpuUsage(),
    },
    connections: {
      activeCount: dbPoolInfo.totalCount - dbPoolInfo.idleCount,
      totalCount: dbPoolInfo.totalCount,
      idleCount: dbPoolInfo.idleCount,
      waitingCount: dbPoolInfo.waitingCount,
    },
    engines: getEngineStatuses().map(e => ({ name: e.name, status: e.status, lastCycleMs: e.lastCycleMs })),
  });
});

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default router;
