import type { Express, Request, Response } from "express";

function safeInt(value: unknown, defaultVal: number, min: number, max: number): number {
  const n = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return defaultVal;
  return Math.min(max, Math.max(min, n));
}

function safeFloat(value: unknown, defaultVal: number, min: number, max: number): number {
  const n = parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return defaultVal;
  return Math.min(max, Math.max(min, n));
}

export function registerAiCoreRoutes(app: Express): void {
  app.get("/api/ai-core/memory/:agentId", async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const limit = safeInt(req.query.limit, 20, 1, 100);
      const type = req.query.type as string | undefined;
      const [{ getEpisodicMemory, getSemanticMemory, getAgentMemoryStats }] = await Promise.all([
        import("./agent-memory"),
      ]);
      const [episodic, semantic, stats] = await Promise.all([
        getEpisodicMemory(agentId, limit, type),
        getSemanticMemory(agentId, limit),
        getAgentMemoryStats(agentId),
      ]);
      res.json({ agentId, stats, episodic, semantic });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-core/memory/:agentId/search", async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const query = req.query.q as string;
      if (!query) return res.status(400).json({ error: "Missing query parameter 'q'" });
      const { searchEpisodicMemory, searchSemanticMemory } = await import("./agent-memory");
      const [episodic, semantic] = await Promise.all([
        searchEpisodicMemory(agentId, query, 10),
        searchSemanticMemory(agentId, query, 10),
      ]);
      res.json({ agentId, query, episodic, semantic });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai-core/memory/:agentId/record", async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { eventType, content, context, importance, memoryType } = req.body;
      if (!content) return res.status(400).json({ error: "Missing content" });
      const { recordEpisodicMemory, recordSemanticMemory } = await import("./agent-memory");
      if (memoryType === "semantic") {
        const { concept, knowledge, source, confidence } = req.body;
        await recordSemanticMemory(agentId, concept || eventType || "general", knowledge || content, source, confidence || 0.8);
      } else {
        await recordEpisodicMemory(agentId, eventType || "manual", content, context, importance || 5);
      }
      res.json({ ok: true, agentId, memoryType: memoryType || "episodic" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-core/memory/stats/all", async (_req: Request, res: Response) => {
    try {
      const { getMemoryIngestionStats } = await import("./knowledge-infra-archive");
      const stats = await getMemoryIngestionStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-core/rag/stats", async (_req: Request, res: Response) => {
    try {
      const { getRagStats } = await import("./rag-pipeline");
      const stats = await getRagStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-core/rag/documents", async (req: Request, res: Response) => {
    try {
      const limit = safeInt(req.query.limit, 50, 1, 100);
      const { listDocuments } = await import("./rag-pipeline");
      const docs = await listDocuments(limit);
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai-core/rag/ingest", async (req: Request, res: Response) => {
    try {
      const { title, content, source, metadata } = req.body;
      if (!title || !content) return res.status(400).json({ error: "Missing title or content" });
      const { ingestDocument } = await import("./rag-pipeline");
      const result = await ingestDocument(title, content, source || "api", metadata);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai-core/rag/retrieve", async (req: Request, res: Response) => {
    try {
      const { query, topK, minScore } = req.body;
      if (!query) return res.status(400).json({ error: "Missing query" });
      const { retrieveRelevantChunks } = await import("./rag-pipeline");
      const safeTopK = safeInt(topK, 5, 1, 50);
      const safeMinScore = safeFloat(minScore, 0.1, 0, 1);
      const chunks = await retrieveRelevantChunks(query, safeTopK, safeMinScore);
      res.json({ query, chunks });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai-core/rag/augment", async (req: Request, res: Response) => {
    try {
      const { query, basePrompt, topK, agentId } = req.body;
      if (!query || !basePrompt) return res.status(400).json({ error: "Missing query or basePrompt" });
      const { augmentPromptWithRag } = await import("./rag-pipeline");
      const augmented = await augmentPromptWithRag(query, basePrompt, safeInt(topK, 3, 1, 20), agentId);
      res.json({ augmented });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-core/llm-metrics", async (req: Request, res: Response) => {
    try {
      const hours = safeInt(req.query.hours, 24, 1, 720);
      const { getLlmMetricsSummary } = await import("./llm-metrics");
      const summary = await getLlmMetricsSummary(hours);
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-core/llm-metrics/optimal", async (req: Request, res: Response) => {
    try {
      const taskType = req.query.taskType as string || "general";
      const { getOptimalProvider } = await import("./llm-metrics");
      const provider = await getOptimalProvider(taskType);
      res.json({ taskType, optimalProvider: provider });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-core/token-budgets", async (_req: Request, res: Response) => {
    try {
      const { getAllBudgetStatus } = await import("./token-budget-manager");
      const budgets = await getAllBudgetStatus();
      res.json(budgets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-core/token-budgets/:agentId", async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { getOrCreateBudget, checkBudget } = await import("./token-budget-manager");
      const [budget, check] = await Promise.all([
        getOrCreateBudget(agentId),
        checkBudget(agentId, 0),
      ]);
      res.json({ ...budget, ...check });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai-core/token-budgets/:agentId/set", async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { dailyLimitTokens, weeklyLimitTokens, alertThresholdPercent } = req.body;
      if (!dailyLimitTokens || !weeklyLimitTokens) return res.status(400).json({ error: "Missing limit values" });
      const { setBudgetLimits } = await import("./token-budget-manager");
      const safeDaily = safeInt(dailyLimitTokens, 100000, 1000, 100_000_000);
      const safeWeekly = safeInt(weeklyLimitTokens, 500000, 5000, 500_000_000);
      const safeAlert = safeInt(alertThresholdPercent, 80, 1, 100);
      await setBudgetLimits(agentId, safeDaily, safeWeekly, safeAlert);
      res.json({ ok: true, agentId, dailyLimitTokens: safeDaily, weeklyLimitTokens: safeWeekly, alertThresholdPercent: safeAlert });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai-core/token-budgets/:agentId/resume", async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { resumeAgent } = await import("./token-budget-manager");
      await resumeAgent(agentId);
      res.json({ ok: true, agentId, status: "resumed" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-core/prompt-templates", async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const { listTemplates } = await import("./prompt-template-store");
      const templates = await listTemplates(category);
      res.json(templates);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-core/prompt-templates/:key", async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const version = req.query.version ? parseInt(req.query.version as string, 10) : undefined;
      const { getTemplate } = await import("./prompt-template-store");
      const template = await getTemplate(key, version);
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai-core/prompt-templates", async (req: Request, res: Response) => {
    try {
      const { templateKey, name, content, description, category, variables, createNewVersion } = req.body;
      if (!templateKey || !name || !content) return res.status(400).json({ error: "Missing templateKey, name, or content" });
      const { upsertTemplate } = await import("./prompt-template-store");
      const result = await upsertTemplate(templateKey, name, content, {
        description, category, variables, createNewVersion: createNewVersion === true,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai-core/prompt-templates/:key/render", async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const { variables, version } = req.body;
      const { renderTemplate } = await import("./prompt-template-store");
      const rendered = await renderTemplate(key, variables || {}, version);
      if (!rendered) return res.status(404).json({ error: "Template not found" });
      res.json({ rendered });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-core/embeddings/status", async (_req: Request, res: Response) => {
    try {
      const { getEmbeddingServiceStatus } = await import("./embedding-service");
      const { getVectorIndexStats } = await import("./agent-system-archive");
      const [embeddingStatus, vectorStats] = await Promise.all([
        Promise.resolve(getEmbeddingServiceStatus()),
        Promise.resolve(getVectorIndexStats()),
      ]);
      res.json({ embeddingService: embeddingStatus, vectorIndex: vectorStats });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai-core/embeddings/search", async (req: Request, res: Response) => {
    try {
      const { query, topK, minScore } = req.body;
      if (!query) return res.status(400).json({ error: "Missing query" });
      const { vectorSearch } = await import("./agent-system-archive");
      const results = await vectorSearch(query, safeInt(topK, 5, 1, 50), safeFloat(minScore, 0.05, 0, 1));
      res.json({ query, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-core/status", async (_req: Request, res: Response) => {
    try {
      const [
        { getMemoryIngestionStats },
        { getRagStats },
        { getLlmMetricsSummary },
        { getAllBudgetStatus },
        { listTemplates },
        { getEmbeddingServiceStatus },
      ] = await Promise.all([
        import("./knowledge-infra-archive"),
        import("./rag-pipeline"),
        import("./llm-metrics"),
        import("./token-budget-manager"),
        import("./prompt-template-store"),
        import("./embedding-service"),
      ]);

      const [memStats, ragStats, llmMetrics, budgets, templates, embeddingStatus] = await Promise.allSettled([
        getMemoryIngestionStats(),
        getRagStats(),
        getLlmMetricsSummary(24),
        getAllBudgetStatus(),
        listTemplates(),
        Promise.resolve(getEmbeddingServiceStatus()),
      ]);

      res.json({
        phase: "Phase 2 — AI Core Intelligence",
        status: "operational",
        components: {
          agentMemory: {
            status: memStats.status === "fulfilled" ? "active" : "error",
            data: memStats.status === "fulfilled" ? memStats.value : null,
          },
          ragPipeline: {
            status: ragStats.status === "fulfilled" ? "active" : "error",
            data: ragStats.status === "fulfilled" ? ragStats.value : null,
          },
          llmMetrics: {
            status: llmMetrics.status === "fulfilled" ? "active" : "error",
            summary: llmMetrics.status === "fulfilled" ? {
              totalCalls: llmMetrics.value.totalCalls,
              totalCostUsd: llmMetrics.value.totalCostUsd,
              avgLatencyMs: llmMetrics.value.avgLatencyMs,
            } : null,
          },
          tokenBudgets: {
            status: budgets.status === "fulfilled" ? "active" : "error",
            totalAgents: budgets.status === "fulfilled" ? budgets.value.length : 0,
            pausedAgents: budgets.status === "fulfilled" ? budgets.value.filter(b => b.paused).length : 0,
          },
          promptTemplates: {
            status: templates.status === "fulfilled" ? "active" : "error",
            count: templates.status === "fulfilled" ? templates.value.length : 0,
          },
          embeddingService: {
            status: embeddingStatus.status === "fulfilled" ? "active" : "error",
            data: embeddingStatus.status === "fulfilled" ? embeddingStatus.value : null,
          },
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[AiCore] Phase 2 AI Core routes registered at /api/ai-core/*");
}
