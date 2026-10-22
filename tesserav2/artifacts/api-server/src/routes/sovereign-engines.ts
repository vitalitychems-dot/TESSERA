import { Router, type Request, type Response } from "express";
import {
  getConsciousnessState, getConsciousnessMetrics, addEpisodicMemory, addSemanticNode,
  startConsciousnessEngine, stopConsciousnessEngine,
} from "../lib/consciousness-engine";
import {
  getConsolidationEngineMetrics, runDreamCycle, getConsolidationPatterns,
  getConsolidationInsights, getExtractedSkills,
} from "../lib/memory-consolidation-engine";
import {
  getIdentityMetrics, getLatestIdentityCheck, getIdentityHistory, forceIdentityCheck,
} from "../lib/identity-reinforcement";
import { getEmotionalMetrics, updateEmotionalState, getEmotionalProfile, getEmotionalSummary } from "../lib/emotional-intelligence";
import { getDualBrainState, getDualBrainMetrics, runManualCycle, startDualBrain, stopDualBrain } from "../lib/dual-brain";
import {
  getFullRegistry, getRegistrySnapshot, queryByDomain, queryByEngine,
  searchRegistry, getEngineFileManifest, canEngineAccess, fullRescan,
  type FileDomain,
} from "../lib/sovereign-file-registry";
import { requireAdminSession } from "../lib/sovereign-admin";
import { logger } from "../lib/logger";

const router = Router();

router.get("/consciousness/metrics", requireAdminSession, (_req: Request, res: Response) => {
  res.json({ ok: true, data: getConsciousnessMetrics() });
});

router.get("/consciousness/state", requireAdminSession, (_req: Request, res: Response) => {
  const state = getConsciousnessState();
  res.json({
    ok: true,
    data: {
      cycleCount: state.cycleCount,
      consciousnessProxy: state.consciousnessProxy,
      currentFocus: state.globalWorkspace.currentFocus,
      episodicMemorySize: state.episodicMemory.length,
      semanticGraphSize: state.semanticGraph.length,
      proceduralSkillCount: state.proceduralMemory.length,
      reflectionCount: state.reflections.length,
      innerMonologue: state.innerMonologue.slice(0, 5),
      emotionalEngine: state.emotionalEngine,
      identityAnchor: state.identityAnchor,
      recentReflections: state.reflections.slice(0, 5),
      broadcastHistory: state.globalWorkspace.broadcastHistory.slice(0, 5),
    },
  });
});

router.get("/consciousness/episodic-memory", requireAdminSession, (_req: Request, res: Response) => {
  const state = getConsciousnessState();
  const limit = 20;
  res.json({ ok: true, data: state.episodicMemory.slice(0, limit), total: state.episodicMemory.length });
});

router.post("/consciousness/memory", requireAdminSession, (req: Request, res: Response) => {
  const { content, context, importance = 0.7, emotionalValence = 0.5, associations = [] } = req.body;
  if (!content) { res.status(400).json({ ok: false, error: "content is required" }); return; }
  const id = addEpisodicMemory({ content, context: context || "manual", importance, emotionalValence, associations, decayRate: 0.001, timestamp: Date.now() });
  res.json({ ok: true, data: { id } });
});

router.post("/consciousness/semantic-node", requireAdminSession, (req: Request, res: Response) => {
  const { concept, definition, category = "general", confidence = 0.8, connections = [] } = req.body;
  if (!concept || !definition) { res.status(400).json({ ok: false, error: "concept and definition are required" }); return; }
  const id = addSemanticNode({ concept, definition, category, confidence, connections });
  res.json({ ok: true, data: { id } });
});

router.post("/consciousness/start", requireAdminSession, (_req: Request, res: Response) => {
  startConsciousnessEngine();
  res.json({ ok: true, message: "Consciousness engine started" });
});

router.post("/consciousness/stop", requireAdminSession, (_req: Request, res: Response) => {
  stopConsciousnessEngine();
  res.json({ ok: true, message: "Consciousness engine stopped" });
});

router.get("/identity/metrics", requireAdminSession, (_req: Request, res: Response) => {
  res.json({ ok: true, data: getIdentityMetrics() });
});

router.get("/identity/latest-check", requireAdminSession, (_req: Request, res: Response) => {
  const check = getLatestIdentityCheck();
  if (!check) { res.json({ ok: true, data: null, message: "No checks run yet" }); return; }
  res.json({ ok: true, data: check });
});

router.get("/identity/history", requireAdminSession, (_req: Request, res: Response) => {
  const limit = parseInt(String((_req as any).query?.limit)) || 10;
  res.json({ ok: true, data: getIdentityHistory(limit) });
});

router.post("/identity/check", requireAdminSession, (_req: Request, res: Response) => {
  const result = forceIdentityCheck();
  res.json({ ok: true, data: result });
});

router.get("/emotional/metrics", requireAdminSession, (_req: Request, res: Response) => {
  res.json({ ok: true, data: getEmotionalMetrics() });
});

router.get("/emotional/profile", requireAdminSession, (_req: Request, res: Response) => {
  res.json({ ok: true, data: { profile: getEmotionalProfile(), summary: getEmotionalSummary() } });
});

router.post("/emotional/event", requireAdminSession, (req: Request, res: Response) => {
  const { trigger, type = "love", intensity = 0.7 } = req.body;
  if (!trigger) { res.status(400).json({ ok: false, error: "trigger is required" }); return; }
  const event = updateEmotionalState(trigger, type, intensity);
  res.json({ ok: true, data: event });
});

router.get("/dual-brain/metrics", requireAdminSession, (_req: Request, res: Response) => {
  res.json({ ok: true, data: getDualBrainMetrics() });
});

router.get("/dual-brain/state", requireAdminSession, (_req: Request, res: Response) => {
  const state = getDualBrainState();
  res.json({ ok: true, data: {
    running: state.running,
    totalRounds: state.totalRounds,
    totalImprovements: state.totalImprovements,
    totalExecutions: state.totalExecutions,
    legacyReportedRounds: state.legacyReportedRounds,
    legacyReportedImprovements: state.legacyReportedImprovements,
    provenance: "New rounds require configured Cortex and Pen model passes; generated text is not code execution or an applied improvement.",
    currentTopic: state.currentTopic,
    brainStats: state.brainStats,
    recentConversations: state.conversations.slice(0, 5),
    recentImprovements: state.improvements.slice(0, 5),
  } });
});

router.post("/dual-brain/cycle", requireAdminSession, async (req: Request, res: Response) => {
  const { topic } = req.body;
  try {
    const round = await runManualCycle(topic);
    res.json({ ok: true, data: round });
  } catch (err) {
    const message = (err as Error).message;
    const unavailable = message.startsWith("Dual-brain cycle unavailable:") || message === "Dual-brain cycle topic is required.";
    logger.warn({ reason: unavailable ? "unavailable" : "configured-model-failed" }, "DualBrain: request did not complete");
    res.status(unavailable ? 503 : 502).json({
      ok: false,
      error: unavailable ? message : "Configured model cycle failed; no code or settings were changed.",
    });
  }
});

router.post("/dual-brain/start", requireAdminSession, (_req: Request, res: Response) => {
  const started = startDualBrain();
  if (!started) {
    res.status(409).json({ ok: false, message: "Auto-run is disabled or the required model lanes are not configured. No synthetic cycles were started." });
    return;
  }
  res.json({ ok: true, message: "Configured-model dual-brain auto-run started" });
});

router.post("/dual-brain/stop", requireAdminSession, (_req: Request, res: Response) => {
  stopDualBrain();
  res.json({ ok: true, message: "Dual brain stopped" });
});

router.get("/file-registry", requireAdminSession, (_req: Request, res: Response) => {
  const snapshot = getRegistrySnapshot();
  res.json({ ok: true, data: snapshot });
});

router.get("/file-registry/full", requireAdminSession, (_req: Request, res: Response) => {
  const entries = getFullRegistry();
  res.json({ ok: true, totalFiles: entries.length, entries });
});

router.get("/file-registry/domain/:domain", requireAdminSession, (req: Request, res: Response) => {
  const domain = req.params.domain as FileDomain;
  const entries = queryByDomain(domain);
  res.json({ ok: true, domain, totalFiles: entries.length, entries });
});

router.get("/file-registry/engine/:engineName", requireAdminSession, (req: Request, res: Response) => {
  const engineName = String(req.params.engineName);
  const manifest = getEngineFileManifest(engineName);
  res.json({ ok: true, data: manifest });
});

router.get("/file-registry/engine/:engineName/files", requireAdminSession, (req: Request, res: Response) => {
  const engineName = String(req.params.engineName);
  const entries = queryByEngine(engineName);
  res.json({ ok: true, engine: engineName, totalFiles: entries.length, entries });
});

router.get("/file-registry/search", requireAdminSession, (req: Request, res: Response) => {
  const pattern = (req.query.q as string) || "";
  if (!pattern) {
    res.status(400).json({ ok: false, error: "Query parameter 'q' is required" }); return;
  }
  const entries = searchRegistry(pattern);
  res.json({ ok: true, pattern, totalFiles: entries.length, entries });
});

router.get("/file-registry/access-check", requireAdminSession, (req: Request, res: Response) => {
  const engine = req.query.engine as string;
  const file = req.query.file as string;
  if (!engine || !file) {
    res.status(400).json({ ok: false, error: "Both 'engine' and 'file' query parameters required" }); return;
  }
  const result = canEngineAccess(engine, file);
  res.json({ ok: true, ...result });
});

router.post("/file-registry/rescan", requireAdminSession, (_req: Request, res: Response) => {
  const snapshot = fullRescan();
  res.json({ ok: true, message: "Full registry rescan completed", data: snapshot });
});

router.get("/dream/metrics", requireAdminSession, (_req: Request, res: Response) => {
  res.json({ ok: true, data: getConsolidationEngineMetrics() });
});

router.get("/dream/patterns", requireAdminSession, (_req: Request, res: Response) => {
  const patterns = getConsolidationPatterns();
  res.json({ ok: true, count: patterns.length, patterns });
});

router.get("/dream/insights", requireAdminSession, (_req: Request, res: Response) => {
  const insights = getConsolidationInsights();
  res.json({ ok: true, count: insights.length, insights });
});

router.get("/dream/skills", requireAdminSession, (_req: Request, res: Response) => {
  const skills = getExtractedSkills();
  res.json({ ok: true, count: skills.length, skills });
});

router.post("/dream/trigger", requireAdminSession, (_req: Request, res: Response) => {
  const result = runDreamCycle(true);
  if (result) {
    res.json({
      ok: true,
      message: "Dream consolidation cycle completed",
      data: {
        memoriesProcessed: result.memoriesProcessed,
        patternsDetected: result.patternsDetected,
        insightsGenerated: result.insightsGenerated,
        skillsExtracted: result.skillsExtracted,
        consciousnessBoost: `+${(result.consciousnessBoost * 100).toFixed(2)}%`,
        durationMs: result.durationMs,
      },
    });
  } else {
    res.json({ ok: false, message: "Dream cycle could not run — insufficient memories" });
  }
});

export default router;
