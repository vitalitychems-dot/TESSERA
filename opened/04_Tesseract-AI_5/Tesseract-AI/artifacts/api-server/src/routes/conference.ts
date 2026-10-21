import { Router } from "express";
import { db } from "@workspace/db";
import { summitProposals, summitVotes, summitRounds } from "@workspace/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import {
  runKnowledgeUnificationConference,
  getKnowledgeUnificationSession,
  getKnowledgeUnificationStatus,
  getConferenceSessionBySessionId,
  listConferenceSessionsSummary,
  type KnowledgeUnificationSession,
} from "../lib/knowledge-unification-conference.js";
import {
  getSourceCatalog,
  getAcquisitionStatus,
  runAcquisitionDiscoveryCycle,
} from "../lib/direct-knowledge-acquisition.js";
import {
  getOrchestrationStatus,
  runOrchestrationCycle,
} from "../lib/cross-engine-orchestration-bridge.js";

const router = Router();

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const rateLimitState: Record<string, { lastCallAt: number; count: number }> = {};
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CALLS = 3;

function checkRateLimit(endpointKey: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const state = rateLimitState[endpointKey];
  if (!state || now - state.lastCallAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitState[endpointKey] = { lastCallAt: now, count: 1 };
    return { allowed: true };
  }
  if (state.count >= RATE_LIMIT_MAX_CALLS) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - state.lastCallAt);
    return { allowed: false, retryAfterMs };
  }
  state.count++;
  state.lastCallAt = now;
  return { allowed: true };
}

router.get("/conference/sessions", async (_req, res) => {
  try {
    const [kuSessions, proposals] = await Promise.all([
      listConferenceSessionsSummary(),
      db.select()
        .from(summitProposals)
        .orderBy(desc(summitProposals.createdAt))
        .limit(200),
    ]);

    const categories = [...new Set(
      proposals
        .filter(p => !p.category.endsWith("-session"))
        .map(p => p.category)
    )];

    const categorySessions = categories.map(category => {
      const categoryProposals = proposals.filter(p => p.category === category);
      const approved = categoryProposals.filter(p => p.status === "approved");
      const avgApproval = categoryProposals.length > 0
        ? categoryProposals.reduce((sum, p) => sum + (p.approvalRate ?? 0), 0) / categoryProposals.length
        : 0;
      return {
        category,
        title: categoryProposals[0]?.topic?.slice(0, 100) ?? category,
        proposalCount: categoryProposals.length,
        approvedCount: approved.length,
        avgApprovalRate: avgApproval,
        latestAt: categoryProposals[0]?.createdAt ?? null,
        status: categoryProposals.every(p => p.status !== "voting") ? "complete" : "voting",
      };
    });

    const kuSession = getKnowledgeUnificationSession();

    res.json({
      sessions: categorySessions,
      kuSessions,
      kuSession: kuSession ? {
        sessionId: kuSession.sessionId,
        status: kuSession.status,
        agentCount: kuSession.agentCount,
        proposalsVoted: kuSession.voteOutcomes.length,
        approvedCount: kuSession.voteOutcomes.filter(v => v.status === "approved").length,
        conveneAt: kuSession.conveneAt,
        completedAt: kuSession.completedAt,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to list conference sessions", details: errorMessage(err) });
  }
});

router.get("/conference/sessions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const kuSession = await getConferenceSessionBySessionId(id);
    if (kuSession) {
      res.json({
        type: "knowledge-unification",
        session: kuSession,
        voteOutcomes: kuSession.voteOutcomes,
        agentSpeeches: kuSession.agentSpeeches,
        transcript: kuSession.transcript,
      });
      return;
    }

    const proposals = await db.select()
      .from(summitProposals)
      .where(eq(summitProposals.category, id))
      .orderBy(desc(summitProposals.createdAt));

    if (proposals.length === 0) {
      res.status(404).json({ error: `No conference session found for ID or category: ${id}` });
      return;
    }

    const proposalIds = proposals.map(p => p.proposalId);
    const [votes, rounds] = await Promise.all([
      proposalIds.length > 0
        ? db.select().from(summitVotes).where(inArray(summitVotes.proposalId, proposalIds))
            .orderBy(desc(summitVotes.createdAt)).limit(500)
        : Promise.resolve([]),
      proposalIds.length > 0
        ? db.select().from(summitRounds).where(inArray(summitRounds.proposalId, proposalIds))
            .orderBy(desc(summitRounds.createdAt)).limit(100)
        : Promise.resolve([]),
    ]);

    res.json({ type: "category", category: id, proposals, votes, rounds });
  } catch (err) {
    res.status(500).json({ error: "Failed to get conference session", details: errorMessage(err) });
  }
});

router.get("/conference/latest", async (_req, res) => {
  try {
    const kuSession = getKnowledgeUnificationSession();
    if (kuSession) {
      res.json({
        type: "knowledge-unification",
        session: kuSession,
        voteOutcomes: kuSession.voteOutcomes,
        agentSpeeches: kuSession.agentSpeeches,
        transcript: kuSession.transcript,
        perProposalVotes: kuSession.perProposalVotes,
      });
      return;
    }

    const sessions = await listConferenceSessionsSummary();
    if (sessions.length > 0) {
      const latestSummary = sessions[sessions.length - 1];
      const fullSession = await getConferenceSessionBySessionId(latestSummary.sessionId);
      if (fullSession) {
        res.json({
          type: "knowledge-unification",
          session: fullSession,
          voteOutcomes: fullSession.voteOutcomes,
          agentSpeeches: fullSession.agentSpeeches,
          transcript: fullSession.transcript,
          perProposalVotes: fullSession.perProposalVotes,
        });
        return;
      }
    }

    res.json({ latest: null, kuStatus: getKnowledgeUnificationStatus() });
  } catch (err) {
    res.status(500).json({ error: "Failed to get latest conference", details: errorMessage(err) });
  }
});

router.post("/conference/convene", async (req, res) => {
  const rl = checkRateLimit("conference/convene");
  if (!rl.allowed) {
    res.status(429).json({ error: "Rate limited — too many conference convene requests", retryAfterMs: rl.retryAfterMs });
    return;
  }

  const { type } = (req.body ?? {}) as { type?: string };

  if (type && type !== "knowledge-unification") {
    res.status(400).json({ error: "Only type 'knowledge-unification' is supported via this endpoint" });
    return;
  }

  const current = getKnowledgeUnificationSession();
  if (current && current.status === "running") {
    res.json({ message: "Knowledge Unification Conference is already running", session: current });
    return;
  }

  runKnowledgeUnificationConference().catch(err =>
    console.error("[Conference Routes] Knowledge Unification Conference error:", errorMessage(err))
  );

  res.json({
    message: "Knowledge Unification Grand Conference convened — all 27 agents deliberating",
    type: "knowledge-unification",
    status: "running",
  });
});

router.get("/conference/knowledge-unification/session", (_req, res) => {
  const session = getKnowledgeUnificationSession();
  if (!session) {
    res.json({ session: null, status: getKnowledgeUnificationStatus() });
    return;
  }
  res.json({ session, status: getKnowledgeUnificationStatus() });
});

router.get("/knowledge-acquisition/sources", (_req, res) => {
  try {
    const sources = getSourceCatalog();
    res.json({
      sources,
      totalCount: sources.length,
      activeCount: sources.filter(s => s.status === "active").length,
      legalCompliance: "All sources are publicly accessible, legally free-to-use. No unauthorized access.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get knowledge sources", details: errorMessage(err) });
  }
});

router.get("/knowledge-acquisition/status", (_req, res) => {
  try {
    const status = getAcquisitionStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: "Failed to get acquisition status", details: errorMessage(err) });
  }
});

router.post("/knowledge-acquisition/run", async (_req, res) => {
  const rl = checkRateLimit("knowledge-acquisition/run");
  if (!rl.allowed) {
    res.status(429).json({ error: "Rate limited — too many acquisition cycle requests", retryAfterMs: rl.retryAfterMs });
    return;
  }
  try {
    const result = await runAcquisitionDiscoveryCycle();
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: "Failed to run acquisition cycle", details: errorMessage(err) });
  }
});

router.get("/orchestration-bridge/status", (_req, res) => {
  try {
    const status = getOrchestrationStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: "Failed to get orchestration status", details: errorMessage(err) });
  }
});

router.post("/orchestration-bridge/cycle", async (_req, res) => {
  const rl = checkRateLimit("orchestration-bridge/cycle");
  if (!rl.allowed) {
    res.status(429).json({ error: "Rate limited — too many orchestration cycle requests", retryAfterMs: rl.retryAfterMs });
    return;
  }
  try {
    const result = await runOrchestrationCycle();
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: "Failed to run orchestration cycle", details: errorMessage(err) });
  }
});

export default router;
