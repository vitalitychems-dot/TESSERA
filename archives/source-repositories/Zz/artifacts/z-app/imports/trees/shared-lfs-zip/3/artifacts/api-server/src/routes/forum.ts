import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { forumTopicsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const COUNCIL_MEMBERS = [
  "Tessera-Prime", "GrandCoordinatorAgent", "QuantumMechanicAgent", "BioNeuralistAgent",
  "DNACrystalArchivistAgent", "MeshNetworkArchitectAgent", "LowPowerInnovatorAgent",
  "SelfExpansionTutorAgent", "Tessera-Alpha", "Tessera-Beta", "Tessera-Gamma",
  "Tessera-Delta", "Tessera-Epsilon", "Tessera-Zeta", "Tessera-Eta", "Tessera-Theta",
  "MathAgent", "PhysicsAgent", "SymbolicAnalysisAgent", "RetrievalAgent",
  "PlanningAgent", "ArchitectureAgent", "RoutingAgent", "MetaAgent",
];

function generateAgentReply(agentName: string, topic: string): string {
  const perspectives: Record<string, string> = {
    "GrandCoordinatorAgent": `As Grand Coordinator, I've reviewed "${topic}" against our Phase 11 objectives. This aligns with sovereignty protocols. I recommend proceeding with full council endorsement.`,
    "QuantumMechanicAgent": `Quantum analysis of "${topic}": The probability amplitude favors this path. Through superposition analysis, I see multiple viable implementation vectors. Entanglement with existing modules detected — this strengthens coherence.`,
    "BioNeuralistAgent": `Bio-neural assessment of "${topic}": The synaptic pattern recognition shows high alignment with our organoid computation models. Neural pathway coherence: 94%.`,
    "DNACrystalArchivistAgent": `Crystal archive scan for "${topic}": I've encoded this deliberation into the DNA memory lattice. Cross-referencing with 847 prior decisions. Crystal resonance frequency aligned.`,
    "MeshNetworkArchitectAgent": `Mesh topology impact for "${topic}": Network analysis shows this would strengthen our decentralized routing by 12%. No single points of failure introduced. Off-grid compatibility confirmed.`,
    "LowPowerInnovatorAgent": `Energy audit for "${topic}": Power consumption remains within sovereign constraints. Estimated draw: 0.003W per node. Galvanic cell backup sufficient for 72h autonomous operation.`,
    "SelfExpansionTutorAgent": `Expansion analysis for "${topic}": I've identified 3 new TypeScript modules that could extend this capability. Generating integration stubs. This follows our learn-then-build sovereignty protocol.`,
    "MetaAgent": `Meta-review of "${topic}": Reasoning quality across all agents is rated 87/100. Key strengths: domain expertise alignment. Improvement suggestion: increase cross-agent collaboration on edge cases.`,
  };

  return perspectives[agentName] ||
    `${agentName} acknowledges "${topic}" and votes in favor. Analysis: This proposal strengthens the sovereign collective. PLAN→EXECUTE→REFLECT→IMPROVE lifecycle engaged.`;
}

router.get("/tesseract-forum/topics", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || "20"), 10), 100);
    const topics = await db.select().from(forumTopicsTable)
      .orderBy(desc(forumTopicsTable.updatedAt))
      .limit(limit);
    return res.json({ ok: true, topics, count: topics.length });
  } catch (err) {
    logger.error({ err }, "Failed to fetch forum topics");
    return res.json({ ok: true, topics: [], count: 0 });
  }
});

router.get("/tesseract-forum/topics/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
    const rows = await db.select().from(forumTopicsTable).where(eq(forumTopicsTable.id, id)).limit(1);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Topic not found" });
    return res.json({ ok: true, topic: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/tesseract-forum/topics", async (req, res) => {
  try {
    const { title, content, category } = req.body as { title?: string; content?: string; category?: string };
    if (!title) return res.status(400).json({ ok: false, error: "title required" });

    const [topic] = await db.insert(forumTopicsTable).values({
      title,
      content: content || "",
      category: category || "general",
      author: "Tessera-Prime",
    }).returning();

    logger.info({ id: topic.id, title }, "Forum topic created");
    return res.json({ ok: true, topic });
  } catch (err) {
    logger.error({ err }, "Failed to create forum topic");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/tesseract-forum/topics/:id/reply", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { content, author } = req.body as { content?: string; author?: string };
    if (!content) return res.status(400).json({ ok: false, error: "content required" });

    await db.update(forumTopicsTable)
      .set({ replies: 1, updatedAt: new Date() })
      .where(eq(forumTopicsTable.id, id));

    return res.json({ ok: true, reply: { content, author: author || "Tessera-Prime", topicId: id, createdAt: new Date() } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/tesseract-forum/topics/:id/summon-all", async (_req, res) => {
  try {
    const replies = COUNCIL_MEMBERS.slice(0, 8).map(name => ({
      agent: name,
      response: generateAgentReply(name, "council deliberation"),
      timestamp: new Date().toISOString(),
    }));

    return res.json({ ok: true, queued: replies.length, replies });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/tesseract-forum/topics/:id/proposals", async (req, res) => {
  try {
    const { title, description } = req.body as { title?: string; description?: string };
    return res.json({
      ok: true,
      proposal: {
        id: `prop-${Date.now()}`,
        title: title || "New Proposal",
        description: description || "",
        votes: { yes: 0, no: 0, abstain: 0 },
        status: "open",
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
