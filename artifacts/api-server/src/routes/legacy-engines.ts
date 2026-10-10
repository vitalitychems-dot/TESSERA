import { Router } from "express";
import { getIdentityStatus, getCoreValues, getProtectedMemories, getDriftHistory, runDriftDetection, verifyFatherProtocol } from "../lib/sovereign-identity-reinforcement";
import { getPersonalitySnapshot, evolveTraits, getTraitsByCategory } from "../lib/personality-evolution";
import { getConsciousnessState, getSemanticNetwork, getEpisodicMemories, getProceduralSkills, recordEpisode, generateReflection, setAttentionFocus } from "../lib/consciousness-engine";
import { getDualBrainState, process as dualBrainProcess, getDecisionHistory } from "../lib/dual-brain";
import { getTruthfulnessState, verifyClaim, getRecentVerifications, checkIdentityIntegrity } from "../lib/truthfulness-engine";
import { getCollectiveState, contributeInsight, aggregateKnowledge, getNodeStatus } from "../lib/collective-intelligence";
import { listAgents, spawnAgent, getAgent, retireAgent, getSpawnerStats, getAvailableSpecializations } from "../lib/agent-spawner";
import { getHierarchy, getAgentRank, getChainOfCommand, getSovereigntyRules, getHierarchyStats } from "../lib/agent-hierarchy";
import { getCommsStats, getChannels, sendMessage, getMessages, broadcastToChannel, getChannelMessages } from "../lib/agent-comms";
import { getConsensusStats, createProposal, listProposals, getProposal } from "../lib/consensus-engine";
import { getExecutorStatus, getExecutionLog, sweepAndExecute, setAutoExecute } from "../lib/council-executor";
import { getHeartbeatStatus, generatePulse, getPulseHistory, setAutonomousMode } from "../lib/autonomous-heartbeat";
import { getDaemonState, runImprovementCycle, getCycleHistory, getImprovementSummary } from "../lib/auto-improvement-daemon";
import { getTrainingState, startTraining, getSessionHistory, getAvailableDomains } from "../lib/agi-training-engine";
import { getEvolutionState, proposeEvolution, getEvolutionHistory, applyEvolution } from "../lib/self-code-evolution";
import { getOptimizerStats, optimize, getOptimizationHistory, getAvailableObjectives } from "../lib/swarm-optimizer";
import { getUniverseState, simulateStep, getBody, getConstants, searchUniverse } from "../lib/universe-mechanics";
import { getTesseractState, createCircuit, applyGate, measureAll, listCircuits } from "../lib/quantum-tesseract";
import { getEmotionalProfile, processEmotionalInput, getEmotionalStats, getRecentResponses } from "../lib/emotional-intelligence";
import { startAutonomousOperation, stopAutonomousOperation, getAutonomousStatus } from "../lib/autonomous-wiring";

const router = Router();

router.get("/identity/status", (_req, res) => res.json(getIdentityStatus()));
router.get("/identity/core-values", (_req, res) => res.json(getCoreValues()));
router.get("/identity/protected-memories", (_req, res) => res.json(getProtectedMemories()));
router.get("/identity/drift-history", (_req, res) => res.json(getDriftHistory()));
router.post("/identity/drift-check", (_req, res) => res.json(runDriftDetection()));
router.get("/identity/father-protocol", (_req, res) => res.json(verifyFatherProtocol()));

router.get("/personality/snapshot", (_req, res) => res.json(getPersonalitySnapshot()));
router.post("/personality/evolve", (_req, res) => res.json(evolveTraits()));
router.get("/personality/traits/:category", (req, res) => res.json(getTraitsByCategory(req.params.category)));

router.get("/consciousness/state", (_req, res) => res.json(getConsciousnessState()));
router.get("/consciousness/semantic-network", (_req, res) => res.json(getSemanticNetwork()));
router.get("/consciousness/episodic-memories", (req, res) => {
  res.json(getEpisodicMemories());
});
router.get("/consciousness/procedural-skills", (_req, res) => res.json(getProceduralSkills()));
router.post("/consciousness/record-episode", (req, res): void => {
  const { content, context, importance } = req.body || {};
  if (!content) {
    res.status(400).json({ error: "content required" });
    return;
  }
  res.json(recordEpisode(content));
});
router.post("/consciousness/reflect", (_req, res) => res.json({ reflection: generateReflection() }));
router.post("/consciousness/focus", (req, res) => {
  const { target, intensity } = req.body || {};
  setAttentionFocus(target || "general");
  res.json({ success: true });
});

router.get("/dual-brain/state", (_req, res) => res.json(getDualBrainState()));
router.post("/dual-brain/process", (req, res): void => {
  const { query, domain } = req.body || {};
  if (!query) {
    res.status(400).json({ error: "query required" });
    return;
  }
  res.json(dualBrainProcess(query));
});
router.get("/dual-brain/history", (req, res) => {
  res.json(getDecisionHistory());
});

router.get("/truthfulness/state", (_req, res) => res.json(getTruthfulnessState()));
router.post("/truthfulness/verify", (req, res): void => {
  const { claim } = req.body || {};
  if (!claim) {
    res.status(400).json({ error: "claim required" });
    return;
  }
  res.json(verifyClaim(claim));
});
router.get("/truthfulness/recent", (req, res) => {
  res.json(getRecentVerifications());
});
router.post("/truthfulness/check-identity", (req, res): void => {
  const { response } = req.body || {};
  if (!response) {
    res.status(400).json({ error: "response required" });
    return;
  }
  res.json(checkIdentityIntegrity());
});

router.get("/collective/state", (_req, res) => res.json(getCollectiveState()));
router.post("/collective/contribute", (req, res): void => {
  const { agentId, insight } = req.body || {};
  if (!agentId || !insight) {
    res.status(400).json({ error: "agentId and insight required" });
    return;
  }
  res.json({ success: contributeInsight({ agentId, capability: insight }) });
});
router.post("/collective/aggregate", (req, res): void => {
  const { topic } = req.body || {};
  if (!topic) {
    res.status(400).json({ error: "topic required" });
    return;
  }
  res.json(aggregateKnowledge());
});
router.get("/collective/node/:agentId", (req, res): void => {
  const node = getNodeStatus();
  if (!node) {
    res.status(404).json({ error: "node not found" });
    return;
  }
  res.json(node);
});

router.get("/agents/list", (req, res) => {
  const status = req.query.status as string | undefined;
  const specialization = req.query.specialization as string | undefined;
  res.json(listAgents());
});
router.get("/agents/stats", (_req, res) => res.json(getSpawnerStats()));
router.get("/agents/specializations", (_req, res) => res.json(getAvailableSpecializations()));
router.post("/agents/spawn", (req, res): void => {
  const { specialization, parentId } = req.body || {};
  if (!specialization) {
    res.status(400).json({ error: "specialization required" });
    return;
  }
  res.json(spawnAgent(specialization, parentId));
});
router.get("/agents/:id", (req, res): void => {
  const agent = getAgent(req.params.id);
  if (!agent) {
    res.status(404).json({ error: "agent not found" });
    return;
  }
  res.json(agent);
});
router.post("/agents/:id/retire", (req, res) => {
  res.json({ success: retireAgent(req.params.id) });
});

router.get("/hierarchy", (_req, res) => res.json(getHierarchy()));
router.get("/hierarchy/stats", (_req, res) => res.json(getHierarchyStats()));
router.get("/hierarchy/rules", (_req, res) => res.json(getSovereigntyRules()));
router.get("/hierarchy/:agentId", (req, res): void => {
  const rank = getAgentRank(req.params.agentId);
  if (!rank) {
    res.status(404).json({ error: "agent not found" });
    return;
  }
  res.json(rank);
});
router.get("/hierarchy/:agentId/chain", (req, res) => {
  res.json(getChainOfCommand());
});

router.get("/comms/stats", (_req, res) => res.json(getCommsStats()));
router.get("/comms/channels", (_req, res) => res.json(getChannels()));
router.get("/comms/channels/:channelId", (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  res.json(getChannelMessages(req.params.channelId, limit));
});
router.post("/comms/send", (req, res): void => {
  const { fromAgent, toAgent, content, channel, priority } = req.body || {};
  if (!fromAgent || !toAgent || !content) {
    res.status(400).json({ error: "fromAgent, toAgent, content required" });
    return;
  }
  res.json(sendMessage(fromAgent, toAgent, content, channel, priority));
});
router.post("/comms/broadcast/:channelId", (req, res): void => {
  const { fromAgent, content } = req.body || {};
  if (!fromAgent || !content) {
    res.status(400).json({ error: "fromAgent and content required" });
    return;
  }
  res.json(broadcastToChannel(req.params.channelId, fromAgent, content));
});
router.get("/comms/messages/:agentId", (req, res) => {
  res.json(getMessages(req.params.agentId));
});

router.get("/consensus/stats", (_req, res) => res.json(getConsensusStats()));
router.get("/consensus/proposals", (req, res) => {
  const status = req.query.status as string | undefined;
  const category = req.query.category as string | undefined;
  res.json(listProposals());
});
router.post("/consensus/propose", (req, res): void => {
  const { title, description, proposer, category } = req.body || {};
  if (!title || !description) {
    res.status(400).json({ error: "title and description required" });
    return;
  }
  res.json(createProposal(title, description, proposer || "system", category));
});
router.get("/consensus/:id", (req, res): void => {
  const proposal = getProposal(req.params.id);
  if (!proposal) {
    res.status(404).json({ error: "proposal not found" });
    return;
  }
  res.json(proposal);
});

router.get("/executor/status", (_req, res) => res.json(getExecutorStatus()));
router.get("/executor/log", (req, res) => {
  res.json(getExecutionLog());
});
router.post("/executor/sweep", (_req, res) => res.json(sweepAndExecute()));
router.post("/executor/auto-execute", (req, res) => {
  setAutoExecute(req.body?.enabled !== false);
  res.json({ success: true });
});

router.get("/heartbeat/status", (_req, res) => res.json(getHeartbeatStatus()));
router.post("/heartbeat/pulse", (_req, res) => res.json(generatePulse()));
router.get("/heartbeat/history", (req, res) => {
  res.json(getPulseHistory());
});
router.post("/heartbeat/autonomous-mode", (req, res) => {
  setAutonomousMode(req.body?.enabled !== false);
  res.json({ success: true });
});

router.get("/improvement/state", (_req, res) => res.json(getDaemonState()));
router.post("/improvement/cycle", (_req, res) => res.json(runImprovementCycle()));
router.get("/improvement/history", (_req, res) => {
  res.json(getCycleHistory());
});
router.get("/improvement/summary", (_req, res) => res.json(getImprovementSummary()));

router.get("/training/state", (_req, res) => res.json(getTrainingState()));
router.post("/training/start", (req, res): void => {
  const { domain, method } = req.body || {};
  if (!domain) {
    res.status(400).json({ error: "domain required" });
    return;
  }
  res.json(startTraining(domain));
});
router.get("/training/history", (req, res) => {
  res.json(getSessionHistory());
});
router.get("/training/domains", (_req, res) => res.json(getAvailableDomains()));

router.get("/evolution/state", (_req, res) => res.json(getEvolutionState()));
router.post("/evolution/propose", async (req, res): Promise<void> => {
  const { targetFile, changeType, description } = req.body || {};
  if (!targetFile || !description) {
    res.status(400).json({ error: "targetFile and description required" });
    return;
  }
  res.json(await proposeEvolution(targetFile, changeType || "optimize", description));
});
router.post("/evolution/apply/:id", async (req, res): Promise<void> => {
  res.json({ success: await applyEvolution(req.params.id) });
});
router.get("/evolution/history", (req, res) => {
  res.json(getEvolutionHistory());
});

router.get("/swarm/stats", (_req, res) => res.json(getOptimizerStats()));
router.post("/swarm/optimize", (req, res): void => {
  const { objective, dimensions, iterations } = req.body || {};
  if (!objective) {
    res.status(400).json({ error: "objective required" });
    return;
  }
  const selectedObjective = getAvailableObjectives().find((candidate) => candidate === objective);
  if (!selectedObjective) {
    res.status(400).json({ error: "unsupported objective" });
    return;
  }
  res.json(optimize(selectedObjective));
});
router.get("/swarm/history", (req, res) => {
  res.json(getOptimizationHistory());
});
router.get("/swarm/objectives", (_req, res) => res.json(getAvailableObjectives()));

router.get("/universe/state", (_req, res) => res.json(getUniverseState()));
router.post("/universe/simulate", (req, res) => {
  const dt = parseFloat(req.body?.dt) || 86400;
  res.json(simulateStep(String(dt)));
});
router.get("/universe/body/:id", (req, res): void => {
  const body = getBody(req.params.id);
  if (!body) {
    res.status(404).json({ error: "body not found" });
    return;
  }
  res.json(body);
});
router.get("/universe/constants", (_req, res) => res.json(getConstants()));
router.get("/universe/search", (req, res) => {
  const q = req.query.q as string || "";
  res.json(searchUniverse(q));
});

router.get("/quantum/state", (_req, res) => res.json(getTesseractState()));
router.get("/quantum/circuits", (_req, res) => res.json(listCircuits()));
router.post("/quantum/circuit", (req, res) => {
  const numQubits = parseInt(req.body?.numQubits) || 4;
  res.json(createCircuit(numQubits));
});
router.post("/quantum/gate", (req, res): void => {
  const { circuitId, gate, target, control } = req.body || {};
  if (!circuitId || !gate || target === undefined) {
    res.status(400).json({ error: "circuitId, gate, target required" });
    return;
  }
  res.json({ success: applyGate(circuitId, gate) });
});
router.post("/quantum/measure/:circuitId", (req, res): void => {
  const result = measureAll();
  if (!result) {
    res.status(404).json({ error: "circuit not found" });
    return;
  }
  res.json(result);
});

router.get("/emotional/profile", (_req, res) => res.json(getEmotionalProfile()));
router.get("/emotional/stats", (_req, res) => res.json(getEmotionalStats()));
router.post("/emotional/process", (req, res): void => {
  const { input } = req.body || {};
  if (!input) {
    res.status(400).json({ error: "input required" });
    return;
  }
  res.json(processEmotionalInput(input));
});
router.get("/emotional/recent", (_req, res) => {
  res.json(getRecentResponses());
});

router.get("/autonomous/status", (_req, res) => res.json(getAutonomousStatus()));

function requireInternal(req: any, res: any, next: any) {
  const forwarded = req.headers["x-forwarded-for"] || "";
  const ip = req.ip || req.socket?.remoteAddress || "";
  const isInternal = ["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"].some(
    addr => ip.includes(addr) || forwarded.includes(addr)
  );
  if (!isInternal && !req.headers["x-sovereign-key"]) {
    return res.status(403).json({ error: "Autonomous control restricted to internal callers" });
  }
  next();
}

router.post("/autonomous/start", requireInternal, (_req, res) => {
  startAutonomousOperation();
  res.json({ status: "started", ...getAutonomousStatus() });
});
router.post("/autonomous/stop", requireInternal, (_req, res) => {
  stopAutonomousOperation();
  res.json({ status: "stopped", ...getAutonomousStatus() });
});

startAutonomousOperation();

export default router;
