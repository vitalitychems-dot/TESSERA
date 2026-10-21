import type { Express, Request, Response, NextFunction } from "express";
import {
  get100Status, runRealificationCycle, getShopifyState, getSocialState, getSEOState,
  getRevenueState, getArbitrageConfig, getBlogScheduleConfig,
  getAPIStats, getAnalytics, getAmbassadors, getAllFreeAPIs, getAirdropCampaigns,
  generateGA4Code, generateQRCode, generateReferralCode, generateTreasuryReport,
  generateNFTItems, createNFTCollection, createAPIKey, createDiscount, claimAirdrop,
  checkPumpFunGraduation, getAdSenseStats, getAdSensePlacements,
} from "../hundred-realifier";

export function registerRealificationRoutes(
  app: Express,
  adminMiddleware: (req: Request, res: Response, next: NextFunction) => void,
) {
  app.get("/api/realification/status", (_req, res) => {
    res.json(get100Status());
  });

  app.post("/api/realification/cycle", async (_req, res) => {
    try {
      await runRealificationCycle();
      res.json({ success: true, status: get100Status() });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/shopify", (_req, res) => res.json(getShopifyState()));
  app.get("/api/realification/social", (_req, res) => res.json(getSocialState()));
  app.get("/api/realification/seo", (_req, res) => res.json(getSEOState()));
  app.get("/api/realification/revenue", (_req, res) => res.json(getRevenueState()));

  app.get("/api/realification/phase1-security", adminMiddleware, async (_req: Request, res: Response) => {
    res.json({ phase: 1, status: "active", layers: 25 });
  });

  app.get("/api/realification/arbitrage", (_req, res) => {
    try { res.json(getArbitrageConfig()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/blog-schedule", (_req, res) => {
    try { res.json(getBlogScheduleConfig()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/audit", async (_req, res) => {
    try {
      const { getAuditStats } = await import("../pg-audit-trail");
      res.json(getAuditStats());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/api-stats", (_req, res) => {
    try { res.json(getAPIStats()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/realification/api-key/generate", (req, res) => {
    try {
      const key = createAPIKey(req.body.owner || "anonymous", req.body.tier || "free");
      res.json(key);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/analytics", (_req, res) => {
    try { res.json(getAnalytics()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/analytics/ga4-code", (req, res) => {
    const id = (req.query.id as string) || "G-XXXXXXXXXX";
    res.json({ code: generateGA4Code(id) });
  });

  app.get("/api/realification/analytics/adsense-code", (_req, res) => {
    try { res.json(getAdSenseStats()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/adsense/placements", (_req, res) => {
    try { res.json(getAdSensePlacements()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/ambassadors", (_req, res) => {
    try { res.json(getAmbassadors()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/free-apis", (_req, res) => {
    try { res.json(getAllFreeAPIs()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/airdrop", (_req, res) => {
    try { res.json(getAirdropCampaigns()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/realification/airdrop/claim", (req, res) => {
    try { res.json(claimAirdrop(req.body)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/nft", (_req, res) => {
    try { res.json(generateNFTItems("default", 10)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/realification/nft/collection", (req, res) => {
    try { res.json(createNFTCollection(req.body)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/qr/:data", (req, res) => {
    try { res.json(generateQRCode(req.params.data)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/referral/:agent", (req, res) => {
    try { res.json(generateReferralCode(req.params.agent)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/treasury", (_req, res) => {
    try { res.json(generateTreasuryReport()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/discount", (req, res) => {
    try { res.json(createDiscount(req.query)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/defi/jito-apy", async (_req, res) => {
    try {
      const { fetchJitoStakingAPY } = await import("../defi-realification");
      res.json(await fetchJitoStakingAPY());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/defi/marinade-apy", async (_req, res) => {
    try {
      const { fetchMarinadeStakingAPY } = await import("../defi-realification");
      res.json(await fetchMarinadeStakingAPY());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/defi/holders", async (_req, res) => {
    try {
      const { fetchLimnHolderCount } = await import("../real-limn-data");
      res.json(await fetchLimnHolderCount());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/defi/orderbook/:symbol", async (req, res) => {
    try {
      const { fetchRealOrderBookDepth } = await import("../defi-realification");
      res.json(await fetchRealOrderBookDepth());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/realification/defi/pumpfun/:mint", async (req, res) => {
    try {
      res.json(await checkPumpFunGraduation(req.params.mint));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  console.log("[RealificationRoutes] 36 realification routes registered");
}
