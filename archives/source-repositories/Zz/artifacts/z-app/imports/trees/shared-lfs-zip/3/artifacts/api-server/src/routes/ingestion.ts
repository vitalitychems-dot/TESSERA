import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { dataSourcesTable, ingestionJobsTable, ingestedDataTable } from "@workspace/db/schema";
import { desc, eq, ilike, and, or, sql } from "drizzle-orm";
import {
  runIngestionForSource,
  runAllIngestion,
  runDueIngestion,
  getSourceHandlers,
  runRssIngestion,
} from "../lib/ingestion/scheduler";
import { ingestItem } from "../lib/ingestion/pipeline";

const router: IRouter = Router();

router.get("/ingestion/sources", async (_req, res) => {
  try {
    const sources = await db
      .select()
      .from(dataSourcesTable)
      .orderBy(desc(dataSourcesTable.updatedAt));
    return res.json({ ok: true, sources });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/ingestion/sources", async (req, res) => {
  try {
    const { name, type, url, config, intervalSeconds, enabled } = req.body as {
      name: string;
      type: string;
      url?: string;
      config?: Record<string, unknown>;
      intervalSeconds?: number;
      enabled?: boolean;
    };
    if (!name || !type) {
      return res.status(400).json({ ok: false, error: "name and type are required" });
    }
    const [source] = await db.insert(dataSourcesTable).values({
      name,
      type,
      url: url ?? null,
      config: config ?? {},
      intervalSeconds: intervalSeconds ?? 3600,
      enabled: enabled ?? true,
    }).onConflictDoUpdate({
      target: dataSourcesTable.name,
      set: { type, url: url ?? null, config: config ?? {}, intervalSeconds: intervalSeconds ?? 3600, updatedAt: new Date() },
    }).returning();
    return res.json({ ok: true, source });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.patch("/ingestion/sources/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { enabled, intervalSeconds } = req.body as { enabled?: boolean; intervalSeconds?: number };
    const [source] = await db.update(dataSourcesTable)
      .set({ enabled, intervalSeconds, updatedAt: new Date() })
      .where(eq(dataSourcesTable.id, id))
      .returning();
    return res.json({ ok: true, source });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.delete("/ingestion/sources/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(dataSourcesTable).where(eq(dataSourcesTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/ingestion/sources/available", async (_req, res) => {
  try {
    const handlers = getSourceHandlers();
    return res.json({ ok: true, sources: handlers });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/ingestion/trigger/:sourceName", async (req, res) => {
  try {
    const { sourceName } = req.params;
    const result = await runIngestionForSource(decodeURIComponent(sourceName));
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/ingestion/trigger-all", async (_req, res) => {
  try {
    const results = await runAllIngestion();
    return res.json({ ok: true, results });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/ingestion/trigger-due", async (_req, res) => {
  try {
    const results = await runDueIngestion();
    return res.json({ ok: true, results });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/ingestion/rss", async (req, res) => {
  try {
    const { name, url } = req.body as { name: string; url: string };
    if (!name || !url) {
      return res.status(400).json({ ok: false, error: "name and url are required" });
    }
    const result = await runRssIngestion(name, url);
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/ingestion/ingest-item", async (req, res) => {
  try {
    const { source, sourceType, title, content, url, tags, metadata } = req.body;
    if (!source || !content) {
      return res.status(400).json({ ok: false, error: "source and content are required" });
    }
    const result = await ingestItem({ source, sourceType: sourceType || "manual", title, content, url, tags, metadata });
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/ingestion/jobs", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 200);
    const sourceName = req.query.source ? String(req.query.source) : undefined;

    let query = db.select().from(ingestionJobsTable).orderBy(desc(ingestionJobsTable.startedAt)).limit(limit);
    const jobs = await query;
    const filtered = sourceName ? jobs.filter(j => j.sourceName === sourceName) : jobs;
    return res.json({ ok: true, jobs: filtered, count: filtered.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/ingestion/data", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 200);
    const offset = parseInt(String(req.query.offset ?? "0"), 10);
    const source = req.query.source ? String(req.query.source) : undefined;
    const sourceType = req.query.sourceType ? String(req.query.sourceType) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    const conditions = [];
    if (source) conditions.push(eq(ingestedDataTable.source, source));
    if (sourceType) conditions.push(eq(ingestedDataTable.sourceType, sourceType));
    if (search) conditions.push(
      or(
        ilike(ingestedDataTable.title, `%${search}%`),
        ilike(ingestedDataTable.content, `%${search}%`)
      )
    );

    const baseQuery = db.select({
      id: ingestedDataTable.id,
      source: ingestedDataTable.source,
      sourceType: ingestedDataTable.sourceType,
      title: ingestedDataTable.title,
      content: sql`LEFT(${ingestedDataTable.content}, 500)`,
      url: ingestedDataTable.url,
      tags: ingestedDataTable.tags,
      metadata: ingestedDataTable.metadata,
      ingestedAt: ingestedDataTable.ingestedAt,
      publishedAt: ingestedDataTable.publishedAt,
    }).from(ingestedDataTable).orderBy(desc(ingestedDataTable.ingestedAt)).limit(limit).offset(offset);

    const rows = conditions.length > 0
      ? await baseQuery.where(and(...conditions))
      : await baseQuery;

    const [countResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(ingestedDataTable);
    return res.json({ ok: true, data: rows, count: rows.length, total: Number(countResult?.count ?? 0) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/ingestion/data/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [row] = await db.select().from(ingestedDataTable).where(eq(ingestedDataTable.id, id)).limit(1);
    if (!row) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, data: row });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.delete("/ingestion/data/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(ingestedDataTable).where(eq(ingestedDataTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/ingestion/stats", async (_req, res) => {
  try {
    const [totalResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(ingestedDataTable);
    const bySource = await db
      .select({ source: ingestedDataTable.source, count: sql<number>`COUNT(*)` })
      .from(ingestedDataTable)
      .groupBy(ingestedDataTable.source)
      .orderBy(desc(sql`COUNT(*)`));
    const byType = await db
      .select({ sourceType: ingestedDataTable.sourceType, count: sql<number>`COUNT(*)` })
      .from(ingestedDataTable)
      .groupBy(ingestedDataTable.sourceType);
    const sources = await db.select().from(dataSourcesTable).orderBy(desc(dataSourcesTable.updatedAt));
    const recentJobs = await db
      .select()
      .from(ingestionJobsTable)
      .orderBy(desc(ingestionJobsTable.startedAt))
      .limit(10);

    const [jobStats] = await db.select({
      totalJobs: sql<number>`COUNT(*)`,
      successJobs: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
      failedJobs: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
    }).from(ingestionJobsTable);

    return res.json({
      ok: true,
      totalItems: Number(totalResult?.count ?? 0),
      bySource: bySource.map(r => ({ source: r.source, count: Number(r.count) })),
      byType: byType.map(r => ({ sourceType: r.sourceType, count: Number(r.count) })),
      sources,
      recentJobs,
      jobStats: {
        total: Number(jobStats?.totalJobs ?? 0),
        success: Number(jobStats?.successJobs ?? 0),
        failed: Number(jobStats?.failedJobs ?? 0),
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
