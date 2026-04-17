import { Router } from "express";
import {
  synthesizeBuiltInventions,
  getLastSynthesis,
  getSynthesisHistory,
  getTunableSnapshot,
} from "../lib/invention-synthesis.js";
import { getTunableHistory } from "../lib/system-tunables.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.post("/inventions/synthesize", async (req, res) => {
  try {
    const applyChanges = req.body?.applyChanges !== false;
    const result = await synthesizeBuiltInventions({ applyChanges });
    res.json({ ok: true, result });
  } catch (err) {
    logger.error({ err }, "Synthesis endpoint failed");
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/inventions/synthesis/latest", (_req, res) => {
  const last = getLastSynthesis();
  res.json({ ok: true, result: last });
});

router.get("/inventions/synthesis/history", (req, res) => {
  const limit = Math.min(50, parseInt((req.query.limit as string) || "10", 10));
  res.json({ ok: true, history: getSynthesisHistory(limit) });
});

router.get("/system/tunables", (_req, res) => {
  res.json({ ok: true, tunables: getTunableSnapshot() });
});

router.get("/system/tunables/:key/history", (req, res) => {
  try {
    res.json({ ok: true, history: getTunableHistory(req.params.key) });
  } catch (err) {
    res.status(404).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
