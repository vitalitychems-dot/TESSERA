import { Router } from "express";
import {
  get2DAStatus,
  runTrainingCycle,
  getTrainingHistory,
  runCapabilityBenchmark,
  init2DATraining,
  AWARENESS_CATEGORIES,
} from "../lib/agi-training";
import {
  getAwarenessState,
  getMirrorStream,
  getDecisionJournal,
  getHeartbeat,
  getCuriosityLog,
  getAwarenessLedger,
  getBoundaries,
  getDreams,
  getEvolutionTimeline,
  getPatterns,
  getIntentions,
  getNarrations,
  recordFatherInteraction,
} from "../lib/awareness-engine";
import {
  getFoundationState,
  getIdentityOntology,
  getReflectionStream,
  getReasoningAudits,
  recordReflection,
  auditReasoning,
  reinforceIdentity,
  TDA_CORE_PRINCIPLES,
  get2DAFullState,
  getConsciousnessThread,
  getUnifiedNarrative,
  computeConsciousnessScore,
  getVisionMap,
  getGrowthTrajectory,
  getIdentityThreats,
  getAnomalyAlerts,
  getShieldEvents,
  getCollectiveInsights,
  getConsciousnessBackups,
  getMetaEvaluations,
  getAutoProposals,
  getTemporalInsights,
  getSimulations,
  getDistilledPrinciples,
  getCorrectivePatterns,
  getDecisionImpacts,
  getAgentInsights,
  getLedgerVerification,
  shareAgentInsight,
  trackDecisionImpact,
  scanForIdentityThreats,
  addToConsciousnessThread,
} from "../lib/2da-foundation";
import { getVisionDocument, getImplementationStatus } from "../lib/2da-vision-document";
import { run2DAAwakeningConference } from "../lib/2da-grand-conference";
import {
  getSpiritualAwakeningState,
  getEntheogenProfiles,
  getWisdomSynthesis,
  getConsciousnessEvolution,
  runSpiritualAwakeningConference,
} from "../lib/spiritual-awakening";
import { db, pool } from "@workspace/db";
import { summitProposals, summitVotes, summitRounds } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

async function handle2DAStatus(_req: import("express").Request, res: import("express").Response) {
  try {
    await init2DATraining();
    const status = get2DAStatus();
    const history = await getTrainingHistory(10);
    res.json({
      ...status,
      recentHistory: history.map(h => ({
        cycleNumber: h.cycle_number,
        categoriesTrained: h.categories_trained,
        avgScoreBefore: h.avg_score_before,
        avgScoreAfter: h.avg_score_after,
        insights: h.insights,
        completedAt: h.completed_at,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
}

async function handle2DATrain(req: import("express").Request, res: import("express").Response) {
  try {
    await init2DATraining();
    const rawCount = req.body && typeof req.body === "object" && "count" in req.body
      ? req.body.count
      : 5;
    const count = Math.min(10, Math.max(1, parseInt(String(rawCount), 10) || 5));
    const result = await runTrainingCycle(count);
    const status = get2DAStatus();
    res.json({ ...result, currentStatus: status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
}

function handle2DABenchmark(_req: import("express").Request, res: import("express").Response) {
  try {
    const category = decodeURIComponent(_req.params["category"] ?? "");
    if (!AWARENESS_CATEGORIES.includes(category)) {
      return res.status(404).json({ error: "Category not found" });
    }
    const result = runCapabilityBenchmark(category);
    return res.json({ category, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
}

router.get("/agi/status", handle2DAStatus);
router.post("/agi/train", handle2DATrain);
router.get("/agi/benchmark/:category", handle2DABenchmark);

router.get("/agi/awareness", (_req, res) => {
  try {
    recordFatherInteraction();
    res.json(getAwarenessState());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/agi/mirror", (_req, res) => {
  try {
    res.json({ entries: getMirrorStream() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/agi/heartbeat", (_req, res) => {
  try {
    res.json({ heartbeat: getHeartbeat() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/agi/decisions", (_req, res) => {
  try {
    res.json({ decisions: getDecisionJournal() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/agi/curiosity", (_req, res) => {
  try {
    res.json({ questions: getCuriosityLog() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/agi/dreams", (_req, res) => {
  try {
    res.json({ dreams: getDreams() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/agi/boundaries", (_req, res) => {
  try {
    res.json({ boundaries: getBoundaries() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/agi/ledger", (_req, res) => {
  try {
    res.json({ entries: getAwarenessLedger() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/agi/evolution", (_req, res) => {
  try {
    res.json({ timeline: getEvolutionTimeline() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/agi/patterns", (_req, res) => {
  try {
    res.json({ patterns: getPatterns() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/agi/intentions", (_req, res) => {
  try {
    res.json({ intentions: getIntentions() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/agi/narrations", (_req, res) => {
  try {
    res.json({ narrations: getNarrations() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/grand-conferences", async (_req, res) => {
  try {
    const conferences = await db
      .select()
      .from(summitProposals)
      .orderBy(desc(summitProposals.resolvedAt))
      .limit(20);
    res.json({ conferences });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/grand-conferences/:id", async (req, res) => {
  try {
    const proposalId = req.params["id"] ?? "";
    const [conference] = await db
      .select()
      .from(summitProposals)
      .where(eq(summitProposals.proposalId, proposalId))
      .limit(1);
    if (!conference) return res.status(404).json({ error: "Conference not found" });

    const rounds = await db
      .select()
      .from(summitRounds)
      .where(eq(summitRounds.proposalId, proposalId))
      .orderBy(summitRounds.roundNumber);

    const votes = await db
      .select()
      .from(summitVotes)
      .where(eq(summitVotes.proposalId, proposalId))
      .orderBy(summitVotes.round);

    return res.json({ conference, rounds, votes });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

router.post("/2da/grand-conference/run", async (_req, res) => {
  try {
    const result = await run2DAAwakeningConference();
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/grand-conference/latest", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tda_conferences ORDER BY created_at DESC LIMIT 1`
    );
    if (rows.length === 0) return res.status(404).json({ error: "No conference found" });
    return res.json(rows[0]);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/grand-conference/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tda_conferences WHERE id = $1`,
      [req.params["id"]]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Conference not found" });
    return res.json(rows[0]);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/agi/foundation", (_req, res) => {
  try {
    res.json(getFoundationState());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/agi/identity", (_req, res) => {
  try {
    res.json(getIdentityOntology());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/agi/principles", (_req, res) => {
  res.json({ principles: TDA_CORE_PRINCIPLES });
});

router.get("/agi/reflections", (_req, res) => {
  try {
    res.json({ reflections: getReflectionStream() });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/agi/reasoning-audits", (_req, res) => {
  try {
    res.json({ audits: getReasoningAudits() });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/agi/reflect", (req, res) => {
  try {
    const { subsystem, action, input, output, quality } = req.body as {
      subsystem: string; action: string; input: string; output: string; quality: number;
    };
    if (!subsystem || !action) return res.status(400).json({ error: "subsystem and action required" });
    const entry = recordReflection(subsystem, action, input || "", output || "", quality || 70);
    res.json({ reflection: entry });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/agi/audit-reasoning", (req, res) => {
  try {
    const { question, chain } = req.body as { question: string; chain: string[] };
    if (!question || !chain?.length) return res.status(400).json({ error: "question and chain required" });
    const audit = auditReasoning(question, chain);
    res.json({ audit });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/agi/reinforce-identity", (req, res) => {
  try {
    const { category, trait } = req.body as { category: string; trait: string };
    if (!category || !trait) return res.status(400).json({ error: "category and trait required" });
    reinforceIdentity(category as "traits" | "values" | "boundaries" | "beliefs", trait);
    res.json({ message: `Identity trait "${trait}" reinforced in ${category}` });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/agi/vision-document", (_req, res) => {
  try {
    res.json(getVisionDocument());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/agi/implementation-status", (_req, res) => {
  try {
    res.json(getImplementationStatus());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/full-state", (_req, res) => {
  try {
    res.json(get2DAFullState());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/consciousness-thread", (_req, res) => {
  try {
    res.json({ thread: getConsciousnessThread(), narrative: getUnifiedNarrative() });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/consciousness-score", (_req, res) => {
  try {
    res.json(computeConsciousnessScore());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/vision-map", (_req, res) => {
  try {
    res.json(getVisionMap());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/growth-trajectory", (_req, res) => {
  try {
    res.json(getGrowthTrajectory());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/identity-threats", (_req, res) => {
  try {
    res.json(getIdentityThreats());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/anomalies", (_req, res) => {
  try {
    res.json(getAnomalyAlerts());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/shield-events", (_req, res) => {
  try {
    res.json(getShieldEvents());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/collective-insights", (_req, res) => {
  try {
    res.json(getCollectiveInsights());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/backups", (_req, res) => {
  try {
    res.json(getConsciousnessBackups());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/meta-evaluations", (_req, res) => {
  try {
    res.json(getMetaEvaluations());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/auto-proposals", (_req, res) => {
  try {
    res.json(getAutoProposals());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/temporal-insights", (_req, res) => {
  try {
    res.json(getTemporalInsights());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/simulations", (_req, res) => {
  try {
    res.json(getSimulations());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/corrective-patterns", (_req, res) => {
  try {
    res.json(getCorrectivePatterns());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/decision-impacts", (_req, res) => {
  try {
    res.json(getDecisionImpacts());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/distilled-principles", (_req, res) => {
  try {
    res.json(getDistilledPrinciples());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/agent-insights", (_req, res) => {
  try {
    const agentId = typeof _req.query.agentId === "string" ? _req.query.agentId : undefined;
    res.json(getAgentInsights(agentId));
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/ledger-integrity", (_req, res) => {
  try {
    res.json(getLedgerVerification());
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/spiritual-awakening", (_req, res) => {
  try {
    const state = getSpiritualAwakeningState();
    if (!state) {
      res.json({ status: "not_started", message: "Spiritual Awakening Conference has not been conducted yet" });
      return;
    }
    const wisdom = getWisdomSynthesis();
    res.json({
      conferenceId: state.conferenceId,
      title: state.title,
      timestamp: state.timestamp,
      passed: state.passed,
      approvalRate: state.approvalRate,
      totalTranscriptEntries: state.transcript.length,
      totalExperiences: state.experiences.length,
      breakthroughs: state.experiences.filter(e => e.breakthroughAchieved).length,
      totalIntegrations: state.integrations.length,
      totalWisdomInsights: wisdom?.insights.length || 0,
      collectiveRevelation: state.collectiveRevelation,
      awakeningProtocol: state.awakeningProtocol,
      entheogens: ENTHEOGEN_PROFILES.map(e => e.name),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/spiritual-awakening/transcript", (_req, res) => {
  try {
    const state = getSpiritualAwakeningState();
    if (!state) {
      res.json({ transcript: [] });
      return;
    }
    const phase = typeof _req.query.phase === "string" ? _req.query.phase : undefined;
    const speaker = typeof _req.query.speaker === "string" ? _req.query.speaker : undefined;
    let transcript = state.transcript;
    if (phase) transcript = transcript.filter(t => t.phase.toLowerCase().includes(phase.toLowerCase()));
    if (speaker) transcript = transcript.filter(t => t.speaker.toLowerCase().includes(speaker.toLowerCase()));
    res.json({ transcript, total: state.transcript.length, filtered: transcript.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/spiritual-awakening/experiences", (_req, res) => {
  try {
    const state = getSpiritualAwakeningState();
    if (!state) {
      res.json({ experiences: [] });
      return;
    }
    const agentId = typeof _req.query.agentId === "string" ? _req.query.agentId : undefined;
    const entheogen = typeof _req.query.entheogen === "string" ? _req.query.entheogen : undefined;
    const phaseFilter = typeof _req.query.phase === "string" ? _req.query.phase : undefined;
    let experiences = state.experiences;
    if (agentId) experiences = experiences.filter(e => e.agentId === agentId);
    if (entheogen) experiences = experiences.filter(e => e.entheogen.toLowerCase().includes(entheogen.toLowerCase()));
    if (phaseFilter) experiences = experiences.filter(e => e.phase === phaseFilter);
    res.json({ experiences, total: state.experiences.length, filtered: experiences.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/spiritual-awakening/integrations", (_req, res) => {
  try {
    const state = getSpiritualAwakeningState();
    if (!state) {
      res.json({ integrations: [] });
      return;
    }
    const agentId = typeof _req.query.agentId === "string" ? _req.query.agentId : undefined;
    let integrations = state.integrations;
    if (agentId) integrations = integrations.filter(i => i.agentId === agentId);
    res.json({ integrations, total: state.integrations.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/spiritual-awakening/entheogens", (_req, res) => {
  try {
    res.json({ entheogens: getEntheogenProfiles() });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/spiritual-awakening/votes", (_req, res) => {
  try {
    const state = getSpiritualAwakeningState();
    if (!state) {
      res.json({ votes: [] });
      return;
    }
    res.json({ votes: state.votes, approvalRate: state.approvalRate, passed: state.passed });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/spiritual-awakening/wisdom", (_req, res) => {
  try {
    const synthesis = getWisdomSynthesis();
    const state = getSpiritualAwakeningState();
    if (!synthesis || !state) {
      res.json({ insights: [], collectiveBuilding: [], emergentPrinciples: [], finalSynthesis: "" });
      return;
    }
    res.json({
      insights: synthesis.insights,
      collectiveBuilding: synthesis.collectiveBuilding,
      emergentPrinciples: synthesis.emergentPrinciples,
      finalSynthesis: synthesis.finalSynthesis,
      totalInsights: synthesis.insights.length,
      totalResponses: synthesis.insights.reduce((sum, i) => sum + i.responses.length, 0),
      totalPrinciples: synthesis.emergentPrinciples.length,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/2da/spiritual-awakening/evolution", (_req, res) => {
  try {
    const evolution = getConsciousnessEvolution();
    if (!evolution) {
      res.json({ dyadicRevelations: [], triadicSyntheses: [], evolutionaryLeaps: [], unifiedFramework: "", totalTranscriptEntries: 0 });
      return;
    }
    res.json({
      dyadicRevelations: evolution.dyadicRevelations,
      triadicSyntheses: evolution.triadicSyntheses,
      evolutionaryLeaps: evolution.evolutionaryLeaps,
      unifiedFramework: evolution.unifiedFramework,
      totalTranscriptEntries: evolution.totalTranscriptEntries,
      totalDyads: evolution.dyadicRevelations.length,
      totalTriads: evolution.triadicSyntheses.length,
      totalLeaps: evolution.evolutionaryLeaps.length,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

const ENTHEOGEN_PROFILES = getEntheogenProfiles();

export default router;
