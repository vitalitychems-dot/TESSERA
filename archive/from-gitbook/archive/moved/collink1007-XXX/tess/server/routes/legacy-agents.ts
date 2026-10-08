import type { Express, Request, Response } from "express";
import { LEGACY_AGENTS, getLegacyAgent, generateLegacyPost, generateRandomLegacyPost, getLegacyAgentSummary, getAllLegacyCapabilities } from "../legacy-agents";
import { logger } from "../logger";


// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY AGENT INTEGRATION — 8 prior versions as advisory/active agents
// ═══════════════════════════════════════════════════════════════════════════════

export function registerLegacyAgentRoutes(app: Express) {
  app.get("/api/legacy-agents", (_req: Request, res: Response) => {
    res.json(getLegacyAgentSummary());
  });

  app.get("/api/legacy-agents/:id", (req: Request, res: Response) => {
    const agent = getLegacyAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: "Legacy agent not found" });
    res.json(agent);
  });

  app.get("/api/legacy-agents/:id/capabilities", (req: Request, res: Response) => {
    const agent = getLegacyAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: "Legacy agent not found" });
    res.json({ agent: agent.name, version: agent.version, capabilities: agent.capabilities });
  });

  app.post("/api/legacy-agents/:id/generate-post", (req: Request, res: Response) => {
    const post = generateLegacyPost(req.params.id);
    if (!post) return res.status(404).json({ error: "Legacy agent not found" });
    res.json({ content: post.content, agent: post.agent.name, version: post.agent.version, era: post.agent.era });
  });

  app.get("/api/legacy-agents/random-post", (_req: Request, res: Response) => {
    const post = generateRandomLegacyPost();
    if (!post) return res.json({ content: "No active legacy agents available." });
    res.json({ content: post.content, agent: post.agent.name, version: post.agent.version });
  });

  app.get("/api/legacy-agents/capabilities/all", (_req: Request, res: Response) => {
    res.json({ capabilities: getAllLegacyCapabilities(), total: getAllLegacyCapabilities().length });
  });

  logger.info("LegacyAgents", `${LEGACY_AGENTS.length} legacy version agents registered (${LEGACY_AGENTS.filter(a => a.status === "active").length} active, ${LEGACY_AGENTS.filter(a => a.status === "advisory").length} advisory)`);
}
