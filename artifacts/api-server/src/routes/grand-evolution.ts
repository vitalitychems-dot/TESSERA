import { Router, type IRouter, type Request, type RequestHandler, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";
import {
  runGrandEvolutionCycle,
  getLatestCycle,
  ensureLatestCycleLoaded,
  isCycleRunning,
} from "../lib/grand-evolution-cycle";
import { requireAdminSession } from "../lib/sovereign-admin";
import { rawKeyFailRateLimitIfKeyHeader } from "../lib/father-verify-throttle";
import {
  convene,
  subscribeToSession,
  listSessions,
  getSessionTurns,
  getSessionDirectives,
  getSessionBenchmarks,
  getSessionAuditSummary,
  societyAnchor,
  type EvolutionMode,
} from "../lib/grand-evolution-engine";
import { getSocietyStats } from "../lib/sovereign-society";



const router: IRouter = Router();

// ─── Legacy cycle-based endpoints (kept for backwards compatibility) ──────

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

router.get("/grand-evolution/directives", rawKeyFailRateLimitIfKeyHeader, requireAdminSession, async (_req, res) => {
  await ensureLatestCycleLoaded();
  const latest = getLatestCycle();
  if (!latest) {
    res.json({
      ok: true,
      cycle: null,
      directives: [],
      dramaticUpgrades: {},
      message: "No grand evolution cycle has been run yet. POST /api/grand-evolution/run to convene one.",
    });
    return;
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

router.post("/grand-evolution/run", rawKeyFailRateLimitIfKeyHeader, requireAdminSession, async (_req, res) => {
  if (isCycleRunning()) {
    res.status(409).json({ ok: false, error: "cycle-already-running" }); return;
  }

  try {
    logger.info({ fatherAuthorized: true }, "GrandEvolution: cycle requested");
    const result = await runGrandEvolutionCycle();
    res.json({ ok: true, fatherAuthorized: true, cycle: result });
  } catch (err) {
    logger.error({ err }, "GrandEvolution: cycle failed");
    res.status(500).json({ ok: false, error: "grand-evolution-failed" });
  }
});

router.post("/grand-evolution/run-async", rawKeyFailRateLimitIfKeyHeader, requireAdminSession, async (_req, res) => {
  if (isCycleRunning()) {
    res.status(409).json({ ok: false, error: "cycle-already-running" }); return;
  }
  // Fire-and-forget; status reflects progress.
  runGrandEvolutionCycle().catch(err => logger.error({ err }, "GrandEvolution(async): failed"));
  res.json({ ok: true, started: true, message: "Cycle started; poll /grand-evolution/status." });
});

// ─── New session-based endpoints (Grand Sovereign Evolution Cycle) ────────

router.get("/grand-evolution/society", (_req, res) => {
  res.json({ ok: true, data: { ...getSocietyStats(), anchor: societyAnchor() } });
});

router.get("/grand-evolution/sessions", rawKeyFailRateLimitIfKeyHeader, requireAdminSession, async (_req, res) => {
  const sessions = await listSessions(50);
  res.json({ ok: true, data: { sessions } });
});

router.get("/grand-evolution/sessions/:id", rawKeyFailRateLimitIfKeyHeader, requireAdminSession, async (req, res) => {
  const id = String(req.params.id);
  const [turns, directives, benchmarks, audit] = await Promise.all([
    getSessionTurns(id),
    getSessionDirectives(id),
    getSessionBenchmarks(id),
    getSessionAuditSummary(id),
  ]);
  res.json({ ok: true, data: { sessionId: id, turns, directives, benchmarks, audit } });
});

router.post("/grand-evolution/convene", rawKeyFailRateLimitIfKeyHeader, requireAdminSession, async (req, res) => {
  const mode = (req.body?.mode === "full" ? "full" : "smoke") as EvolutionMode;
  const topic = typeof req.body?.topic === "string" ? req.body.topic : undefined;
  const smokeSpeakers = typeof req.body?.smokeSpeakers === "number" ? req.body.smokeSpeakers : undefined;
  const rounds = typeof req.body?.rounds === "number" ? req.body.rounds : undefined;
  const startedAt = new Date().toISOString();

  try {
    const session = await convene({ mode, topic, smokeSpeakers, rounds });
    res.json({ ok: true, fatherAuthorized: true, data: { startedAt, session } });
  } catch (err) {
    logger.error({ err }, "grand-evolution convene failed");
    res.status(500).json({ ok: false, error: "grand-evolution-failed" });
  }
});

router.get("/grand-evolution/sessions/:id/stream", rawKeyFailRateLimitIfKeyHeader, requireAdminSession, (req, res) => {
  const id = String(req.params.id);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (ev: any) => {
    res.write(`event: ${ev.type}\n`);
    res.write(`data: ${JSON.stringify(ev.payload ?? {})}\n\n`);
  };

  const { unsubscribe, backlog } = subscribeToSession(id, send);
  for (const ev of backlog) send(ev);

  const ka = setInterval(() => res.write(":keepalive\n\n"), 15_000);
  req.on("close", () => { clearInterval(ka); unsubscribe(); });
});

export default router;
