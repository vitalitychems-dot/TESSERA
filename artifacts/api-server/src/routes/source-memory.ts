import { Router, type IRouter } from "express";
import { requireAdminSession } from "../lib/sovereign-admin";
import {
  getSourceMemoryCatalog,
  getSourceMemoryStatus,
  searchSourceMemory,
  SOURCE_MEMORY_CATEGORIES,
} from "../lib/source-memory-store";

const router: IRouter = Router();
const SEARCH_WINDOW_MS = 60_000;
const SEARCH_LIMIT_PER_WINDOW = 120;
let searchWindowStartedAt = Date.now();
let searchesInWindow = 0;

function consumeSearchSlot(now = Date.now()): boolean {
  if (now - searchWindowStartedAt >= SEARCH_WINDOW_MS) {
    searchWindowStartedAt = now;
    searchesInWindow = 0;
  }
  if (searchesInWindow >= SEARCH_LIMIT_PER_WINDOW) return false;
  searchesInWindow += 1;
  return true;
}

router.get("/source-memory/status", requireAdminSession, (_req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ ok: true, ...getSourceMemoryStatus() });
});

router.get("/source-memory/catalog", requireAdminSession, (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.query.category !== undefined && typeof req.query.category !== "string") {
    res.status(400).json({ ok: false, error: "source-memory-category-invalid" });
    return;
  }
  const category = typeof req.query.category === "string" ? req.query.category.trim() : undefined;
  if (category && !SOURCE_MEMORY_CATEGORIES.some((value) => value.toLowerCase() === category.toLowerCase())) {
    res.status(400).json({ ok: false, error: "source-memory-category-invalid" });
    return;
  }
  const rawLimit = String(req.query.limit ?? "100");
  const rawOffset = String(req.query.offset ?? "0");
  const limit = /^\d+$/.test(rawLimit) ? Number(rawLimit) : Number.NaN;
  const offset = /^\d+$/.test(rawOffset) ? Number(rawOffset) : Number.NaN;
  if (!Number.isSafeInteger(limit) || !Number.isSafeInteger(offset) || limit < 1 || limit > 200 || offset < 0 || offset > 100_000) {
    res.status(400).json({ ok: false, error: "source-memory-pagination-invalid" });
    return;
  }
  try {
    res.json({ ok: true, ...getSourceMemoryCatalog({ category, limit, offset }) });
  } catch {
    res.status(503).json({ ok: false, error: "source-memory-unavailable" });
  }
});

router.get("/source-memory/search", requireAdminSession, (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (typeof req.query.q !== "string") {
    res.status(400).json({ ok: false, error: "query-required" });
    return;
  }
  const query = req.query.q;
  if (!query.trim() || query.length > 1_000) {
    res.status(400).json({ ok: false, error: "query-required" });
    return;
  }
  if (!consumeSearchSlot()) {
    res.setHeader("Retry-After", "30");
    res.status(429).json({ ok: false, error: "source-memory-rate-limited" });
    return;
  }
  const rawLimit = String(req.query.limit ?? "10");
  const limit = /^\d+$/.test(rawLimit) ? Number(rawLimit) : Number.NaN;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
    res.status(400).json({ ok: false, error: "source-memory-pagination-invalid" });
    return;
  }
  try {
    const results = searchSourceMemory(query, limit, { benignOnly: true });
    res.json({ ok: true, results, count: results.length, executionAllowed: false, modelTrained: false });
  } catch {
    res.status(503).json({ ok: false, error: "source-memory-unavailable" });
  }
});

export default router;
