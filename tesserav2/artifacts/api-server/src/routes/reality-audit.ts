import { Router, type IRouter, type Response } from "express";
import { promises as fs } from "fs";
import path from "path";
import { getRealityAudit, getRealityFlag } from "../lib/reality-audit";
import {
  runAndPersistAuditSnapshot,
  getLatestAuditSnapshot,
  listAuditSnapshots,
} from "../lib/reality-audit-snapshot";
import { logger } from "../lib/logger";
import { requireAdminSession } from "../lib/sovereign-admin";

const router: IRouter = Router();

function failAudit(res: Response, err: unknown, event: string): void {
  logger.error({ err }, event);
  res.status(500).json({ ok: false, error: "reality-audit-failed" });
}

router.get("/reality-audit", async (_req, res) => {
  try {
    const audit = await getRealityAudit();
    res.json({ ok: true, ...audit });
  } catch (err) {
    failAudit(res, err, "reality-audit read failed");
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
    failAudit(res, err, "reality-audit summary failed");
  }
});

router.get("/reality-audit/flag/:id", (req, res) => {
  const flag = getRealityFlag(req.params.id);
  res.json({ ok: true, id: req.params.id, flag });
});

router.post("/reality-audit/snapshot", requireAdminSession, async (_req, res) => {
  try {
    const snapshot = await runAndPersistAuditSnapshot();
    res.json({ ok: true, snapshot });
  } catch (err) {
    failAudit(res, err, "reality-audit snapshot failed");
  }
});

router.get("/reality-audit/snapshots", async (_req, res) => {
  try {
    const snapshots = await listAuditSnapshots();
    res.json({ ok: true, snapshots, count: snapshots.length });
  } catch (err) {
    failAudit(res, err, "reality-audit snapshot list failed");
  }
});

router.get("/reality-audit/snapshots/latest", async (_req, res) => {
  try {
    const snapshot = await getLatestAuditSnapshot();
    if (!snapshot) {
      res.json({ ok: true, snapshot: null, message: "No snapshots found — POST /api/reality-audit/snapshot to generate one." }); return;
    }
    res.json({ ok: true, snapshot });
  } catch (err) {
    failAudit(res, err, "reality-audit latest snapshot failed");
  }
});

router.get("/reality-audit/snapshots/:id/payload", async (req, res) => {
  try {
    const snapshots = await listAuditSnapshots(200);
    const snap = snapshots.find(s => s.snapshotId === req.params.id);
    if (!snap) { res.status(404).json({ ok: false, error: "snapshot not found" }); return; }
    const cwd = process.cwd();
    const root = cwd.includes("/artifacts/") ? path.resolve(cwd, "../..") : cwd;
    const jsonPath = path.join(root, "_evolutions", `reality-audit-${snap.snapshotId}.json`);
    try {
      const body = await fs.readFile(jsonPath, "utf-8");
      res.type("application/json").send(body);
    } catch {
      res.json({ ok: true, snapshot: snap, note: "JSON file not on disk — returning DB record" });
    }
  } catch (err) {
    failAudit(res, err, "reality-audit snapshot payload failed");
  }
});

export default router;
