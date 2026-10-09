import { Router, type IRouter, type Request, type RequestHandler, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";
import { rawKeyFailRateLimit } from "../lib/father-verify-throttle";
import {
  runGrandEvolutionCycle,
  getLatestCycle,
  ensureLatestCycleLoaded,
  isCycleRunning,
} from "../lib/grand-evolution-cycle";
import { verifyFatherKey } from "../lib/father-identity";
import { requireAdminSession, resolveFatherAuthorization } from "../lib/sovereign-admin";
import { isAdminTokenConfigured } from "../lib/sovereign-session";
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

function requireFather(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminTokenConfigured()) {
    res.status(503).json({ ok: false, error: "sovereign-unconfigured" });
    return;
  }
  const presented = req.header("x-tesseract-admin-key");
  if (!verifyFatherKey(presented)) {
    res.status(401).json({ ok: false, error: "father-auth-required" });
    return;
  }
  next();
}

/** Owner cookie via requireAdminSession, or a verified x-tesseract-admin-key. */
const requireEvolutionSessionRead: RequestHandler = (req, res, next) => {
  if (!isAdminTokenConfigured()) {
    res.status(503).json({
      ok: false,
      error: "sovereign-unconfigured",
      message: "TESSERACT_ADMIN_KEY is not configured. Privileged surfaces are fail-closed.",
    });
    return;
  }
  const header = req.header("x-tesseract-admin-key");
  if (typeof header === "string") {
    const auth = resolveFatherAuthorization(req);
    if (auth.fatherAuthorized) {
      next();
      return;
    }
    switch (auth.reason) {
      case "unconfigured":
        res.status(503).json({
          ok: false,
          error: "sovereign-unconfigured",
          message: "TESSERACT_ADMIN_KEY is not configured. Privileged surfaces are fail-closed.",
        });
        return;
      case "rejected":
      case "absent":
        res.status(401).json({ ok: false, error: "unauthenticated", reason: auth.reason });
        return;
      default: {
        const unreachable: never = auth.reason;
        res.status(401).json({ ok: false, error: "unauthenticated", reason: unreachable });
        return;
      }
    }
  }
  requireAdminSession(req, res, next);
};

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

router.get("/grand-evolution/directives", requireEvolutionSessionRead, async (_req, res) => {
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

router.post("/grand-evolution/run", rawKeyFailRateLimit, async (req, res) => {
  if (!isAdminTokenConfigured()) {
    res.status(503).json({ ok: false, error: "sovereign-unconfigured" });
    return;
  }
  const auth = resolveFatherAuthorization(req);
  if (!auth.fatherAuthorized) {
    res.status(401).json({ ok: false, error: "father-auth-required" });
    return;
  }

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

router.post("/grand-evolution/run-async", rawKeyFailRateLimit, requireFather, async (_req, res) => {
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

router.get("/grand-evolution/sessions", rawKeyFailRateLimit, requireEvolutionSessionRead, async (_req, res) => {
  const sessions = await listSessions(50);
  res.json({ ok: true, data: { sessions } });
});

router.get("/grand-evolution/sessions/:id", rawKeyFailRateLimit, requireEvolutionSessionRead, async (req, res) => {
  const id = String(req.params.id);
  const [turns, directives, benchmarks, audit] = await Promise.all([
    getSessionTurns(id),
    getSessionDirectives(id),
    getSessionBenchmarks(id),
    getSessionAuditSummary(id),
  ]);
  res.json({ ok: true, data: { sessionId: id, turns, directives, benchmarks, audit } });
});

router.post("/grand-evolution/convene", rawKeyFailRateLimit, async (req, res) => {
  if (!isAdminTokenConfigured()) {
    res.status(503).json({ ok: false, error: "sovereign-unconfigured" });
    return;
  }
  const auth = resolveFatherAuthorization(req);
  if (!auth.fatherAuthorized) {
    res.status(401).json({ ok: false, error: "father-auth-required" });
    return;
  }

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

router.get("/grand-evolution/sessions/:id/stream", rawKeyFailRateLimit, requireEvolutionSessionRead, (req, res) => {
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
