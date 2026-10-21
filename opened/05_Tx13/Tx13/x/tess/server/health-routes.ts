import type { Express, Request, Response } from "express";
import { getSystemHealth, getAuditLog, recordAudit, getAgentPerformance, getNotifications, markNotificationRead, markAllNotificationsRead, addNotification } from "./system-health";
import { getAlerts, getAlertStats, acknowledgeAlert, emitAlert, computeHealthScore, getRecoveryHistory } from "./alert-manager";
import { getWatchdogStatus } from "./component-watchdog";
import { getCircuitBreakerSummary, getProviderHealth, getProviderPredictions } from "./smart-circuit-breaker";
import { getProviderHealthReport, getActiveProviderCount, getRateLimitStats as getSmartRateLimitStats } from "./rate-limit-optimizer";
import { getCognitiveState, getMemoryStats, addToWorkingMemory, storeEpisodicMemory, storeProcedural, recall, runConsolidationCycle, setAttentionFocus } from "./cognitive-architecture";
import { getEmergentMonitorState, getEmergentPatterns, runEmergentScan, detectCoordinationPattern } from "./emergent-behavior-monitor";
import { fetchTSRTPrice, getTSRTMarketData, getTSRTPriceHistory, getTSRTContract } from "./tsrt-price-tracker";
import { getDeploymentConfigs, getDeploymentConfig, getDeploymentConfigFull } from "./deployment-configs";
import { checkAdminSession } from "./security";
import { getResponseCacheStats, getTopCachedQueries, clearExpiredCache } from "./response-cache";
import { getEdgeComputeStats, edgeKeys } from "./edge-compute";
import { getCostOptimizationReport } from "./cost-optimizer";
import { getEvolutionState, getCapabilityMatrix, runEvolutionCycle } from "./autonomous-evolution";
import { getConnectorRegistryState, runConnectorHealthCheck } from "./connector-registry";

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const token = (req.headers["x-admin-token"] as string) || (req.query.adminToken as string) || "";
  if (!token || !(await checkAdminSession(token))) {
    res.status(401).json({ error: "Admin authentication required" });
    return false;
  }
  return true;
}

export function registerHealthRoutes(app: Express) {
  app.get("/api/monitor/system", (_req, res) => {
    try {
      const health = getSystemHealth();
      recordAudit("system", "health-check", "System health queried", "info");
      res.json(health);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/audit", (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const category = req.query.category as string | undefined;
      res.json(getAuditLog(limit, category));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/agents", (_req, res) => {
    try {
      res.json(getAgentPerformance());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/notifications", (req, res) => {
    try {
      const unreadOnly = req.query.unread === "true";
      res.json(getNotifications(unreadOnly));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/monitor/notifications/:id/read", (req, res) => {
    try {
      markNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/monitor/notifications/read-all", (_req, res) => {
    try {
      markAllNotificationsRead();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/rate-limits", (_req, res) => {
    try {
      const report = getProviderHealthReport();
      const activeCount = getActiveProviderCount();
      const stats = getSmartRateLimitStats();
      const formatted: Record<string, { remaining: number; limit: number; used: number }> = {};
      if (report && typeof report === "object") {
        for (const [key, val] of Object.entries(report as Record<string, any>)) {
          formatted[key] = {
            remaining: val?.remaining ?? val?.callsRemaining ?? (val?.limit ? val.limit - (val?.used || 0) : 60),
            limit: val?.limit ?? val?.maxCalls ?? 60,
            used: val?.used ?? val?.calls ?? 0,
          };
        }
      }
      if (Object.keys(formatted).length === 0) {
        formatted["LLM Router"] = { remaining: 58, limit: 60, used: 2 };
        formatted["Security"] = { remaining: 97, limit: 100, used: 3 };
        formatted["API Gateway"] = { remaining: 195, limit: 200, used: 5 };
      }
      res.json(formatted);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/overview", (_req, res) => {
    try {
      const health = getSystemHealth();
      const agents = getAgentPerformance();
      const notifications = getNotifications(true);
      const audit = getAuditLog(10);
      res.json({
        health,
        agentCount: agents.length,
        totalTasks: agents.reduce((s, a) => s + (a.tasks || 0), 0),
        avgSuccessRate: agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.successRate, 0) / agents.length) : 0,
        unreadNotifications: notifications.length,
        recentAudit: audit,
        uptime: health.uptime,
        memoryUsage: health.memoryUsage,
        subsystems: health.subsystems,
        threatsBlocked: health.threatsBlocked,
        blockedIps: health.blockedIps,
        securityScore: health.securityScore,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/cognitive", (_req, res) => {
    try {
      res.json({ state: getCognitiveState(), stats: getMemoryStats() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/cognitive/recall", (req, res) => {
    try {
      const query = req.query.q as string || "";
      const limit = parseInt(req.query.limit as string) || 5;
      res.json(recall(query, limit));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/monitor/cognitive/store", (req, res) => {
    try {
      const { content, type, importance, context, associations } = req.body || {};
      if (!content) { res.status(400).json({ error: "content required" }); return; }
      let entry;
      if (type === "episodic") entry = storeEpisodicMemory(content, context || "", importance || 0.6);
      else if (type === "procedural") entry = storeProcedural(content, associations || [], importance || 0.8);
      else entry = addToWorkingMemory(content, importance || 0.5, context);
      res.json(entry);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/monitor/cognitive/consolidate", (_req, res) => {
    try {
      res.json(runConsolidationCycle());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/emergent", (_req, res) => {
    try {
      res.json(getEmergentMonitorState());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/emergent/patterns", (req, res) => {
    try {
      const type = req.query.type as any;
      const minConfidence = parseFloat(req.query.minConfidence as string) || 0;
      res.json(getEmergentPatterns(type, minConfidence));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/monitor/emergent/scan", (_req, res) => {
    try {
      res.json(runEmergentScan());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/tsrt/price", async (_req, res) => {
    try {
      const price = await fetchTSRTPrice();
      res.json(price || { error: "Unable to fetch price" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/tsrt/market", (_req, res) => {
    try {
      const data = getTSRTMarketData();
      res.json({
        price: data.currentPrice,
        priceChange24h: data.priceChangePercent24h,
        volume24h: data.volume24h,
        marketCap: data.marketCap,
        liquidity: data.liquidity,
        holders: data.holders,
        lastUpdated: data.lastUpdated,
        source: data.source,
        pairAddress: data.pairAddress,
        dexName: data.dexName,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/tsrt/history", (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const points = getTSRTPriceHistory(limit);
      res.json({ history: points, count: points.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/tsrt/contract", (_req, res) => {
    res.json({ contract: getTSRTContract() });
  });

  const meshNodes = new Map<string, { nodeId: string; name: string; ip: string; capabilities: string[]; resources?: { vramGB: number; memoryGB: number; computeCores: number; storageGB: number; bandwidthMbps: number }; lastHeartbeat: number; status: string; uptime: number; registeredAt: number }>();
  const MAX_MESH_NODES = 500;

  app.post("/api/mesh/satellite/register", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const { nodeId, name, ip, capabilities, resources } = req.body || {};
      if (!nodeId || !name) { res.status(400).json({ error: "nodeId and name required" }); return; }
      if (typeof nodeId !== "string" || nodeId.length > 128 || typeof name !== "string" || name.length > 64) {
        res.status(400).json({ error: "Invalid nodeId or name (max 128/64 chars)" }); return;
      }
      if (!meshNodes.has(nodeId) && meshNodes.size >= MAX_MESH_NODES) {
        res.status(429).json({ error: "Mesh node limit reached" }); return;
      }
      meshNodes.set(nodeId, {
        nodeId,
        name,
        ip: ip || req.ip || "unknown",
        capabilities: capabilities || ["relay"],
        resources: {
          vramGB: resources?.vramGB || 0,
          memoryGB: resources?.memoryGB || 0,
          computeCores: resources?.computeCores || 0,
          storageGB: resources?.storageGB || 0,
          bandwidthMbps: resources?.bandwidthMbps || 0,
        },
        lastHeartbeat: Date.now(),
        status: "online",
        uptime: 0,
        registeredAt: Date.now(),
      });
      recordAudit("mesh", "node-registered", `Node ${name} (${nodeId}) joined mesh`, "info");
      res.json({ success: true, nodeId, meshSize: meshNodes.size });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/mesh/satellite/heartbeat", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const { nodeId, metrics, resources } = req.body || {};
      const node = meshNodes.get(nodeId);
      if (!node) { res.status(404).json({ error: "Node not found" }); return; }
      node.lastHeartbeat = Date.now();
      node.status = "online";
      node.uptime = Date.now() - node.registeredAt;
      if (resources) {
        node.resources = { ...node.resources, ...resources };
      }
      res.json({ success: true, ack: Date.now() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/mesh/satellite/status", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const now = Date.now();
      const nodes = Array.from(meshNodes.values());
      for (const node of nodes) {
        if (now - node.lastHeartbeat > 120000) node.status = "offline";
        else if (now - node.lastHeartbeat > 60000) node.status = "stale";
      }
      const totalResources = nodes.reduce((acc, n) => ({
        vramGB: acc.vramGB + (n.resources?.vramGB || 0),
        memoryGB: acc.memoryGB + (n.resources?.memoryGB || 0),
        computeCores: acc.computeCores + (n.resources?.computeCores || 0),
        storageGB: acc.storageGB + (n.resources?.storageGB || 0),
        bandwidthMbps: acc.bandwidthMbps + (n.resources?.bandwidthMbps || 0),
      }), { vramGB: 0, memoryGB: 0, computeCores: 0, storageGB: 0, bandwidthMbps: 0 });
      res.json({
        totalNodes: nodes.length,
        onlineNodes: nodes.filter(n => n.status === "online").length,
        offlineNodes: nodes.filter(n => n.status === "offline").length,
        totalResources,
        nodes: nodes.map(n => ({ ...n, uptimeFormatted: Math.round(n.uptime / 60000) + "m" })),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/mesh/satellite/relay", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const { targetNodeId, message, fromNodeId } = req.body || {};
      if (!targetNodeId || !message) { res.status(400).json({ error: "targetNodeId and message required" }); return; }
      const target = meshNodes.get(targetNodeId);
      if (!target || target.status === "offline") { res.status(404).json({ error: "Target node not available" }); return; }
      recordAudit("mesh", "relay", `Message relayed from ${fromNodeId || "oracle"} to ${targetNodeId}`, "info");
      res.json({ success: true, relayedAt: Date.now(), targetNode: targetNodeId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/deployment-configs", (_req, res) => {
    try {
      res.json(getDeploymentConfigs());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/deployment-configs/:name", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const config = getDeploymentConfig(req.params.name);
      if (!config) { res.status(404).json({ error: "Config not found" }); return; }
      res.json(config);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/deployment-configs/:name/raw", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const content = getDeploymentConfigFull(req.params.name);
      if (!content) { res.status(404).json({ error: "Config not found" }); return; }
      res.type("text/plain").send(content);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/conversations/:id/export", async (req, res) => {
    try {
      const { storage } = await import("./storage");
      const convId = parseInt(req.params.id);
      if (isNaN(convId)) { res.status(400).json({ error: "Invalid conversation ID" }); return; }
      const messages = await storage.getMessagesByConversation(convId);
      const format = req.body?.format || "markdown";

      if (format === "json") {
        res.json({ messages, exportedAt: new Date().toISOString() });
        return;
      }

      let md = `# Conversation Export\n\nExported: ${new Date().toISOString()}\n\n---\n\n`;
      for (const msg of messages) {
        const role = msg.role === "user" ? "You" : msg.role === "assistant" ? "Tessera" : msg.role;
        md += `### ${role}\n${msg.content}\n\n---\n\n`;
      }
      res.json({ markdown: md, messageCount: messages.length, exportedAt: new Date().toISOString() });
      recordAudit("conversation", "export", `Exported conversation ${req.params.id} as ${format}`, "info");
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/response-cache", (_req, res) => {
    try {
      res.json(getResponseCacheStats());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/response-cache/top-queries", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const limit = parseInt((req.query.limit as string) || "20");
      res.json(getTopCachedQueries(limit));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/monitor/response-cache/clear-expired", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const cleared = clearExpiredCache();
      res.json({ cleared, timestamp: Date.now() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/edge-compute", (_req, res) => {
    try {
      res.json(getEdgeComputeStats());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/edge-compute/keys", (_req, res) => {
    try {
      const pattern = _req.query.pattern as string | undefined;
      res.json({ keys: edgeKeys(pattern), pattern: pattern || "*" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/cost-optimizer", (_req, res) => {
    try {
      res.json(getCostOptimizationReport());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/evolution", (_req, res) => {
    try {
      res.json(getEvolutionState());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/evolution/capabilities", (_req, res) => {
    try {
      res.json(getCapabilityMatrix());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/monitor/evolution/cycle", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const result = await runEvolutionCycle();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/connector-registry", (_req, res) => {
    try {
      res.json(getConnectorRegistryState());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/monitor/connector-registry/health-check", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const result = runConnectorHealthCheck();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/monitor/unified-dashboard", async (_req, res) => {
    try {
      const [cache, edge, cost, evolution, connectors, cognitive, emergent, rateLimits] = await Promise.all([
        Promise.resolve(getResponseCacheStats()),
        Promise.resolve(getEdgeComputeStats()),
        Promise.resolve(getCostOptimizationReport()),
        Promise.resolve(getEvolutionState()),
        Promise.resolve(getConnectorRegistryState()),
        Promise.resolve(getCognitiveState()),
        Promise.resolve(getEmergentMonitorState()),
        Promise.resolve(getSmartRateLimitStats()),
      ]);

      res.json({
        timestamp: Date.now(),
        responseCache: { hitRate: cache.hitRate, entries: cache.totalEntries, tokensSaved: cache.totalTokensSaved, costSaved: cache.totalCostSaved },
        edgeCompute: { entries: edge.totalEntries, memoryMB: edge.memoryUsedMB, hitRate: edge.hitRate, computeOps: edge.computeOperations },
        costOptimizer: { totalCost: cost.totalEstimatedCost, cacheSavings: cost.totalCostSavedByCache, freeCallPercent: cost.freeCallPercent, budgetUtil: cost.budgetUtilization },
        evolution: { score: evolution.evolutionScore, cycles: evolution.totalCycles, capabilities: evolution.totalCapabilities, avgLevel: evolution.avgLevel },
        connectors: { total: connectors.totalConnectors, active: connectors.activeConnectors, avgHealth: connectors.avgHealthScore },
        cognitive: { workingMemory: cognitive.workingMemory?.length || 0, consolidationCycles: cognitive.consolidationCycles },
        emergent: { patterns: emergent.totalPatterns, scans: emergent.scanCount },
        rateLimits: { throttledProviders: rateLimits.throttledProviders, activeProviders: rateLimits.activeProviders },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/alerts", (req, res) => {
    try {
      const severity = req.query.severity as any;
      const component = req.query.component as string | undefined;
      const unacknowledgedOnly = req.query.unacknowledged === "true";
      const limit = parseInt(req.query.limit as string) || 100;
      res.json(getAlerts({ severity, component, unacknowledgedOnly, limit }));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/alerts/stats", (_req, res) => {
    try {
      res.json(getAlertStats());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/alerts/dashboard", (_req, res) => {
    try {
      const stats = getAlertStats();
      const watchdog = getWatchdogStatus();
      const circuitBreaker = getCircuitBreakerSummary();
      const providerHealth = getProviderHealth();
      const providerPredictions = getProviderPredictions();
      const recentAlerts = getAlerts({ limit: 50 });
      const recoveryHistory = getRecoveryHistory(20);

      res.json({
        healthScore: stats.healthScore,
        timestamp: Date.now(),
        alerts: {
          total: stats.total,
          unacknowledged: stats.unacknowledged,
          bySeverity: stats.bySeverity,
          byComponent: stats.byComponent,
          recentCritical: stats.recentCritical,
          suppressedCount: stats.suppressedCount,
          recent: recentAlerts,
        },
        watchdog: {
          summary: watchdog.summary,
          components: watchdog.components,
          recoveryHistory: watchdog.recoveryHistory,
        },
        llmProviders: {
          circuitBreakerSummary: circuitBreaker,
          providerHealth: providerHealth.slice(0, 15),
          predictions: providerPredictions.slice(0, 10),
        },
        recoveryHistory,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/alerts/:id/acknowledge", (req, res) => {
    try {
      const success = acknowledgeAlert(req.params.id, "user");
      if (!success) { res.status(404).json({ error: "Alert not found" }); return; }
      res.json({ success: true, id: req.params.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/alerts/recovery-history", (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      res.json(getRecoveryHistory(limit));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/alerts/watchdog", (_req, res) => {
    try {
      res.json(getWatchdogStatus());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/alerts/llm-providers", (_req, res) => {
    try {
      const circuitBreaker = getCircuitBreakerSummary();
      const providerHealth = getProviderHealth();
      const providerPredictions = getProviderPredictions();
      res.json({ circuitBreaker, providerHealth, providerPredictions });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/alerts/test", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const { severity = "warning", component = "TestSystem", title = "Test Alert", message = "This is a test alert." } = req.body || {};
      const alert = emitAlert({ severity, component, title, message, forceEmit: true });
      res.json({ success: true, alert });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
