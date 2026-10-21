import { Router, Request, Response } from "express";
import { loadOrchestratorConfig, getFreeProviders, getPaidProviders, getProvidersByStrength, getDataSourcesByDomain, reloadConfig } from "./orchestrator-config";
import { getRecentInteractions, getProviderStats, getTopProviders, getReverseEngineeringReport } from "./provider-interaction-logger";
import { buildSpecializedContext, identifyDomains, getDomainList, getBridgeList } from "./knowledge-specialization";
import { getIngestionStats, getRecentIngested, getIngestedByDomain, runIngestionCycle, startScheduler } from "./data-source-ingestion";
import { getSandboxStats } from "./orchestrator-sandbox";
import { enhancedScrape, enhancedSearch, getScraperStats } from "./enhanced-scraper";
import { resolveAndCheckSSRF } from "./ssrf-guard";
import { runProbeSuite, getCapabilityProfile, getAllCapabilityProfiles, diffProviders, getProbeHistory, getReverseEngineeringSummary } from "./provider-reverse-engineering";
import { evaluateSovereignty, setDisconnectMode, setDisconnectThreshold, getDisconnectMode, getSovereigntyHistory } from "./sovereignty-monitor";
import type { DisconnectMode } from "./sovereignty-monitor";
import { enqueueJob, getQueueStats, getJobStatus, getRecentJobs, getCacheStats } from "./speed-protocol";
import type { JobType, JobPriority } from "./speed-protocol";
import { detectHallucination, crossProviderVerify, recordVerification, getVerificationStats, getRecentVerifications } from "./truthfulness-engine";

const log = (m: string) => console.log(`[OrchestratorRoutes] ${m}`);

export function createOrchestratorRouter(): Router {
  const router = Router();

  router.get("/status", (_req: Request, res: Response) => {
    try {
      const config = loadOrchestratorConfig();
      const sandboxStats = getSandboxStats();
      const ingestionStats = getIngestionStats();
      const scraperStats = getScraperStats();

      res.json({
        status: "operational",
        version: config.version,
        name: config.name,
        providers: {
          total: config.providers.length,
          free: config.freeProviders.length,
          paid: config.paidProviders.length,
        },
        dataSources: config.dataSources.length,
        domainRateLimits: config.domainRateLimits.size,
        userAgents: config.userAgents.length,
        sandbox: sandboxStats,
        ingestion: ingestionStats,
        scraper: scraperStats,
        timestamp: Date.now(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.get("/providers", (req: Request, res: Response) => {
    try {
      const tier = req.query.tier as string | undefined;
      const strength = req.query.strength as string | undefined;

      if (strength) {
        res.json({ providers: getProvidersByStrength(strength) });
        return;
      }
      if (tier === "free") {
        res.json({ providers: getFreeProviders() });
        return;
      }
      if (tier === "paid") {
        res.json({ providers: getPaidProviders() });
        return;
      }

      const config = loadOrchestratorConfig();
      res.json({
        total: config.providers.length,
        free: config.freeProviders.length,
        paid: config.paidProviders.length,
        providers: config.providers.map(p => ({
          id: p.id,
          name: p.name,
          model: p.model,
          format: p.format,
          tier: p.tier,
          strengths: p.strengths,
          maxTokens: p.maxTokens,
        })),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.get("/data-sources", (req: Request, res: Response) => {
    try {
      const domain = req.query.domain as string | undefined;
      if (domain) {
        res.json({ sources: getDataSourcesByDomain(domain) });
        return;
      }
      const config = loadOrchestratorConfig();
      res.json({ total: config.dataSources.length, sources: config.dataSources });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.get("/knowledge/domains", (_req: Request, res: Response) => {
    res.json({ domains: getDomainList(), bridges: getBridgeList() });
  });

  router.post("/knowledge/specialize", (req: Request, res: Response) => {
    try {
      const query = typeof req.body?.query === "string" ? req.body.query : "";
      if (!query) {
        res.status(400).json({ error: "query is required" });
        return;
      }
      const context = buildSpecializedContext(query);
      res.json(context);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.get("/knowledge/identify", (req: Request, res: Response) => {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    if (!query) {
      res.status(400).json({ error: "q parameter is required" });
      return;
    }
    res.json({ query, domains: identifyDomains(query) });
  });

  router.get("/interactions", (req: Request, res: Response) => {
    const limit = Math.min(parseInt(String(req.query.limit || "50"), 10), 200);
    res.json({ interactions: getRecentInteractions(limit) });
  });

  router.get("/interactions/stats", (req: Request, res: Response) => {
    const providerId = req.query.provider as string | undefined;
    res.json({ stats: getProviderStats(providerId) });
  });

  router.get("/interactions/top", (req: Request, res: Response) => {
    const metric = (req.query.metric as "quality" | "speed" | "reliability") || "quality";
    const limit = Math.min(parseInt(String(req.query.limit || "10"), 10), 50);
    res.json({ metric, top: getTopProviders(metric, limit) });
  });

  router.get("/interactions/report", (_req: Request, res: Response) => {
    res.json(getReverseEngineeringReport());
  });

  router.get("/ingestion/stats", (_req: Request, res: Response) => {
    res.json(getIngestionStats());
  });

  router.get("/ingestion/recent", (req: Request, res: Response) => {
    const limit = Math.min(parseInt(String(req.query.limit || "50"), 10), 200);
    res.json({ items: getRecentIngested(limit) });
  });

  router.get("/ingestion/domain/:domain", (req: Request, res: Response) => {
    const domain = req.params.domain;
    const limit = Math.min(parseInt(String(req.query.limit || "20"), 10), 100);
    res.json({ domain, items: getIngestedByDomain(domain, limit) });
  });

  router.post("/ingestion/trigger", async (_req: Request, res: Response) => {
    try {
      const result = await runIngestionCycle();
      res.json({ status: "completed", ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.get("/sandbox/stats", (_req: Request, res: Response) => {
    res.json(getSandboxStats());
  });

  router.post("/scrape", async (req: Request, res: Response) => {
    try {
      const url = typeof req.body?.url === "string" ? req.body.url : "";
      if (!url) {
        res.status(400).json({ error: "url is required" });
        return;
      }

      try {
        const parsed = new URL(url);
        const ssrfCheck = await resolveAndCheckSSRF(parsed.hostname);
        if (!ssrfCheck.safe) {
          res.status(403).json({ error: `SSRF blocked: ${parsed.hostname}` });
          return;
        }
      } catch (parseErr: unknown) {
        const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
        res.status(400).json({ error: `Invalid URL: ${message}` });
        return;
      }

      const result = await enhancedScrape(url);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.post("/search", async (req: Request, res: Response) => {
    try {
      const query = typeof req.body?.query === "string" ? req.body.query : "";
      if (!query) {
        res.status(400).json({ error: "query is required" });
        return;
      }
      const results = await enhancedSearch(query);
      res.json({ query, results });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.post("/reverse-engineer/probe/:providerId", async (req: Request, res: Response) => {
    try {
      const providerId = req.params.providerId;
      const results = await runProbeSuite(providerId);
      res.json({ providerId, probeCount: results.length, results });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.get("/reverse-engineer/profile/:providerId", (req: Request, res: Response) => {
    const profile = getCapabilityProfile(req.params.providerId);
    if (!profile) {
      res.status(404).json({ error: "No profile found — run probe suite first" });
      return;
    }
    res.json(profile);
  });

  router.get("/reverse-engineer/profiles", (_req: Request, res: Response) => {
    res.json({ profiles: getAllCapabilityProfiles() });
  });

  router.get("/reverse-engineer/diff", (req: Request, res: Response) => {
    const a = req.query.a as string;
    const b = req.query.b as string;
    if (!a || !b) {
      res.status(400).json({ error: "Query params 'a' and 'b' (provider IDs) required" });
      return;
    }
    const diff = diffProviders(a, b);
    if (!diff) {
      res.status(404).json({ error: "Both providers must be probed first" });
      return;
    }
    res.json(diff);
  });

  router.get("/reverse-engineer/history", (req: Request, res: Response) => {
    const providerId = req.query.provider as string | undefined;
    const limit = Math.min(parseInt(String(req.query.limit || "50"), 10), 200);
    res.json({ history: getProbeHistory(providerId, limit) });
  });

  router.get("/reverse-engineer/summary", (_req: Request, res: Response) => {
    res.json(getReverseEngineeringSummary());
  });

  router.get("/sovereignty", (_req: Request, res: Response) => {
    res.json(evaluateSovereignty());
  });

  router.get("/sovereignty/history", (req: Request, res: Response) => {
    const minutes = Math.min(parseInt(String(req.query.minutes || "60"), 10), 1440);
    res.json({ history: getSovereigntyHistory(minutes) });
  });

  router.post("/sovereignty/mode", (req: Request, res: Response) => {
    const mode = req.body?.mode as DisconnectMode;
    if (!["normal", "dry-run", "hard-disconnect"].includes(mode)) {
      res.status(400).json({ error: "mode must be 'normal', 'dry-run', or 'hard-disconnect'" });
      return;
    }
    setDisconnectMode(mode);
    res.json({ status: "updated", mode });
  });

  router.post("/sovereignty/threshold", (req: Request, res: Response) => {
    const threshold = parseFloat(req.body?.threshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      res.status(400).json({ error: "threshold must be a number between 0 and 1" });
      return;
    }
    setDisconnectThreshold(threshold);
    res.json({ status: "updated", threshold, mode: getDisconnectMode() });
  });

  router.post("/config/reload", (_req: Request, res: Response) => {
    try {
      const config = reloadConfig();
      res.json({
        status: "reloaded",
        providers: config.providers.length,
        dataSources: config.dataSources.length,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.post("/speed/enqueue", (req: Request, res: Response) => {
    const { type, payload, priority, maxRetries } = req.body || {};
    const validTypes: JobType[] = ["ingestion", "training", "evaluation", "probe", "synthesis", "scrape"];
    const validPriorities: JobPriority[] = ["critical", "high", "medium", "low"];
    if (!type || !validTypes.includes(type)) {
      res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
      return;
    }
    if (priority && !validPriorities.includes(priority)) {
      res.status(400).json({ error: `priority must be one of: ${validPriorities.join(", ")}` });
      return;
    }
    try {
      const jobId = enqueueJob(type, payload || {}, priority || "medium", maxRetries ?? 2);
      res.json({ status: "enqueued", jobId, type, priority: priority || "medium" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(429).json({ error: message });
    }
  });

  router.get("/speed/stats", (_req: Request, res: Response) => {
    res.json(getQueueStats());
  });

  router.get("/speed/job/:id", (req: Request, res: Response) => {
    const job = getJobStatus(req.params.id);
    if (!job) { res.status(404).json({ error: "job not found" }); return; }
    res.json(job);
  });

  router.get("/speed/recent", (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json(getRecentJobs(limit));
  });

  router.get("/speed/cache", (_req: Request, res: Response) => {
    res.json(getCacheStats());
  });

  router.post("/truthfulness/hallucination-check", (req: Request, res: Response) => {
    const { text } = req.body || {};
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text is required" });
      return;
    }
    res.json(detectHallucination(text));
  });

  router.post("/truthfulness/cross-verify", (req: Request, res: Response) => {
    const { query, responses } = req.body || {};
    if (!query || !Array.isArray(responses) || responses.length < 2) {
      res.status(400).json({ error: "query and responses[] (≥2) required" });
      return;
    }
    for (const r of responses) {
      if (!r || typeof r.providerId !== "string" || typeof r.response !== "string") {
        res.status(400).json({ error: "each response must have providerId (string) and response (string)" });
        return;
      }
    }
    const result = crossProviderVerify(query, responses);
    recordVerification(result);
    res.json(result);
  });

  router.get("/truthfulness/stats", (_req: Request, res: Response) => {
    res.json(getVerificationStats());
  });

  router.get("/truthfulness/recent", (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 20;
    res.json(getRecentVerifications(limit));
  });

  startScheduler();
  log("Registered under /api/orchestrator");

  return router;
}
