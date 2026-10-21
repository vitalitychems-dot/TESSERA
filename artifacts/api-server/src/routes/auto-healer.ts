import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  getHealingIncidents,
  getHealingStats,
  runHealingSweep,
  listStrategies,
  setAutoHealerEnabled,
} from "../lib/auto-healer";
import { requireAdminSession } from "../lib/sovereign-admin";
import { rawKeyFailRateLimit } from "../lib/father-verify-throttle";

const router: IRouter = Router();

const rateLimit = { last: 0, windowMs: 20_000 };
function rateLimitManualHealing(_req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  if (now - rateLimit.last < rateLimit.windowMs) {
    res.status(429).json({ ok: false, error: "Healing sweep rate-limited; autonomous sweeps run every 45s." });
    return;
  }
  rateLimit.last = now;
  next();
}

router.get("/auto-healer/incidents", (req, res) => {
  const limit = req.query.limit ? Math.max(1, Math.min(300, Number(req.query.limit))) : 50;
  res.json({ ok: true, incidents: getHealingIncidents(limit), stats: getHealingStats() });
});

router.get("/auto-healer/stats", (_req, res) => {
  res.json({ ok: true, ...getHealingStats(), strategies: listStrategies() });
});

router.get("/auto-healer/strategies", (_req, res) => {
  res.json({ ok: true, strategies: listStrategies() });
});

router.post("/auto-healer/sweep", requireAdminSession, rawKeyFailRateLimit, rateLimitManualHealing, async (_req, res) => {
  const incidents = await runHealingSweep({ manual: true });
  res.json({ ok: true, incidents, stats: getHealingStats() });
});

router.post("/auto-healer/enabled", requireAdminSession, rawKeyFailRateLimit, rateLimitManualHealing, (req, res) => {
  const on = Boolean(req.body?.enabled);
  setAutoHealerEnabled(on);
  res.json({ ok: true, enabled: on });
});

export default router;
