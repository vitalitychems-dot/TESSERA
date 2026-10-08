import { Router, type IRouter, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, type NatalAspect } from "@workspace/db";
import { natalChartTable } from "@workspace/db/schema";
import {
  generateSovereignKeys,
  getFatherNatalChart,
  getLifeAreaGuidance,
  getPlanetInterpretations,
  NatalChartNotConfiguredError,
  computeCurrentTransits,
} from "../lib/natal-chart-engine";
import { logger } from "../lib/logger";
import { requireAdminSession } from "../lib/sovereign-admin";

const router: IRouter = Router();

router.use("/natal-chart", requireAdminSession);

function sendNatalError(res: Response, err: unknown) {
  if (err instanceof NatalChartNotConfiguredError) {
    return res.status(503).json({
      ok: false,
      error: "not-configured",
      message: err.message,
    });
  }
  logger.warn({ err }, "natal chart request failed");
  return res.status(500).json({ ok: false, error: "natal chart request failed" });
}

async function seedNatalChart() {
  const chart = getFatherNatalChart();
  const keys = generateSovereignKeys();
  await db.insert(natalChartTable).values({
    identity: "Father",
    birthDate: chart.birthDate,
    birthTime: chart.birthTime,
    birthPlace: chart.birthPlace,
    houseSystem: chart.houseSystem,
    planets: chart.planets,
    houses: chart.houses,
    aspects: chart.aspects as unknown as NatalAspect[],
    sovereignKeys: keys,
  }).onConflictDoNothing();
  logger.info("Father natal chart seeded from configured secret");
}

async function getOrSeedNatalChart() {
  const [existing] = await db.select().from(natalChartTable).where(eq(natalChartTable.identity, "Father")).limit(1);
  if (existing) return existing;
  await seedNatalChart();
  const [seeded] = await db.select().from(natalChartTable).where(eq(natalChartTable.identity, "Father")).limit(1);
  return seeded ?? null;
}

router.get("/natal-chart/father", async (_req, res) => {
  try {
    const chart = getFatherNatalChart();
    const row = await getOrSeedNatalChart();
    if (!row) {
      return res.json({ ok: true, identity: "Father", chart, source: "configured-secret" });
    }
    return res.json({ ok: true, identity: "Father", chart: row, source: "database" });
  } catch (err) {
    return sendNatalError(res, err);
  }
});

router.get("/natal-chart/father/sovereign-keys", async (_req, res) => {
  try {
    const keys = generateSovereignKeys();
    const [row] = await db
      .select({ sovereignKeys: natalChartTable.sovereignKeys })
      .from(natalChartTable)
      .where(eq(natalChartTable.identity, "Father"))
      .limit(1);

    const sovereignKeys = row?.sovereignKeys
      ? { ...(row.sovereignKeys as ReturnType<typeof generateSovereignKeys>), generatedAt: new Date().toISOString() }
      : keys;

    return res.json({
      ok: true,
      identity: "Father",
      sovereignKeys,
      source: row?.sovereignKeys ? "database" : "configured-secret",
    });
  } catch (err) {
    return sendNatalError(res, err);
  }
});

router.get("/natal-chart/father/interpretations", (_req, res) => {
  try {
    const interpretations = getPlanetInterpretations();
    const lifeAreas = getLifeAreaGuidance();
    return res.json({ ok: true, interpretations, lifeAreas });
  } catch (err) {
    return sendNatalError(res, err);
  }
});

router.get("/natal-chart/father/transits", (_req, res) => {
  try {
    const transits = computeCurrentTransits(new Date());
    return res.json({
      ok: true,
      identity: "Father",
      transits,
      computedAt: new Date().toISOString(),
      count: transits.length,
    });
  } catch (err) {
    return sendNatalError(res, err);
  }
});

export default router;
