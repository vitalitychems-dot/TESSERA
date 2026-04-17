import { Router, type IRouter } from "express";
import { promises as fs } from "fs";
import path from "path";
import {
  getRealityAudit,
  getRealityFlag,
  persistRealityAuditSnapshot,
  listRealityAuditSnapshots,
} from "../lib/reality-audit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function requireAdmin(req: import("express").Request, res: import("express").Response): boolean {
  const token = process.env["ADMIN_TOKEN"];
  if (!token) return true;
  const header = req.header("x-admin-token") ?? "";
  if (header !== token) {
    res.status(403).json({ ok: false, error: "Admin token required" });
    return false;
  }
  return true;
}

router.get("/reality-audit", async (_req, res) => {
  try {
    const audit = await getRealityAudit();
    res.json({ ok: true, ...audit });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/reality-audit/summary", async (_req, res) => {
  try {
    const audit = await getRealityAudit();
    res.json({
      ok: true,
      scannedAt: audit.scannedAt,
      summary: audit.summary,
      topFiveByImpact: audit.topFiveByImpact.map(f => ({
        id: f.id,
        file: f.file,
        status: f.status,
        impactScore: f.impactScore,
        pattern: f.pattern,
      })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/reality-audit/flag/:id", (req, res) => {
  const flag = getRealityFlag(req.params.id);
  res.json({ ok: true, id: req.params.id, flag });
});

router.post("/reality-audit/snapshot", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const trigger = typeof req.body?.trigger === "string" ? req.body.trigger : "manual";
    const snap = await persistRealityAuditSnapshot(
      (trigger as "manual" | "startup" | "scheduled" | "post-council") ?? "manual",
    );
    res.json({ ok: true, snapshot: snap });
  } catch (err) {
    logger.error({ err }, "reality-audit snapshot failed");
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/reality-audit/snapshots", async (_req, res) => {
  try {
    const rows = await listRealityAuditSnapshots(100);
    res.json({ ok: true, snapshots: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/reality-audit/snapshots/:id/payload", async (req, res) => {
  try {
    const rows = await listRealityAuditSnapshots(200);
    const row = rows.find((r) => r.id === Number(req.params.id));
    if (!row) return res.status(404).json({ ok: false, error: "snapshot not found" });
    const cwd = process.cwd();
    const root = cwd.includes("/artifacts/") ? path.resolve(cwd, "../..") : cwd;
    const full = path.join(root, row.jsonPath);
    const body = await fs.readFile(full, "utf-8");
    res.type("application/json").send(body);
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
