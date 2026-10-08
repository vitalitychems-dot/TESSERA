import { Router } from "express";
import {
  getEvolutionStatus,
  getEvolutionLog,
  getFileQualityScores,
  scoreCodeQuality,
  abTestCode,
} from "../lib/self-evolution";

const router = Router();

router.get("/evolution/status", (_req, res) => {
  try {
    const status = getEvolutionStatus();
    const qualityScores = getFileQualityScores(10);
    res.json({
      ...status,
      topFileScores: qualityScores.slice(0, 5),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/evolution/log", (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query["limit"] ?? "50"), 10) || 50));
    const log = getEvolutionLog(limit);
    res.json({ entries: log, total: log.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/evolution/quality", (_req, res) => {
  try {
    const scores = getFileQualityScores(30);
    const valid = scores.filter((s) => !("error" in s)) as Array<{ overall: number; file: string; complexity: number; readability: number; maintainability: number; duplication: number; factors: string[] }>;
    const avg = valid.length > 0 ? Math.round(valid.reduce((s, q) => s + q.overall, 0) / valid.length) : 0;
    res.json({
      files: scores,
      avgQuality: avg,
      analyzedAt: Date.now(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/evolution/quality/file", (req, res) => {
  try {
    const filePath = String(req.query["path"] ?? "");
    if (!filePath) return res.status(400).json({ error: "path query param required" });
    const score = scoreCodeQuality(filePath);
    if ("error" in score) return res.status(404).json(score);
    return res.json(score);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.post("/evolution/ab-test", (req, res) => {
  try {
    const { filePath, versionA, versionB, descriptionA, descriptionB } = req.body as {
      filePath: string;
      versionA: string;
      versionB: string;
      descriptionA: string;
      descriptionB: string;
    };
    if (!filePath || !versionA || !versionB) {
      return res.status(400).json({ error: "filePath, versionA, versionB are required" });
    }
    const result = abTestCode(
      filePath,
      versionA,
      versionB,
      descriptionA || "Version A",
      descriptionB || "Version B",
    );
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
