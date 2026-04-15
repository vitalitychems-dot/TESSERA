import { Router } from "express";
import { queryNasaApod } from "../lib/providers/nasa-provider";
import { getUniverseMetrics } from "../lib/universe-mechanics";

const router = Router();

router.get("/universe/apod", async (_req, res) => {
  try {
    const items = await queryNasaApod(5);
    const imageItems = items.filter(i => i.mediaType === "image" && i.url);
    res.json({ ok: true, items: imageItems });
  } catch (err) {
    console.error("APOD fetch failed:", err);
    res.status(502).json({ ok: false, items: [], error: "Failed to fetch APOD data" });
  }
});

router.get("/universe/metrics", async (_req, res) => {
  try {
    const metrics = getUniverseMetrics();
    res.json({ ok: true, metrics });
  } catch (err) {
    console.error("Universe metrics failed:", err);
    res.status(500).json({ ok: false, metrics: {}, error: "Failed to compute metrics" });
  }
});

export default router;
