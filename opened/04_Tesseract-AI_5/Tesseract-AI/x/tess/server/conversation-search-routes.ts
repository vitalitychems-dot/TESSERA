import { Router, type Request, type Response } from "express";
import { pool } from "./db";

const router = Router();

router.get("/api/conversations/search", async (req: Request, res: Response) => {
  try {
    const query = (req.query.query as string || "").trim();
    if (query.length < 2) {
      return res.json([]);
    }

    const searchPattern = `%${query}%`;

    const result = await pool.query(
      `SELECT DISTINCT ON (c.id)
        c.id as "conversationId",
        c.title,
        m.content,
        m.role,
        m.created_at as "createdAt"
      FROM conversations c
      JOIN messages m ON m.conversation_id = c.id
      WHERE m.content ILIKE $1 OR c.title ILIKE $1
      ORDER BY c.id DESC, m.created_at DESC
      LIMIT 20`,
      [searchPattern]
    );

    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/api/conversations/recent", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.created_at as "createdAt",
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as "messageCount"
      FROM conversations c
      ORDER BY c.created_at DESC
      LIMIT 50`
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/api/conversations/stats", async (_req: Request, res: Response) => {
  try {
    const [totalConvs, totalMsgs, todayMsgs] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM conversations"),
      pool.query("SELECT COUNT(*) as count FROM messages"),
      pool.query("SELECT COUNT(*) as count FROM messages WHERE created_at > NOW() - INTERVAL '24 hours'"),
    ]);

    res.json({
      totalConversations: parseInt(totalConvs.rows[0]?.count || "0"),
      totalMessages: parseInt(totalMsgs.rows[0]?.count || "0"),
      todayMessages: parseInt(todayMsgs.rows[0]?.count || "0"),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
