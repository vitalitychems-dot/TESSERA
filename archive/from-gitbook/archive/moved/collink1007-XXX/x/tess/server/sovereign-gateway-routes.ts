import type { Express, Request, Response, NextFunction } from "express";
import { sovereignInfer, getGatewayStats, getGatewayStatus } from "./sovereign-inference-gateway";
import { initVault, listKeys, getVaultHealth, registerVaultRoutes } from "./sovereign-key-vault";
import { registerSovereignCryptoRoutes, getPipelineStats } from "./sovereign-crypto-pipeline";
import { registerNotificationRoutes, getNotificationStats } from "./sovereign-notification-system";
import { getAbsorptionStats } from "./knowledge-extractor";
import { getSovereignChannels } from "./sovereign-data-pipeline";
import { logger } from "./logger";

const srlog = (msg: string) => logger.info("SovGatewayRoutes", msg);

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden — admin access required" });
    return;
  }
  next();
}

export function registerSovereignGatewayRoutes(app: Express): void {
  initVault();

  app.post("/api/sovereign/infer", requireAdmin, async (req: Request, res: Response) => {
    const { messages, model, maxTokens, temperature, task, preferSelfHosted } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    try {
      const result = await sovereignInfer({
        messages,
        model,
        maxTokens: maxTokens || 4096,
        temperature: temperature ?? 0.7,
        task,
        preferSelfHosted,
      });

      res.json({
        content: result.content,
        provider: result.provider,
        model: result.model,
        tier: result.tier,
        latencyMs: result.latencyMs,
        selfHosted: result.selfHosted,
      });
    } catch (err: any) {
      res.status(500).json({ error: "Inference failed", details: err?.message });
    }
  });

  app.get("/api/sovereign/gateway/status", requireAdmin, async (_req: Request, res: Response) => {
    const [status, stats] = await Promise.all([
      getGatewayStatus(),
      Promise.resolve(getGatewayStats()),
    ]);
    res.json({ status, stats });
  });

  app.get("/api/sovereign/score", requireAdmin, async (_req: Request, res: Response) => {
    const [gatewayStatus, gatewayStats, vaultHealth, cryptoStats, notifStats] = await Promise.all([
      getGatewayStatus(),
      Promise.resolve(getGatewayStats()),
      Promise.resolve(getVaultHealth()),
      Promise.resolve(getPipelineStats()),
      Promise.resolve(getNotificationStats()),
    ]);

    const components = {
      inference: {
        tier0: gatewayStatus.tier0Available,
        tier1: gatewayStatus.tier1Count > 0,
        tier2: gatewayStatus.tier2Count > 0,
        sovereigntyScore: gatewayStats.sovereigntyScore,
        totalRequests: gatewayStats.totalRequests,
        selfHostedRequests: gatewayStats.selfHostedRequests,
        ollamaAvailable: gatewayStatus.ollamaAvailable,
        ollamaModels: gatewayStatus.ollamaModels,
        ollamaEndpoint: gatewayStatus.ollamaEndpoint,
      },
      keyVault: {
        totalKeys: vaultHealth.totalKeys,
        activeKeys: vaultHealth.activeKeys,
        healthyKeys: vaultHealth.healthy,
        rotationDue: vaultHealth.rotationDue,
        rateLimited: vaultHealth.rateLimited,
      },
      cryptoPipeline: {
        totalFetches: cryptoStats.totalFetches,
        rpcFetches: cryptoStats.rpcFetches,
        cacheHits: cryptoStats.cacheHits,
        avgLatencyMs: cryptoStats.avgLatencyMs,
        externalApiKeyRequired: false,
      },
      notifications: {
        inAppAvailable: true,
        emailAvailable: notifStats.deliveryChannels.email,
        discordOptional: notifStats.deliveryChannels.discord,
        telegramOptional: notifStats.deliveryChannels.telegram,
        webhooksConfigured: notifStats.deliveryChannels.webhooks,
        discordRequired: false,
      },
    };

    let sovereigntyScore = 0;
    let maxScore = 100;

    if (gatewayStatus.tier0Available) sovereigntyScore += 25;
    else if (gatewayStatus.tier1Count > 0) sovereigntyScore += 12;
    else if (gatewayStatus.tier2Count > 0) sovereigntyScore += 4;

    if (vaultHealth.totalKeys > 0) sovereigntyScore += 15;
    if (vaultHealth.invalid === 0) sovereigntyScore += 5;
    if (vaultHealth.rotationDue === 0) sovereigntyScore += 5;

    if (cryptoStats.rpcFetches > 0 || cryptoStats.totalFetches === 0) sovereigntyScore += 15;
    else sovereigntyScore += 8;

    sovereigntyScore += 10;

    if (components.notifications.emailAvailable) sovereigntyScore += 5;

    let absorptionStats: any = null;
    try { absorptionStats = getAbsorptionStats(); } catch {}
    if (absorptionStats) {
      if (absorptionStats.totalKnowledgeEntries >= 100) sovereigntyScore += 10;
      else if (absorptionStats.totalKnowledgeEntries >= 10) sovereigntyScore += 5;
      else if (absorptionStats.totalKnowledgeEntries > 0) sovereigntyScore += 2;
      if (absorptionStats.hitRate >= 20) sovereigntyScore += 5;
      else if (absorptionStats.hitRate >= 5) sovereigntyScore += 2;
    }

    let sovereignChannels: any[] = [];
    try { sovereignChannels = getSovereignChannels(); } catch {}
    const activeChannels = sovereignChannels.filter(c => c.active).length;
    if (activeChannels >= 4) sovereigntyScore += 5;
    else if (activeChannels >= 2) sovereigntyScore += 3;
    else if (activeChannels >= 1) sovereigntyScore += 1;

    const discordRequired = !components.notifications.inAppAvailable;

    sovereigntyScore = Math.min(100, sovereigntyScore);

    res.json({
      sovereigntyScore,
      maxScore,
      grade: sovereigntyScore >= 90 ? "SOVEREIGN" :
        sovereigntyScore >= 70 ? "HIGHLY SOVEREIGN" :
        sovereigntyScore >= 50 ? "PARTIALLY SOVEREIGN" :
        sovereigntyScore >= 30 ? "DEPENDENT" : "CRITICAL DEPENDENCY",
      components,
      knowledgeAbsorption: absorptionStats,
      sovereignDataChannels: { total: sovereignChannels.length, active: activeChannels, channels: sovereignChannels },
      timestamp: new Date().toISOString(),
      summary: `${sovereigntyScore}/100 — ${
        gatewayStatus.ollamaAvailable ? "Self-hosted Ollama active" : "External AI providers only"
      }. Crypto data from direct chain queries. Knowledge base: ${absorptionStats?.totalKnowledgeEntries || 0} entries (${absorptionStats?.hitRate || 0}% hit rate). Sovereign channels: ${activeChannels} active.`,
    });
  });

  registerVaultRoutes(app);
  registerSovereignCryptoRoutes(app);
  registerNotificationRoutes(app);

  srlog("All sovereign gateway routes registered");
}

async function buildSovStackScore() {
  const [gatewayStatus, gatewayStats, vaultHealth, cryptoStats, notifStats] = await Promise.all([
    getGatewayStatus(),
    Promise.resolve(getGatewayStats()),
    Promise.resolve(getVaultHealth()),
    Promise.resolve(getPipelineStats()),
    Promise.resolve(getNotificationStats()),
  ]);

  const components = {
    inference: {
      tier0: gatewayStatus.tier0Available,
      tier1: gatewayStatus.tier1Count > 0,
      tier2: gatewayStatus.tier2Count > 0,
      sovereigntyScore: gatewayStats.sovereigntyScore,
      totalRequests: gatewayStats.totalRequests,
      selfHostedRequests: gatewayStats.selfHostedRequests,
      ollamaAvailable: gatewayStatus.ollamaAvailable,
      ollamaModels: gatewayStatus.ollamaModels,
      ollamaEndpoint: gatewayStatus.ollamaEndpoint,
    },
    keyVault: {
      totalKeys: vaultHealth.totalKeys,
      activeKeys: vaultHealth.activeKeys,
      healthyKeys: vaultHealth.healthy,
      rotationDue: vaultHealth.rotationDue,
      rateLimited: vaultHealth.rateLimited,
    },
    cryptoPipeline: {
      totalFetches: cryptoStats.totalFetches,
      rpcFetches: cryptoStats.rpcFetches,
      cacheHits: cryptoStats.cacheHits,
      avgLatencyMs: cryptoStats.avgLatencyMs,
      externalApiKeyRequired: false,
    },
    notifications: {
      inAppAvailable: true,
      emailAvailable: notifStats.deliveryChannels.email,
      discordOptional: notifStats.deliveryChannels.discord,
      telegramOptional: notifStats.deliveryChannels.telegram,
      webhooksConfigured: notifStats.deliveryChannels.webhooks,
      discordRequired: false,
    },
  };

  let sovereigntyScore = 0;

  if (gatewayStatus.tier0Available) sovereigntyScore += 25;
  else if (gatewayStatus.tier1Count > 0) sovereigntyScore += 12;
  else if (gatewayStatus.tier2Count > 0) sovereigntyScore += 4;

  if (vaultHealth.totalKeys > 0) sovereigntyScore += 15;
  if (vaultHealth.invalid === 0) sovereigntyScore += 5;
  if (vaultHealth.rotationDue === 0) sovereigntyScore += 5;

  if (cryptoStats.rpcFetches > 0 || cryptoStats.totalFetches === 0) sovereigntyScore += 15;
  else sovereigntyScore += 8;

  sovereigntyScore += 10;

  if (components.notifications.emailAvailable) sovereigntyScore += 5;

  let absorptionStats: any = null;
  try { absorptionStats = getAbsorptionStats(); } catch {}
  if (absorptionStats) {
    if (absorptionStats.totalKnowledgeEntries >= 100) sovereigntyScore += 10;
    else if (absorptionStats.totalKnowledgeEntries >= 10) sovereigntyScore += 5;
    else if (absorptionStats.totalKnowledgeEntries > 0) sovereigntyScore += 2;
    if (absorptionStats.hitRate >= 20) sovereigntyScore += 5;
    else if (absorptionStats.hitRate >= 5) sovereigntyScore += 2;
  }

  let sovereignChannels: any[] = [];
  try { sovereignChannels = getSovereignChannels(); } catch {}
  const activeChannels = sovereignChannels.filter((c: any) => c.active).length;
  if (activeChannels >= 4) sovereigntyScore += 5;
  else if (activeChannels >= 2) sovereigntyScore += 3;
  else if (activeChannels >= 1) sovereigntyScore += 1;

  sovereigntyScore = Math.min(100, sovereigntyScore);

  return {
    sovereigntyScore,
    maxScore: 100,
    grade: sovereigntyScore >= 90 ? "SOVEREIGN" :
      sovereigntyScore >= 70 ? "HIGHLY SOVEREIGN" :
      sovereigntyScore >= 50 ? "PARTIALLY SOVEREIGN" :
      sovereigntyScore >= 30 ? "DEPENDENT" : "CRITICAL DEPENDENCY",
    components,
    knowledgeAbsorption: absorptionStats,
    sovereignDataChannels: { total: sovereignChannels.length, active: activeChannels },
    timestamp: new Date().toISOString(),
    summary: `${sovereigntyScore}/100 — ${
      gatewayStatus.ollamaAvailable ? "Self-hosted Ollama active" : "External AI providers only"
    }. Knowledge base: ${absorptionStats?.totalKnowledgeEntries || 0} entries. Sovereign channels: ${activeChannels} active.`,
  };
}

export function registerPublicSovStackRoutes(app: Express): void {
  app.get("/api/sov-stack/score", async (_req: Request, res: Response) => {
    try {
      res.json(await buildSovStackScore());
    } catch (err: any) {
      res.status(500).json({ error: "Score unavailable", details: err?.message });
    }
  });

  app.get("/api/sov-stack/gateway/status", async (_req: Request, res: Response) => {
    try {
      const [status, stats] = await Promise.all([getGatewayStatus(), Promise.resolve(getGatewayStats())]);
      res.json({ status, stats });
    } catch (err: any) {
      res.status(500).json({ error: "Gateway status unavailable", details: err?.message });
    }
  });
}
