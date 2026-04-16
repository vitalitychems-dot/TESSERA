import { Router, type IRouter } from "express";
import { getRealityAudit, getRealityFlag } from "../lib/reality-audit";

const router: IRouter = Router();

router.get("/reality-audit", async (_req, res) => {
  try {
    const audit = await getRealityAudit();
    res.json({ ok: true, ...audit });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/reality-audit/summary", async (_req, res) => {
  try {
    const audit = await getRealityAudit();
    res.json({
      ok: true,
      scannedAt: audit.scannedAt,
      summary: audit.summary,
      topFiveByImpact: audit.topFiveByImpact.map(f => ({
        id: f.id,
        file: f.file,
        status: f.status,
        impactScore: f.impactScore,
        pattern: f.pattern,
      })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/reality-audit/flag/:id", (req, res) => {
  const flag = getRealityFlag(req.params.id);
  res.json({ ok: true, id: req.params.id, flag });
});

export default router;
