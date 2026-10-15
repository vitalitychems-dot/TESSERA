import { randomUUID } from "node:crypto";
import { Router, type IRouter, type RequestHandler } from "express";
import { sql, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import {
  conversationsTable,
  messagesTable,
  messageFeedbackTable,
  modelRoutingLogTable,
  providerCallsTable,
  providerDiffsTable,
  natalChartTable,
  identityVerificationTable,
  systemStateTable,
} from "@workspace/db/schema";
import { requireAdminSession } from "../lib/sovereign-admin";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const PREVIEW_TTL_MS = 10 * 60_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_WINDOW = 30;
const DELETE_CONFIRMATION = "DELETE MY TESSERA DATA";
export const FATHER_NATAL_CHART_REMOVED_KEY = "privacy:father-natal-chart-removed";

type OwnerDataCounts = {
  conversations: number;
  messages: number;
  feedback: number;
  modelRoutingLogs: number;
  providerCalls: number;
  providerDiffs: number;
  natalCharts: number;
  identityVerifications: number;
};

const deletionPreviews = new Map<string, { counts: OwnerDataCounts; expiresAt: number }>();
let ownerRateWindowStartedAt = 0;
let ownerRateWindowCount = 0;

const ownerPrivacyRateLimit: RequestHandler = (_req, res, next) => {
  const now = Date.now();
  if (now - ownerRateWindowStartedAt >= RATE_WINDOW_MS) {
    ownerRateWindowStartedAt = now;
    ownerRateWindowCount = 0;
  }
  if (ownerRateWindowCount >= RATE_LIMIT_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - ownerRateWindowStartedAt)) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({ ok: false, error: "privacy-rate-limit" });
    return;
  }
  ownerRateWindowCount += 1;
  next();
};

router.use(requireAdminSession, ownerPrivacyRateLimit);

async function countRows(query: Promise<Array<{ count: number }>>): Promise<number> {
  const rows = await query;
  return Number(rows[0]?.count ?? 0);
}

async function getOwnerDataCounts(): Promise<OwnerDataCounts> {
  const [
    conversations,
    messages,
    feedback,
    modelRoutingLogs,
    providerCalls,
    providerDiffs,
    natalCharts,
    identityVerifications,
  ] = await Promise.all([
    countRows(db.select({ count: sql<number>`count(*)::int` }).from(conversationsTable)),
    countRows(db.select({ count: sql<number>`count(*)::int` }).from(messagesTable)),
    countRows(db.select({ count: sql<number>`count(*)::int` }).from(messageFeedbackTable)),
    countRows(db.select({ count: sql<number>`count(*)::int` }).from(modelRoutingLogTable)),
    countRows(db.select({ count: sql<number>`count(*)::int` }).from(providerCallsTable)),
    countRows(db.select({ count: sql<number>`count(*)::int` }).from(providerDiffsTable)),
    countRows(db.select({ count: sql<number>`count(*)::int` }).from(natalChartTable)),
    countRows(db.select({ count: sql<number>`count(*)::int` }).from(identityVerificationTable)),
  ]);
  return { conversations, messages, feedback, modelRoutingLogs, providerCalls, providerDiffs, natalCharts, identityVerifications };
}

function purgeExpiredPreviews(now = Date.now()): void {
  for (const [token, preview] of deletionPreviews) {
    if (preview.expiresAt <= now) deletionPreviews.delete(token);
  }
}

router.get("/privacy/data/summary", async (_req, res): Promise<void> => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      scope: "single-owner-workspace",
      counts: await getOwnerDataCounts(),
      retention: "Owner-controlled; records remain until the owner explicitly deletes them.",
    });
  } catch (err) {
    logger.error({ name: err instanceof Error ? err.name : "Error" }, "owner data summary failed");
    res.status(500).json({ ok: false, error: "owner-data-summary-failed" });
  }
});

router.get("/privacy/data/export", async (_req, res): Promise<void> => {
  try {
    const [
      conversations,
      messages,
      feedback,
      modelRoutingLogs,
      providerCalls,
      providerDiffs,
      natalCharts,
      identityVerifications,
    ] = await Promise.all([
      db.select().from(conversationsTable),
      db.select().from(messagesTable),
      db.select().from(messageFeedbackTable),
      db.select().from(modelRoutingLogTable),
      db.select().from(providerCallsTable),
      db.select().from(providerDiffsTable),
      db.select().from(natalChartTable),
      db.select().from(identityVerificationTable),
    ]);

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tessera-owner-data-${date}.json"`);
    res.json({
      formatVersion: 1,
      scope: "single-owner-workspace",
      exportedAt: new Date().toISOString(),
      included: {
        conversations,
        messages,
        feedback,
        modelRoutingLogs,
        providerCalls,
        providerDiffs,
        natalCharts,
        identityVerifications,
      },
      excluded: [
        "authentication credential hashes and session material",
        "shared agent/system state and unscoped knowledge stores",
        "Replit Secrets and externally managed provider data",
      ],
    });
  } catch (err) {
    logger.error({ name: err instanceof Error ? err.name : "Error" }, "owner data export failed");
    res.status(500).json({ ok: false, error: "owner-data-export-failed" });
  }
});

router.post("/privacy/data/delete/preview", async (_req, res): Promise<void> => {
  try {
    purgeExpiredPreviews();
    const counts = await getOwnerDataCounts();
    const previewToken = randomUUID();
    const expiresAt = Date.now() + PREVIEW_TTL_MS;
    deletionPreviews.set(previewToken, { counts, expiresAt });
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      previewToken,
      expiresAt: new Date(expiresAt).toISOString(),
      confirmPhrase: DELETE_CONFIRMATION,
      counts,
    });
  } catch (err) {
    logger.error({ name: err instanceof Error ? err.name : "Error" }, "owner data deletion preview failed");
    res.status(500).json({ ok: false, error: "owner-data-preview-failed" });
  }
});

const deleteRequestSchema = z.object({
  previewToken: z.string().uuid(),
  confirmation: z.literal(DELETE_CONFIRMATION),
}).strict();

router.post("/privacy/data/delete", async (req, res): Promise<void> => {
  const parsed = deleteRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "review-and-confirm-required" });
    return;
  }

  purgeExpiredPreviews();
  const preview = deletionPreviews.get(parsed.data.previewToken);
  if (!preview) {
    res.status(409).json({ ok: false, error: "deletion-preview-expired" });
    return;
  }

  try {
    const currentCounts = await getOwnerDataCounts();
    if (JSON.stringify(currentCounts) !== JSON.stringify(preview.counts)) {
      deletionPreviews.delete(parsed.data.previewToken);
      res.status(409).json({ ok: false, error: "data-changed-review-again" });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(messageFeedbackTable);
      await tx.delete(modelRoutingLogTable);
      await tx.delete(providerCallsTable);
      await tx.delete(providerDiffsTable);
      await tx.delete(messagesTable);
      await tx.delete(conversationsTable);
      await tx.delete(natalChartTable);
      await tx.delete(identityVerificationTable);
      await tx.insert(systemStateTable)
        .values({
          key: FATHER_NATAL_CHART_REMOVED_KEY,
          value: true,
          description: "Owner-requested removal; prevents reseeding the deleted database chart",
        })
        .onConflictDoUpdate({
          target: systemStateTable.key,
          set: { value: true, description: "Owner-requested removal; prevents reseeding the deleted database chart" },
        });
    });

    deletionPreviews.delete(parsed.data.previewToken);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, deleted: preview.counts });
  } catch (err) {
    logger.error({ name: err instanceof Error ? err.name : "Error" }, "owner data deletion failed");
    res.status(500).json({ ok: false, error: "owner-data-delete-failed" });
  }
});

export default router;
