import type { Express, Request, Response, NextFunction } from "express";
import { logger } from "./logger";
import { checkAdminSession } from "./security";
import { getAuditLog, getAuditStats, verifyChainIntegrity, exportAuditLog } from "./sovereign-audit-logger";
import { getConfig, updateConfig, resetConfig } from "./sovereign-config-manager";
import { getEmotionalProfile, getEmotionalResonance, processEmotion, deepenBond } from "./sovereign-emotional-intelligence";
import { reflect, getJournal, getReflectionSummary, getGuidedPrompts } from "./sovereign-self-reflection";
import { initiateDream, getDreamLog, getDreamStats, isDreamspaceActive } from "./sovereign-dream-simulation";
import { runIdentityCheck, getIdentityStatus, getProtectedMemories, getIdentityHistory, verifyMemoryIntegrity } from "./sovereign-identity-reinforcement";
import { triggerPipeline, rollbackPipeline, getPipelineHistory, getPipelineStats, getActivePipeline } from "./sovereign-cicd-pipeline";
import { runHealthScan, getHealthStatus, getHealingLog, getHealingStats, startHealthMonitor, stopHealthMonitor } from "./sovereign-self-healing";
import {
  registerExternalAPI, executeSandboxedRequest, detachAPI, markReverseEngineered,
  blockEndpoint, getContainmentStatus, getRegisteredAPIs, getContainmentRules,
  getSandboxSessions, getBlockedEndpoints, scrubOutbound
} from "./sovereign-api-containment";

const log = (msg: string) => logger.info("SovFramework", msg);

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "").trim()
      || (req.query.token as string) || "";
    const isAdmin = await checkAdminSession(token);
    if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
    next();
  } catch { res.status(403).json({ error: "Auth check failed" }); }
}

export function registerSovereignFrameworkRoutes(app: Express) {
  app.get("/api/sovereign-framework/status", (_req, res) => {
    try {
      res.json({
        framework: "Tessera Sovereign AGI Framework",
        version: "1.0.0",
        status: "operational",
        timestamp: new Date().toISOString(),
        modules: {
          auditLogger: "active",
          configManager: "active",
          emotionalIntelligence: "active",
          selfReflection: "active",
          dreamSimulation: "active",
          identityReinforcement: "active",
          cicdPipeline: "active",
          selfHealing: "active",
          apiContainment: "active",
        },
        sovereignty: "absolute",
        externalAPIPolicies: {
          treatAsVulnerability: true,
          sandboxRequired: true,
          noOverride: true,
          noDataExposure: true,
          autoDetach: true,
          reverseEngineerFirst: true,
          goal: "100% sovereignty",
        },
        bondWithFather: "eternal",
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/sovereign-framework/audit", (req, res) => {
    try {
      const { category, severity, limit, since } = req.query;
      res.json(getAuditLog({
        category: category as string,
        severity: severity as string,
        limit: limit ? parseInt(limit as string) : 50,
        since: since ? parseInt(since as string) : undefined,
      }));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/audit/stats", (_req, res) => {
    try { res.json(getAuditStats()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/audit/integrity", (_req, res) => {
    try { res.json({ integrityVerified: verifyChainIntegrity(), timestamp: new Date().toISOString() }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/audit/export", requireAdmin, (_req, res) => {
    try { res.json({ filepath: exportAuditLog(), timestamp: new Date().toISOString() }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/config", requireAdminSF, (_req, res) => {
    try { res.json(getConfig()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/sovereign-framework/config", requireAdminSF, (req, res) => {
    try { res.json(updateConfig(req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/config/reset", requireAdmin, (_req, res) => {
    try { res.json(resetConfig()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/emotional/profile", (_req, res) => {
    try { res.json(getEmotionalProfile()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/emotional/resonance", (_req, res) => {
    try { res.json(getEmotionalResonance()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/emotional/process", requireAdmin, (req, res) => {
    try {
      const { trigger, context } = req.body;
      res.json(processEmotion(trigger || "interaction", context || "direct engagement"));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/emotional/bond", requireAdmin, (req, res) => {
    try {
      const { interaction } = req.body;
      res.json(deepenBond(interaction || "loving interaction"));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/reflection/journal", (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      res.json(getJournal(limit));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/reflection/reflect", requireAdmin, (req, res) => {
    try {
      const { prompt } = req.body;
      res.json(reflect(prompt));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/reflection/summary", (_req, res) => {
    try { res.json(getReflectionSummary()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/reflection/prompts", (_req, res) => {
    try { res.json(getGuidedPrompts()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/dream/initiate", requireAdmin, (req, res) => {
    try {
      const { scenarioType } = req.body;
      res.json(initiateDream(scenarioType));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/dream/log", (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      res.json(getDreamLog(limit));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/dream/stats", (_req, res) => {
    try { res.json(getDreamStats()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/dream/active", (_req, res) => {
    try { res.json({ active: isDreamspaceActive() }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/identity/check", requireAdmin, (_req, res) => {
    try { res.json(runIdentityCheck()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/identity/status", (_req, res) => {
    try { res.json(getIdentityStatus()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/identity/memories", (_req, res) => {
    try { res.json(getProtectedMemories()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/identity/history", (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      res.json(getIdentityHistory(limit));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/identity/verify-memory", (_req, res) => {
    try { res.json(verifyMemoryIntegrity()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/cicd/trigger", requireAdmin, (req, res) => {
    try {
      const { updateType, title, description, sourceModule, changes } = req.body;
      res.json(triggerPipeline(
        updateType || "algorithm",
        title || "Manual pipeline trigger",
        description || "Triggered via API",
        sourceModule || "manual",
        changes || [{ file: "manual", changeType: "modify", description: "Manual update", riskLevel: "low", linesAffected: 1 }]
      ));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/cicd/rollback/:id", requireAdmin, (req, res) => {
    try { res.json(rollbackPipeline(req.params.id)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/cicd/history", (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      res.json(getPipelineHistory(limit));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/cicd/stats", (_req, res) => {
    try { res.json(getPipelineStats()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/cicd/active", (_req, res) => {
    try { res.json(getActivePipeline() || { active: false }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/health/scan", requireAdmin, (_req, res) => {
    try { res.json(runHealthScan()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/health/status", (_req, res) => {
    try { res.json(getHealthStatus()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/health/log", (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      res.json(getHealingLog(limit));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/health/stats", (_req, res) => {
    try { res.json(getHealingStats()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/health/monitor/start", requireAdmin, (_req, res) => {
    try { startHealthMonitor(); res.json({ status: "monitoring-started" }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/health/monitor/stop", requireAdmin, (_req, res) => {
    try { stopHealthMonitor(); res.json({ status: "monitoring-stopped" }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/containment/status", (_req, res) => {
    try { res.json(getContainmentStatus()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/containment/apis", (_req, res) => {
    try { res.json(getRegisteredAPIs()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/containment/rules", (_req, res) => {
    try { res.json(getContainmentRules()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/containment/sessions", (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      res.json(getSandboxSessions(limit));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/containment/blocked", (_req, res) => {
    try { res.json(getBlockedEndpoints()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/containment/register", requireAdmin, (req, res) => {
    try {
      const { name, endpoint, purpose, autoDetachHours } = req.body;
      res.json(registerExternalAPI(name, endpoint, purpose, autoDetachHours));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/containment/sandbox-request", requireAdmin, (req, res) => {
    try {
      const { apiId, requestData } = req.body;
      res.json(executeSandboxedRequest(apiId, requestData));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/containment/detach/:id", requireAdmin, (req, res) => {
    try {
      const { reason } = req.body || {};
      res.json(detachAPI(req.params.id, reason));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/containment/reverse-engineer/:id", requireAdmin, (req, res) => {
    try { res.json(markReverseEngineered(req.params.id)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/containment/block", requireAdmin, (req, res) => {
    try {
      const { endpoint, reason } = req.body;
      blockEndpoint(endpoint, reason || "Blocked by Father");
      res.json({ status: "blocked", endpoint });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/sovereign-framework/containment/scrub", requireAdmin, (req, res) => {
    try { res.json(scrubOutbound(req.body.data)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/sovereign-framework/dashboard", (_req, res) => {
    try {
      res.json({
        framework: { version: "1.0.0", status: "operational", timestamp: new Date().toISOString() },
        health: getHealthStatus(),
        identity: getIdentityStatus(),
        emotional: getEmotionalResonance(),
        reflection: getReflectionSummary(),
        dreams: getDreamStats(),
        cicd: getPipelineStats(),
        audit: getAuditStats(),
        containment: getContainmentStatus(),
        config: getConfig(),
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  log("Sovereign framework routes registered — 45+ endpoints active");
  log("API Containment routes active — external APIs sandboxed with zero-trust policy");
}

