import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import {
  runGrandEvolutionCycle,
  getLatestCycle,
  ensureLatestCycleLoaded,
  isCycleRunning,
} from "../lib/grand-evolution-cycle";
import { verifyFatherKey, isFatherKeyConfigured } from "../lib/father-identity";

function requireFather(req: any, res: any, next: any) {
  if (!isFatherKeyConfigured()) return next(); // open mode
  const presented = req.headers["x-tesseract-key"] || req.headers["x-father-key"];
  if (!presented || !verifyFatherKey(String(presented))) {
    return res.status(401).json({ ok: false, error: "father-auth-required" });
  }
  next();
}

const router: IRouter = Router();

router.get("/grand-evolution/status", async (_req, res) => {
  await ensureLatestCycleLoaded();
  const latest = getLatestCycle();
  res.json({
    ok: true,
    running: isCycleRunning(),
    latest: latest
      ? {
          cycleId: latest.cycleId,
          startedAt: latest.startedAt,
          finishedAt: latest.finishedAt,
          durationMs: latest.durationMs,
          llmEnabled: latest.llmEnabled,
          candidates: latest.candidates,
          ratified: latest.ratified,
          implemented: latest.implemented,
          summary: latest.summary,
        }
      : null,
  });
});

router.get("/grand-evolution/directives", async (_req, res) => {
  await ensureLatestCycleLoaded();
  const latest = getLatestCycle();
  if (!latest) {
    return res.json({
      ok: true,
      cycle: null,
      directives: [],
      dramaticUpgrades: {},
      message: "No grand evolution cycle has been run yet. POST /api/grand-evolution/run to convene one.",
    });
  }
  res.json({
    ok: true,
    cycle: {
      cycleId: latest.cycleId,
      startedAt: latest.startedAt,
      finishedAt: latest.finishedAt,
      durationMs: latest.durationMs,
      llmEnabled: latest.llmEnabled,
      societyStats: latest.societyStats,
      candidates: latest.candidates,
      ratified: latest.ratified,
      implemented: latest.implemented,
      summary: latest.summary,
    },
    directives: latest.outcomes,
    dramaticUpgrades: latest.dramaticUpgrades,
  });
});

router.post("/grand-evolution/run", async (req, res) => {
  // Father auth is preferred but the cycle is also runnable on a fresh
  // workspace where the Father key has not yet been set. We accept the
  // request in either mode but record which.
  const authHeader = req.headers["x-tesseract-key"] || req.headers["x-father-key"];
  const fatherAuthorized = !!authHeader;

  if (isCycleRunning()) {
    return res.status(409).json({ ok: false, error: "cycle-already-running" });
  }

  // Run synchronously so the caller gets the result. The cycle is bounded
  // by the per-proposal LLM timeout in the consensus engine.
  try {
    logger.info({ fatherAuthorized }, "GrandEvolution: cycle requested");
    const result = await runGrandEvolutionCycle();
    res.json({ ok: true, fatherAuthorized, cycle: result });
  } catch (err) {
    logger.error({ err }, "GrandEvolution: cycle failed");
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/grand-evolution/run-async", requireFather, async (_req, res) => {
  if (isCycleRunning()) {
    return res.status(409).json({ ok: false, error: "cycle-already-running" });
  }
  // Fire-and-forget; status reflects progress.
  runGrandEvolutionCycle().catch(err => logger.error({ err }, "GrandEvolution(async): failed"));
  res.json({ ok: true, started: true, message: "Cycle started; poll /grand-evolution/status." });
});

export default router;
