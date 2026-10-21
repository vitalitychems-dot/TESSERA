import { Router } from "express";
import {
  runCompressionPipeline,
  getCompressionMetrics,
  getRecentCompressionRuns,
  loadPortalJumpTableFromDb,
  portalJumpResolve,
  lookupCanonicalByDomain,
} from "../lib/semantic-compression";
import { requireAdminSession } from "../lib/sovereign-admin";
import { db } from "@workspace/db";
import { knowledgeCanonicalTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// Mutation routes require the same sovereign key as other admin routes.


// Route-level rate limiting for mutation endpoints that trigger heavy DB/embedding work.
// Returns 429 if the endpoint is called more frequently than ROUTE_RATE_LIMIT_MS.
const ROUTE_RATE_LIMIT_MS = 30_000;
const routeLastCall = new Map<string, number>();

function routeRateLimit(key: string): boolean {
  const now = Date.now();
  const last = routeLastCall.get(key) ?? 0;
  if (now - last < ROUTE_RATE_LIMIT_MS) return false;
  routeLastCall.set(key, now);
  return true;
}

router.get("/sovereign/compression/metrics", (_req, res) => {
  try {
    const metrics = getCompressionMetrics();
    res.json({ status: "ok", ...metrics });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve compression metrics" });
  }
});

router.post("/sovereign/compression/run", requireAdminSession, async (req, res) => {
  if (!routeRateLimit("run")) {
    res.status(429).json({ error: "Rate limited — pipeline can only be triggered once per 30 seconds." }); return;
  }
  try {
    const { rebuildDictionary = false, minConfidence = 0.5, batchSize = 50, wait = false } = req.body ?? {};
    if (wait) {
      const metrics = await runCompressionPipeline({ rebuildDictionary, minConfidence, batchSize });
      res.json({ status: "ok", run: metrics }); return;
    }
    runCompressionPipeline({ rebuildDictionary, minConfidence, batchSize }).catch(err => {
      logger.debug({ err: (err as Error).message }, "SemanticCompression: background pipeline error");
    });
    res.json({ status: "ok", message: "Compression pipeline started in background. Poll /metrics for results." });
  } catch (err) {
    res.status(500).json({ error: "Compression pipeline failed" });
  }
});

router.get("/sovereign/compression/runs", requireAdminSession, async (_req, res) => {
  try {
    const runs = await getRecentCompressionRuns(20);
    res.json({ status: "ok", runs });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve run history" });
  }
});

router.get("/sovereign/compression/canonical", requireAdminSession, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await db
      .select()
      .from(knowledgeCanonicalTable)
      .orderBy(desc(knowledgeCanonicalTable.updatedAt))
      .limit(limit);
    res.json({ status: "ok", total: rows.length, canonical: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve canonical facts" });
  }
});

router.get("/sovereign/compression/portal/:id", requireAdminSession, (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid canonical ID" }); return; }
  const entry = portalJumpResolve(id);
  if (!entry) { res.status(404).json({ error: "No portal entry for that ID" }); return; }
  res.json({ status: "ok", entry });
});

router.get("/sovereign/compression/domain/:domain", requireAdminSession, (req, res) => {
  const domain = String(req.params.domain);
  const entries = lookupCanonicalByDomain(domain);
  res.json({ status: "ok", domain, count: entries.length, entries });
});

router.post("/sovereign/compression/portal/warm", requireAdminSession, async (_req, res) => {
  if (!routeRateLimit("warm")) {
    res.status(429).json({ error: "Rate limited — warm can only be triggered once per 30 seconds." }); return;
  }
  try {
    const loaded = await loadPortalJumpTableFromDb();
    res.json({ status: "ok", loaded });
  } catch (err) {
    res.status(500).json({ error: "Failed to warm portal-jump table" });
  }
});

export default router;
