import { Router, type Request, type Response } from "express";
import { getPersonalityEvolutionMetrics, getPersonality, getAllPersonalities, recordPerformanceEvent, evolveAllPersonalities } from "../lib/personality-evolution";
import { getDaemonMetrics, runImprovementCycle } from "../lib/auto-improvement-daemon";
import { getAGITrainingMetrics } from "../lib/agi-training-engine";
import { getEvolutionMetrics, proposeEvolution, rollbackEvolution } from "../lib/self-code-evolution";

const router = Router();

router.get("/personality-evolution/metrics", (_req: Request, res: Response) => {
  res.json({ ok: true, data: getPersonalityEvolutionMetrics() });
});

router.get("/personality-evolution/agents", (_req: Request, res: Response) => {
  const agents = getAllPersonalities();
  res.json({ ok: true, data: agents, count: agents.length });
});

router.get("/personality-evolution/agent/:agentId", (req: Request, res: Response) => {
  const agentId = String(req.params.agentId);
  const agent = getPersonality(agentId);
  res.json({ ok: true, data: agent });
});

router.post("/personality-evolution/event", (req: Request, res: Response) => {
  const { agentId, agentName, eventType, domain, score, context } = req.body;
  if (!agentId || !eventType || !domain || score === undefined) {
    res.status(400).json({ ok: false, error: "agentId, eventType, domain, and score are required" });
    return;
  }
  recordPerformanceEvent({ agentId, agentName: agentName || agentId, eventType, domain, score, context: context || "", timestamp: Date.now() });
  res.json({ ok: true, message: "Performance event recorded" });
});

router.post("/personality-evolution/evolve", (_req: Request, res: Response) => {
  evolveAllPersonalities();
  res.json({ ok: true, message: "Evolution cycle completed", agentCount: getAllPersonalities().length });
});

router.get("/auto-improvement/metrics", (_req: Request, res: Response) => {
  res.json({ ok: true, data: getDaemonMetrics() });
});

router.post("/auto-improvement/cycle", async (_req: Request, res: Response) => {
  const cycle = await runImprovementCycle();
  res.json({ ok: true, data: cycle });
});

router.get("/agi-training/metrics", (_req: Request, res: Response) => {
  res.json({ ok: true, data: getAGITrainingMetrics() });
});

router.get("/self-evolution/metrics", (_req: Request, res: Response) => {
  res.json({ ok: true, data: getEvolutionMetrics() });
});

router.post("/self-evolution/propose", async (req: Request, res: Response) => {
  const { targetModule, proposedChange, rationale, riskLevel = "low" } = req.body;
  if (!targetModule || !proposedChange || !rationale) {
    res.status(400).json({ ok: false, error: "targetModule, proposedChange, and rationale are required" });
    return;
  }
  const proposal = await proposeEvolution(targetModule, proposedChange, rationale, riskLevel);
  res.json({ ok: true, data: proposal });
});

router.post("/self-evolution/rollback/:proposalId", (req: Request, res: Response) => {
  const proposalId = String(req.params.proposalId);
  const success = rollbackEvolution(proposalId);
  res.json({ ok: success, message: success ? `Rolled back ${proposalId}` : `Cannot rollback ${proposalId}` });
});

export default router;
