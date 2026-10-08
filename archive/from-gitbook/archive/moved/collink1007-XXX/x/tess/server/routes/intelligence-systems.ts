/**
 * Intelligence Systems Routes
 * Exposes API endpoints for the real implementations:
 * - Long-Term Memory Engine
 * - Codebase Understanding Engine (AST)
 * - Agent Personality Evolution
 */

import type { Express, Request, Response } from "express";
import {
  storeKnowledgeCrystal,
  storeConversationInsight,
  storeLearnedPattern,
  retrieveMemories,
  getMemoryStats,
  consolidateMemories,
} from "../long-term-memory-engine";
import {
  analyzeProjectStructure,
  analyzeSpecificFile,
  findFunctionDefinition,
  getDependencyChain,
  getImpactAnalysis,
  clearAnalysisCache,
} from "../codebase-understanding-engine";
import {
  loadOrCreatePersonality,
  recordPerformanceEvent,
  evolveAllAgents,
  getPersonalityReport,
  getAllPersonalityReports,
  getPersonalityEvolutionStats,
} from "../personality-evolution-engine";

export function registerIntelligenceSystemsRoutes(app: Express): void {
  console.log("[IntelligenceSystems] Registering intelligence system routes...");

  app.get("/api/memory/ltm/stats", async (_req: Request, res: Response) => {
    try {
      const stats = await getMemoryStats();
      res.json({ ...stats, dataSource: "database", status: "real" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/memory/ltm/retrieve", async (req: Request, res: Response) => {
    try {
      const { agentId = "tessera", query = "", limit = 10, types } = req.query as any;
      const typeArray = types ? types.split(",") : undefined;
      const result = await retrieveMemories({
        agentId,
        query,
        limit: parseInt(limit, 10),
        types: typeArray,
      });
      res.json({ ...result, dataSource: "database" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/memory/ltm/crystal", async (req: Request, res: Response) => {
    try {
      const { agentId, topic, insight, confidence, domain, sourceContext } = req.body || {};
      if (!agentId || !topic || !insight) {
        return res.status(400).json({ error: "agentId, topic, insight required" });
      }
      const crystal = await storeKnowledgeCrystal({ agentId, topic, insight, confidence, domain, sourceContext });
      res.json({ crystal, stored: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/memory/ltm/insight", async (req: Request, res: Response) => {
    try {
      const { agentId, sessionId, summary, keyPoints, sentiment, importance, topics } = req.body || {};
      if (!agentId || !summary) {
        return res.status(400).json({ error: "agentId, summary required" });
      }
      const insight = await storeConversationInsight({
        agentId, sessionId: sessionId || `sess-${Date.now()}`,
        summary, keyPoints, sentiment, importance, topics,
      });
      res.json({ insight, stored: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/memory/ltm/pattern", async (req: Request, res: Response) => {
    try {
      const { agentId, pattern, domain, example, successRate } = req.body || {};
      if (!agentId || !pattern || !domain) {
        return res.status(400).json({ error: "agentId, pattern, domain required" });
      }
      const lp = await storeLearnedPattern({ agentId, pattern, domain, example, successRate });
      res.json({ pattern: lp, stored: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/memory/ltm/consolidate", async (req: Request, res: Response) => {
    try {
      const { agentId = "tessera" } = req.body || {};
      const result = await consolidateMemories(agentId);
      res.json({ ...result, agentId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/codebase/structure", (_req: Request, res: Response) => {
    try {
      const structure = analyzeProjectStructure({ maxFiles: 80 });
      res.json({
        totalFiles: structure.totalFiles,
        totalFunctions: structure.totalFunctions,
        totalClasses: structure.totalClasses,
        totalLines: structure.totalLines,
        topImports: structure.topImports,
        mostComplexFiles: structure.mostComplexFiles,
        analyzedAt: structure.analyzedAt,
        dataSource: "typescript-ast",
        status: "real",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/codebase/file", (req: Request, res: Response) => {
    try {
      const { path: filePath } = req.query as any;
      if (!filePath || typeof filePath !== "string") return res.status(400).json({ error: "path required" });
      const normalized = filePath.replace(/\\/g, "/");
      const allowedPrefixes = ["server/", "shared/", "src/", "lib/"];
      const isAllowed = allowedPrefixes.some(p => normalized.startsWith(p));
      if (!isAllowed || normalized.includes("..")) {
        return res.status(403).json({ error: "Path not in allowed scope (server/, shared/, src/, lib/)" });
      }
      const analysis = analyzeSpecificFile(normalized);
      if (!analysis) return res.status(404).json({ error: "File not found" });
      res.json({ ...analysis, dataSource: "typescript-ast", status: "real" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/codebase/find-function", (req: Request, res: Response) => {
    try {
      const { name } = req.query as any;
      if (!name) return res.status(400).json({ error: "name required" });
      const results = findFunctionDefinition(name);
      res.json({ results, count: results.length, dataSource: "typescript-ast" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/codebase/dependencies", (req: Request, res: Response) => {
    try {
      const { path: filePath, depth = "3" } = req.query as any;
      if (!filePath || typeof filePath !== "string") return res.status(400).json({ error: "path required" });
      const normalized = filePath.replace(/\\/g, "/");
      if (normalized.includes("..")) return res.status(403).json({ error: "Path traversal not allowed" });
      const chain = getDependencyChain(normalized, parseInt(depth, 10));
      res.json({ chain, depth: parseInt(depth, 10), dataSource: "typescript-ast" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/codebase/impact", (req: Request, res: Response) => {
    try {
      const { path: filePath } = req.query as any;
      if (!filePath || typeof filePath !== "string") return res.status(400).json({ error: "path required" });
      const normalized = filePath.replace(/\\/g, "/");
      if (normalized.includes("..")) return res.status(403).json({ error: "Path traversal not allowed" });
      const impact = getImpactAnalysis(normalized);
      res.json({ ...impact, path: normalized, dataSource: "typescript-ast" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/codebase/refresh", (_req: Request, res: Response) => {
    try {
      clearAnalysisCache();
      const structure = analyzeProjectStructure({ forceRefresh: true });
      res.json({
        message: "Analysis cache refreshed",
        totalFiles: structure.totalFiles,
        totalFunctions: structure.totalFunctions,
        totalClasses: structure.totalClasses,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/personality/stats", async (_req: Request, res: Response) => {
    try {
      const stats = await getPersonalityEvolutionStats();
      res.json({ ...stats, dataSource: "database", status: "real" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/personality/agent/:agentId", async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const report = await getPersonalityReport(agentId);
      if (!report) return res.status(404).json({ error: "Agent not found" });
      res.json({ ...report, dataSource: "database", status: "real" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/personality/all", async (_req: Request, res: Response) => {
    try {
      const reports = await getAllPersonalityReports();
      res.json({ agents: reports, count: reports.length, dataSource: "database" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/personality/record-event", async (req: Request, res: Response) => {
    try {
      const { agentId, agentName, eventType, domain, score, context } = req.body || {};
      if (!agentId || !agentName || !eventType) {
        return res.status(400).json({ error: "agentId, agentName, eventType required" });
      }
      await recordPerformanceEvent({
        agentId, agentName, eventType, domain: domain || "general",
        score: score ?? 0.7, context: context || "", timestamp: Date.now(),
      });
      res.json({ recorded: true, agentId, eventType });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/personality/evolve", async (req: Request, res: Response) => {
    try {
      const { agents } = req.body || {};
      const agentList = agents || [
        { agentId: "tessera", agentName: "Tessera" },
        { agentId: "alpha", agentName: "Alpha" },
        { agentId: "beta", agentName: "Beta" },
        { agentId: "gamma", agentName: "Gamma" },
        { agentId: "delta", agentName: "Delta" },
      ];
      const result = await evolveAllAgents(agentList);
      res.json({ ...result, dataSource: "database" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[IntelligenceSystems] Routes registered:");
  console.log("[IntelligenceSystems]   /api/memory/ltm/* (Long-Term Memory Engine)");
  console.log("[IntelligenceSystems]   /api/codebase/* (Codebase Understanding Engine)");
  console.log("[IntelligenceSystems]   /api/personality/* (Agent Personality Evolution)");
}
