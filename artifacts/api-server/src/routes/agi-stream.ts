/**
 * #7: SSE stream of global-workspace broadcasts.
 * GET /api/agi/stream sends one `workspace` event per broadcast winner.
 * Kept separate from routes/agi.ts so it has no DB import.
 */
import { Router } from "express";
import { subscribeWorkspace } from "../lib/agi/global-workspace.js";

const router = Router();

router.get("/agi/stream", (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(": connected\n\n");
  const off = subscribeWorkspace((m) => {
    res.write(`event: workspace\nid: ${m.id}\ndata: ${JSON.stringify({ id: m.id, at: m.at, from: m.from, topic: m.topic, attention: m.attention })}\n\n`);
  });
  req.on("close", () => { off(); });
});

export default router;
