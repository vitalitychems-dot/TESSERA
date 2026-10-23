import { Router, type IRouter } from "express";
import { requireAdminSession } from "../lib/sovereign-admin";
import { getSourceMemoryStatus, searchSourceMemory } from "../lib/source-memory-store";

const router: IRouter = Router();

router.get("/source-memory/status", requireAdminSession, (_req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ ok: true, ...getSourceMemoryStatus() });
});

router.get("/source-memory/search", requireAdminSession, (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const query = String(req.query.q ?? "");
  if (!query.trim()) {
    res.status(400).json({ ok: false, error: "query-required" });
    return;
  }
  const limit = Number.parseInt(String(req.query.limit ?? "10"), 10);
  try {
    const results = searchSourceMemory(query, limit);
    res.json({ ok: true, results, count: results.length, executionAllowed: false, modelTrained: false });
  } catch {
    res.status(503).json({ ok: false, error: "source-memory-unavailable" });
  }
});

export default router;
