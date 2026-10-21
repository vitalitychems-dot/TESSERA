import { Router, type IRouter, type Response, type NextFunction } from "express";
import { runRedTeamSweep, getRedTeamFindings, getRedTeamStats } from "../lib/red-team-agent";
import { getSandboxPolicyStats } from "../lib/external-sandbox-policy";
import { requireAdminSession } from "../lib/sovereign-admin";

const router: IRouter = Router();

const sweepRateLimit = { last: 0, windowMs: 30_000 };
function rateLimitSweep(_req: import("express").Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  if (now - sweepRateLimit.last < sweepRateLimit.windowMs) {
    res.status(429).json({ ok: false, error: "Red-team sweep rate-limited; autonomous sweeps run on 10-minute cycle." });
    return;
  }
  sweepRateLimit.last = now;
  next();
}

router.get("/red-team/findings", (req, res) => {
  const limit = req.query.limit ? Math.max(1, Math.min(200, Number(req.query.limit))) : 50;
  res.json({ ok: true, findings: getRedTeamFindings(limit), stats: getRedTeamStats() });
});

router.get("/red-team/stats", (_req, res) => {
  res.json({ ok: true, ...getRedTeamStats(), sandbox: getSandboxPolicyStats() });
});

router.post("/red-team/sweep", requireAdminSession, rateLimitSweep, async (_req, res) => {
  const findings = await runRedTeamSweep();
  res.json({ ok: true, findings, stats: getRedTeamStats() });
});

export default router;
