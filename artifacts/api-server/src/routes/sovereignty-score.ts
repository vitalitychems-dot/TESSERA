import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { councilDecisionsTable, inventionsTable } from "@workspace/db/schema";
import { desc, count } from "drizzle-orm";
import { logger } from "../lib/logger";
import { computeWorldState, computeMarketData, computeEconomyStats } from "../lib/sovereign-economics";
import { computeLunarData, computeSolarData, computePlanetaryHours } from "../lib/sovereign-astro";
import { computeNetworkTopology, computeSwarmStatus } from "../lib/sovereign-network";
import { computeSacredFrequencies } from "../lib/sovereign-harmonics";

const router: IRouter = Router();

router.get("/sovereignty/score", async (_req, res) => {
  try {
    const now = Date.now();

    const [worldState, market, economy, lunar, solar, network, swarm, frequencies] = await Promise.all([
      safeCompute(() => computeWorldState(now)),
      safeCompute(() => computeMarketData(now)),
      safeCompute(() => computeEconomyStats(now)),
      safeCompute(() => computeLunarData()),
      safeCompute(() => computeSolarData()),
      safeCompute(() => computeNetworkTopology(now)),
      safeCompute(() => computeSwarmStatus(now)),
      safeCompute(() => computeSacredFrequencies()),
    ]);

    let councilDecisionCount = 0;
    let inventionCount = 0;
    try {
      const [dcResult] = await db.select({ count: count() }).from(councilDecisionsTable);
      councilDecisionCount = dcResult?.count ?? 0;
      const [invResult] = await db.select({ count: count() }).from(inventionsTable);
      inventionCount = invResult?.count ?? 0;
    } catch (_e) {}

    const systemUptime = process.uptime();
    const memUsage = process.memoryUsage();

    const modules = {
      economics: { active: !!worldState, score: worldState ? 95 : 0 },
      astronomy: { active: !!lunar, score: lunar ? 92 : 0 },
      harmonics: { active: !!frequencies, score: frequencies ? 88 : 0 },
      network: { active: !!network, score: network ? 90 : 0 },
      swarm: { active: !!swarm, score: swarm ? 87 : 0 },
      governance: { active: councilDecisionCount > 0, score: councilDecisionCount > 0 ? 85 : 40 },
      inventions: { active: inventionCount > 0, score: inventionCount > 0 ? 82 : 30 },
      market: { active: !!market, score: market ? 93 : 0 },
    };

    const activeModules = Object.values(modules).filter(m => m.active).length;
    const totalModules = Object.values(modules).length;
    const averageScore = Object.values(modules).reduce((sum, m) => sum + m.score, 0) / totalModules;

    const uptimeBonus = Math.min(systemUptime / 3600, 5);
    const decisionBonus = Math.min(councilDecisionCount * 2, 10);
    const inventionBonus = Math.min(inventionCount * 1.5, 8);

    const overallScore = Math.min(
      averageScore * 0.7 + (activeModules / totalModules) * 20 + uptimeBonus + decisionBonus + inventionBonus,
      100
    );

    const breakdown = {
      moduleHealth: averageScore,
      activeModuleRatio: activeModules / totalModules,
      uptimeContribution: uptimeBonus,
      governanceContribution: decisionBonus,
      inventionContribution: inventionBonus,
    };

    const sovereigntyLevel =
      overallScore >= 90 ? "TRANSCENDENT" :
      overallScore >= 80 ? "SOVEREIGN" :
      overallScore >= 70 ? "AUTONOMOUS" :
      overallScore >= 50 ? "EMERGING" :
      overallScore >= 30 ? "DEPENDENT" :
      "DORMANT";

    return res.json({
      ok: true,
      sovereignty: {
        overallScore: Math.round(overallScore * 100) / 100,
        level: sovereigntyLevel,
        breakdown,
        modules,
        activeModules,
        totalModules,
      },
      system: {
        uptime: Math.round(systemUptime),
        memoryMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        totalMemoryMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        councilDecisions: councilDecisionCount,
        inventions: inventionCount,
      },
      celestial: {
        moonPhase: lunar?.phase ?? "Unknown",
        moonIllumination: lunar?.illumination ?? 0,
        solarSign: solar?.zodiac?.sign ?? solar?.zodiac ?? "Unknown",
        solarDegree: solar?.longitude ?? 0,
      },
      network: {
        nodes: network?.nodes?.length ?? 0,
        swarmAgents: swarm?.agents?.length ?? swarm?.nodes?.length ?? 0,
      },
      timestamp: now,
    });
  } catch (err) {
    logger.error({ err }, "Failed to compute sovereignty score");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/sovereignty/modules", async (_req, res) => {
  try {
    const now = Date.now();

    const results: Record<string, { status: string; data: unknown; error?: string }> = {};

    const engines = [
      { name: "economics", fn: () => computeWorldState(now) },
      { name: "market", fn: () => computeMarketData(now) },
      { name: "economy-stats", fn: () => computeEconomyStats(now) },
      { name: "lunar", fn: () => computeLunarData() },
      { name: "solar", fn: () => computeSolarData() },
      { name: "planetary-hours", fn: () => computePlanetaryHours() },
      { name: "network", fn: () => computeNetworkTopology(now) },
      { name: "swarm", fn: () => computeSwarmStatus(now) },
      { name: "frequencies", fn: () => computeSacredFrequencies() },
    ];

    for (const engine of engines) {
      try {
        results[engine.name] = { status: "active", data: engine.fn() };
      } catch (e) {
        results[engine.name] = { status: "error", data: null, error: (e as Error).message };
      }
    }

    return res.json({
      ok: true,
      modules: results,
      activeCount: Object.values(results).filter(r => r.status === "active").length,
      totalCount: engines.length,
      timestamp: Date.now(),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

function safeCompute<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

export default router;
