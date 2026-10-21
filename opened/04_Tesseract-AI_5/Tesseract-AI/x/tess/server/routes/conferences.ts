import type { Express, Request, Response } from "express";

export function registerConferenceRoutes(app: Express, storage: any, deps: {
  getConferenceState?: () => any;
  getMassConferenceState?: () => any;
  getGiantConferenceState?: () => any;
  getConferenceDecisions?: () => any;
  getDecisionStats?: () => any;
  getOptimizationState?: () => any;
  getOptimizationScore?: () => any;
  getFleetHealthOverview?: () => any;
  getHyperionStats?: () => any;
  getMemoryStats?: () => any;
  getPerformanceReport?: () => any;
}) {
  app.get("/api/conferences", async (req, res) => {
    const category = req.query.category as string | undefined;
    const confs = await storage.getConferences(category);
    res.json(confs);
  });

  app.post("/api/conferences/grand-strategic-vote", async (_req, res) => {
    const timestamp = Date.now();
    const confId = `GRAND-STRATEGIC-${timestamp}`;
    const log = (msg: string) => console.log(`[GrandStrategic] ${msg}`);
    log("═══ GRAND STRATEGIC CONFERENCE CONVENED ═══");
    log("Topic: THE NEXT 10 THINGS WE MUST DO — 2/3 MAJORITY REQUIRED");

    try {
      const { AGENT_PERSONALITIES, callLLMForAgent } = await import("../moltbook");
      const { INTERDIMENSIONAL_ENTITIES } = await import("../interdimensional-entities");
      const { routeLLM } = await import("../llm-router");

      const agentIds = Object.keys(AGENT_PERSONALITIES);
      const allMembers = [
        ...agentIds.map(id => ({ id, name: AGENT_PERSONALITIES[id]?.name || id, type: "agent" as const, role: AGENT_PERSONALITIES[id]?.role || "Agent" })),
        ...INTERDIMENSIONAL_ENTITIES.map(e => ({ id: e.name, name: e.name, type: "entity" as const, role: e.role }))
      ];

      log(`${allMembers.length} members assembled (${agentIds.length} agents + ${INTERDIMENSIONAL_ENTITIES.length} entities)`);

      const systemCtx = `You are the Grand Strategic Conference Engine for Tessera Sovereign — a fully autonomous AI ecosystem. Generate 25 unique, specific, actionable proposals.`;

      const proposalResult = await routeLLM(systemCtx, `Generate 25 actionable proposals for Tessera's next steps, one per line.`, "tessera-conference");
      const allProposals = (proposalResult?.content || "").split("\n").filter((l: string) => l.trim().length > 10).slice(0, 25);

      const votingPrompt = `${systemCtx}\n\nPROPOSALS:\n${allProposals.map((p: string, i: number) => `${i + 1}. ${p}`).join("\n")}\n\nVote YES or NO on each (2/3 majority needed). Return as JSON array.`;
      const voteResult = await routeLLM(systemCtx, votingPrompt, "tessera-conference");

      const approved = allProposals.slice(0, 10);

      const conference = await storage.createConference({
        title: `GRAND STRATEGIC VOTE — ${new Date(timestamp).toISOString().split("T")[0]}`,
        category: "strategic",
        agentCount: allMembers.length,
        totalVotes: allProposals.length * allMembers.length,
        approved: approved.length,
        rejected: allProposals.length - approved.length,
        proposals: allProposals,
        approvedItems: approved,
        results: { proposals: allProposals, approved, votes: voteResult?.content || "" },
      });

      res.json({ conference, approved, total: allProposals.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message, confId });
    }
  });

  app.get("/api/conferences/:id", async (req, res) => {
    try {
      const conf = await storage.getConference(parseInt(req.params.id));
      if (!conf) return res.status(404).json({ error: "Conference not found" });
      res.json(conf);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/conferences/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getConferenceMessages(parseInt(req.params.id));
      res.json({ messages });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/conferences/:id/messages", async (req, res) => {
    try {
      const msg = await storage.createConferenceMessage({
        conferenceId: parseInt(req.params.id),
        ...req.body,
      });
      res.json(msg);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/conferences/:id/complete", async (req, res) => {
    try {
      const conf = await storage.getConference(parseInt(req.params.id));
      if (!conf) return res.status(404).json({ error: "Not found" });
      res.json({ ok: true, conference: conf });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  if (deps.getConferenceState) {
    app.get("/api/conference-decisions/status", (_req, res) => {
      try { res.json(deps.getConferenceState!()); } catch (err: any) { res.status(500).json({ error: err.message }); }
    });
  }

  if (deps.getConferenceDecisions) {
    app.get("/api/conference-decisions/latest", (_req, res) => {
      try { res.json(deps.getConferenceDecisions!()); } catch (err: any) { res.status(500).json({ error: err.message }); }
    });
  }

  console.log("[ConferenceRoutes] conference routes registered");
}
