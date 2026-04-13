import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { computeWorldState, computeMarketData } from "../lib/sovereign-economics";

const router: IRouter = Router();

router.get("/world", (_req, res) => {
  try {
    const state = computeWorldState();
    return res.json(state);
  } catch (err) {
    logger.error({ err }, "Failed to compute world state");
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/world/sovereignty-score", (_req, res) => {
  try {
    const state = computeWorldState();
    const score = (state as any).sovereigntyScore ?? 85;
    return res.json({
      ok: true,
      score,
      label: score >= 90 ? "Transcendent" : score >= 75 ? "Sovereign" : score >= 50 ? "Emerging" : "Nascent",
      timestamp: Date.now(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to compute world sovereignty score");
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/world/moon", (_req, res) => {
  try {
    const state = computeWorldState();
    const moon = (state as any).moon ?? { phase: "Waxing Gibbous", illumination: 68 };
    return res.json({
      ok: true,
      ...moon,
      timestamp: Date.now(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to compute world moon data");
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/tsrt/full-market", (_req, res) => {
  try {
    const market = computeMarketData();
    return res.json({
      symbol: market.token,
      chain: market.chain,
      price: market.price,
      priceFormatted: market.priceUsd,
      marketCap: market.marketCap,
      change24h: market.change24h,
      volume24h: market.volume24h,
      liquidity: market.liquidity,
      fdv: market.marketCap,
      txns24h: market.transactions24h,
      holders: market.holders,
      circulatingSupply: market.circulatingSupply,
      totalSupply: market.totalSupply,
      burnedSupply: market.burnedSupply,
      change7d: market.change7d,
      source: market.source,
      sovereignty: market.sovereignty,
      method: market.method,
      timestamp: Date.now(),
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
