import { Router, type IRouter } from "express";
import {
  runSacredGrandConference,
  getCurrentSession,
  getConferenceAgents,
  getCycleThemes,
  generateBibleFromCycles,
  getAllBuildDiagrams,
} from "../lib/sacred-grand-conference-engine";
import {
  SACRED_CATEGORIES,
  SACRED_KNOWLEDGE_ENTRIES,
  getKnowledgeByCategory,
  getKnowledgeByClassification,
  getKnowledgeByDepth,
  searchKnowledge,
  getVaultStats,
} from "../lib/sacred-knowledge-vault";
import { getCorpusStats, getCorpusSize, getDomainClusters, queryCorpus, runFullCorpusAudit, type CorpusCategory } from "../lib/knowledge-corpus-index";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/sacred-conference/status", async (_req, res) => {
  try {
    const session = getCurrentSession();
    if (!session) {
      return res.json({
        status: "not-started",
        message: "No Sacred Grand Conference has been convened yet. POST to /api/sacred-conference/run to begin.",
        agents: getConferenceAgents().length,
        themes: getCycleThemes().length,
      });
    }
    return res.json({
      status: session.status,
      sessionId: session.sessionId,
      totalCycles: session.totalCycles,
      completedCycles: session.completedCycles,
      totalImprovements: session.totalImprovements,
      totalInventions: session.totalInventions,
      totalKnowledgeGained: session.totalKnowledgeGained,
      bibleChaptersGenerated: session.bibleChaptersGenerated,
      agentCount: session.agentCount,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get sacred conference status");
    return res.status(500).json({ error: "Failed to get status" });
  }
});

router.post("/sacred-conference/run", async (req, res) => {
  try {
    const cycles = Math.min(Math.max(Number(req.body?.cycles) || 10, 1), 10);
    logger.info({ cycles }, "Running Sacred Grand Conference");
    const session = await runSacredGrandConference(cycles);
    return res.json(session);
  } catch (err) {
    logger.error({ err }, "Failed to run sacred conference");
    return res.status(500).json({ error: "Failed to run conference" });
  }
});

router.get("/sacred-conference/session", async (_req, res) => {
  try {
    const session = getCurrentSession();
    if (!session) {
      return res.json({ status: "not-started", cycles: [], totalImprovements: 0, totalInventions: 0, totalKnowledgeGained: 0, bibleChaptersGenerated: 0, agentCount: 0 });
    }
    return res.json(session);
  } catch (err) {
    return res.status(500).json({ error: "Failed to get session" });
  }
});

router.get("/sacred-conference/cycle/:cycleNumber", async (req, res) => {
  try {
    const session = getCurrentSession();
    if (!session) return res.status(404).json({ error: "No session found" });
    const num = Number(req.params.cycleNumber);
    const cycle = session.cycles.find(c => c.cycleNumber === num);
    if (!cycle) return res.status(404).json({ error: `Cycle ${num} not found` });
    return res.json(cycle);
  } catch (err) {
    return res.status(500).json({ error: "Failed to get cycle" });
  }
});

router.get("/sacred-conference/agents", async (_req, res) => {
  return res.json({ agents: getConferenceAgents(), count: getConferenceAgents().length });
});

router.get("/sacred-conference/society", async (_req, res) => {
  const { getFullSovereignSociety, getSocietyStats } = await import("../lib/sovereign-society");
  return res.json({ stats: getSocietyStats(), members: getFullSovereignSociety() });
});

router.get("/sacred-conference/cycle/:cycleNumber/votes", async (req, res) => {
  const session = getCurrentSession();
  if (!session) return res.status(404).json({ error: "No session — run /api/sacred-conference/run first." });
  const num = Number(req.params.cycleNumber);
  const cycle = session.cycles.find(c => c.cycleNumber === num);
  if (!cycle) return res.status(404).json({ error: `Cycle ${num} not found` });
  return res.json({
    cycleNumber: num,
    voteSummary: cycle.voteSummary,
    improvementBallots: cycle.improvementBallots,
    inventionBallots:   cycle.inventionBallots,
  });
});

router.get("/sacred-conference/themes", async (_req, res) => {
  return res.json({ themes: getCycleThemes() });
});

router.get("/sacred-conference/bible", async (_req, res) => {
  try {
    const bible = generateBibleFromCycles();
    if (!bible) {
      return res.json({ status: "not-generated", chapters: [], message: "Run the Sacred Grand Conference first to generate the Living Bible." });
    }
    return res.json(bible);
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate bible" });
  }
});

router.get("/sacred-conference/diagrams", async (_req, res) => {
  try {
    const diagrams = getAllBuildDiagrams();
    return res.json({ diagrams, count: diagrams.length });
  } catch (err) {
    return res.status(500).json({ error: "Failed to get diagrams" });
  }
});

router.get("/sacred-knowledge/categories", async (_req, res) => {
  return res.json({ categories: SACRED_CATEGORIES, count: Object.keys(SACRED_CATEGORIES).length });
});

router.get("/sacred-knowledge/all", async (_req, res) => {
  return res.json({ entries: SACRED_KNOWLEDGE_ENTRIES, count: SACRED_KNOWLEDGE_ENTRIES.length });
});

router.get("/sacred-knowledge/vault-stats", async (_req, res) => {
  return res.json(getVaultStats());
});

router.get("/sacred-knowledge/category/:category", async (req, res) => {
  const entries = getKnowledgeByCategory(req.params.category);
  return res.json({ entries, count: entries.length });
});

router.get("/sacred-knowledge/classification/:classification", async (req, res) => {
  const entries = getKnowledgeByClassification(req.params.classification);
  return res.json({ entries, count: entries.length });
});

router.get("/sacred-knowledge/depth/:depth", async (req, res) => {
  const validDepths = ["surface", "hidden", "deep"] as const;
  const depth = req.params.depth;
  if (!validDepths.includes(depth as typeof validDepths[number])) {
    return res.status(400).json({ error: `Invalid depth. Must be one of: ${validDepths.join(", ")}` });
  }
  const entries = getKnowledgeByDepth(depth as typeof validDepths[number]);
  return res.json({ entries, count: entries.length });
});

router.get("/sacred-knowledge/search", async (req, res) => {
  const q = String(req.query.q || "");
  if (!q) return res.status(400).json({ error: "Query parameter 'q' is required" });
  const entries = searchKnowledge(q);
  return res.json({ entries, count: entries.length, query: q });
});

router.get("/knowledge-corpus/stats", async (_req, res) => {
  try {
    return res.json({
      totalEntries: getCorpusSize(),
      stats: getCorpusStats(),
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to get corpus stats" });
  }
});

router.get("/knowledge-corpus/domains", async (_req, res) => {
  try {
    const clusters = getDomainClusters();
    return res.json({ clusters, count: Object.keys(clusters).length });
  } catch (err) {
    return res.status(500).json({ error: "Failed to get domain clusters" });
  }
});

const VALID_CORPUS_CATEGORIES: readonly CorpusCategory[] = ["subject", "sacred-entry", "declassified", "subcategory", "synthesis", "harmonic", "agent-specialty", "file-registry", "wiki-topic", "adversarial", "identity-memory"];

router.get("/knowledge-corpus/query", async (req, res) => {
  try {
    const tags = req.query.tags ? String(req.query.tags).split(",") : undefined;
    const domain = req.query.domain ? String(req.query.domain) : undefined;
    const rawCategory = req.query.category ? String(req.query.category) : undefined;
    const rawLimit = req.query.limit ? Number(req.query.limit) : 50;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 50;

    let category: CorpusCategory | undefined;
    if (rawCategory) {
      if (!VALID_CORPUS_CATEGORIES.includes(rawCategory as CorpusCategory)) {
        return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CORPUS_CATEGORIES.join(", ")}` });
      }
      category = rawCategory as CorpusCategory;
    }

    const results = queryCorpus({ tags, domain, category, limit });
    return res.json({ entries: results, count: results.length });
  } catch (err) {
    return res.status(500).json({ error: "Failed to query corpus" });
  }
});

router.get("/knowledge-corpus/audit", async (_req, res) => {
  try {
    const findings = runFullCorpusAudit();
    return res.json({
      findings,
      count: findings.length,
      summary: {
        critical: findings.filter(f => f.severity === "critical").length,
        major: findings.filter(f => f.severity === "major").length,
        moderate: findings.filter(f => f.severity === "moderate").length,
        minor: findings.filter(f => f.severity === "minor").length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to run corpus audit" });
  }
});

export default router;
