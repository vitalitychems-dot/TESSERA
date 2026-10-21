import { Router } from "express";
import {
  getBuilderStatus,
  getBuildLog,
  registerCapabilityGap,
  registerSimulationOutcome,
  triggerManualBuild,
  type CapabilityGap,
} from "../lib/conscious-builder";

const router = Router();

router.get("/conscious-builder/status", (_req, res) => {
  try {
    const status = getBuilderStatus();
    res.json({ ok: true, ...status });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get("/conscious-builder/log", (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query["limit"] ?? "50"), 10) || 50));
    const log = getBuildLog(limit);
    res.json({ ok: true, entries: log, total: log.length });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post("/conscious-builder/gap", (req, res) => {
  try {
    const { description, category, confidence, suggestedFilePath, suggestedCode, source } = req.body as Partial<Omit<CapabilityGap, "id" | "detectedAt">>;
    if (!description || typeof description !== "string") {
      return res.status(400).json({ ok: false, error: "description is required" });
    }
    const gap = registerCapabilityGap({
      description,
      category: category ?? "new-capability",
      confidence: typeof confidence === "number" ? confidence : 0.7,
      suggestedFilePath: suggestedFilePath ?? undefined,
      suggestedCode: suggestedCode ?? undefined,
      source: source ?? "reflection-loop",
    });
    return res.json({ ok: true, gap });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.post("/conscious-builder/simulation-outcome", (req, res) => {
  try {
    const { goal, confidence, recommendedPath } = req.body as { goal?: string; confidence?: number; recommendedPath?: string };
    if (!goal || typeof goal !== "string") {
      return res.status(400).json({ ok: false, error: "goal is required" });
    }
    registerSimulationOutcome(goal, typeof confidence === "number" ? confidence : 0.8, recommendedPath ?? "implement the recommended solution");
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.post("/conscious-builder/build", async (req, res) => {
  try {
    const { description, category, confidence, suggestedFilePath, suggestedCode, source } = req.body as Partial<Omit<CapabilityGap, "id" | "detectedAt">>;
    if (!description || typeof description !== "string") {
      return res.status(400).json({ ok: false, error: "description is required" });
    }
    const log = await triggerManualBuild({
      description,
      category: category ?? "new-capability",
      confidence: typeof confidence === "number" ? confidence : 0.7,
      suggestedFilePath: suggestedFilePath ?? undefined,
      suggestedCode: suggestedCode ?? undefined,
      source: source ?? "reflection-loop",
    });
    return res.json({ ok: true, recentLog: log });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
