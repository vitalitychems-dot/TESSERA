import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messageFeedbackTable } from "@workspace/db/schema";
import { desc, sql, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAdminSession } from "../lib/sovereign-admin";
import { z } from "zod/v4";

const router: IRouter = Router();
router.use(requireAdminSession);

const feedbackSchema = z.object({
  conversationId: z.number().int().positive().nullable().optional(),
  messageId: z.number().int().positive().nullable().optional(),
  rating: z.enum(["up", "down"]),
});

router.post("/feedback", async (req, res) => {
  try {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "rating must be 'up' or 'down'" });
    }
    const { conversationId, messageId, rating } = parsed.data;

    const [row] = await db.insert(messageFeedbackTable).values({
      conversationId: conversationId ?? null,
      messageId: messageId ?? null,
      clientMsgKey: null,
      rating,
      reason: null,
      userQuery: null,
      responseExcerpt: null,
      modelTier: null,
      routerReason: null,
      metadata: null,
    }).returning();

    return res.json({ ok: true, id: row.id });
  } catch (err) {
    logger.error({ name: err instanceof Error ? err.name : "Error" }, "feedback: insert failed");
    return res.status(500).json({ error: "feedback-insert-failed" });
  }
});

router.get("/feedback/stats", async (_req, res) => {
  try {
    const rows = await db.select({
      rating: messageFeedbackTable.rating,
      count: sql<number>`count(*)::int`,
    }).from(messageFeedbackTable).groupBy(messageFeedbackTable.rating);

    const recent = await db.select().from(messageFeedbackTable)
      .orderBy(desc(messageFeedbackTable.createdAt))
      .limit(20);

    const stats: Record<string, number> = { up: 0, down: 0 };
    for (const r of rows) stats[r.rating] = r.count;
    const total = stats.up + stats.down;
    const satisfaction = total > 0 ? stats.up / total : null;

    return res.json({ stats, total, satisfaction, recent });
  } catch (err) {
    return res.status(500).json({ error: "feedback-stats-failed" });
  }
});

router.get("/feedback/by-conversation/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
    const rows = await db.select().from(messageFeedbackTable)
      .where(eq(messageFeedbackTable.conversationId, id))
      .orderBy(desc(messageFeedbackTable.createdAt));
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "feedback-fetch-failed" });
  }
});

export default router;
