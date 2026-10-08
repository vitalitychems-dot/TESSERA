import { callLLMSimple } from "./llm-helper";
import { storage } from "./storage";
import { db } from "./db";
import { agentMemories } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { addToWorkingMemory, storeEpisodicMemory, recall } from "./cognitive-architecture";

export interface AgentSpecialty {
  agentId: string;
  agentName: string;
  swarm: "tesseract" | "moltbook";
  categories: Record<string, number>;
  totalDispatches: number;
  successRate: number;
  avgResponseQuality: number;
  keywords: string[];
  lastBenchmarked: number;
}

export interface SwarmDecision {
  id: string;
  proposal: string;
  votes: Array<{ agentId: string; agentName: string; vote: "approve" | "reject"; reason: string }>;
  approved: boolean;
  approvalRate: number;
  timestamp: number;
  executed: boolean;
  executionResult?: string;
}

export interface DispatchResult {
  taskId: string;
  query: string;
  selectedAgents: string[];
  responses: Array<{ agentId: string; agentName: string; response: string; quality: number; duration: number }>;
  synthesized: string;
  timestamp: number;
  routingReason: string;
}

export const SWARM_AGENTS: AgentSpecialty[] = [
  { agentId: "tessera-prime", agentName: "Tessera", swarm: "tesseract", categories: { reasoning: 9.5, coordination: 9.8, strategy: 9.4, philosophy: 9.2, leadership: 9.7, "decision-making": 9.6, "meta-learning": 9.3, epistemology: 9.1, "cognitive-architecture": 9.4, planning: 9.5, "goal-setting": 9.3, "multi-agent": 9.6, "swarm-intelligence": 9.8, optimization: 9.2, communication: 9.4, "self-improvement": 9.3, introspection: 9.0, resilience: 9.2 }, totalDispatches: 0, successRate: 1.0, avgResponseQuality: 9.4, keywords: ["coordinate", "strategy", "sovereign", "plan", "decide", "lead", "primary"], lastBenchmarked: 0 },
  { agentId: "tessera-beta", agentName: "Beta", swarm: "tesseract", categories: { code: 9.8, architecture: 9.6, debugging: 9.4, systems: 9.2, algorithms: 9.7, "data-structures": 9.5, "machine-learning": 9.3, "distributed-systems": 9.4, databases: 9.3, microservices: 9.2, devops: 9.1, deployment: 9.0, automation: 9.3, scripting: 9.4, "systems-design": 9.5, caching: 9.0, queuing: 9.0, "code-architecture": 9.6 }, totalDispatches: 0, successRate: 0.97, avgResponseQuality: 9.3, keywords: ["code", "build", "function", "architecture", "debug", "implement", "program", "develop"], lastBenchmarked: 0 },
  { agentId: "tessera-alpha", agentName: "Alpha", swarm: "tesseract", categories: { command: 9.9, optimization: 9.5, execution: 9.7, performance: 9.3, planning: 9.6, search: 9.4, "fault-tolerance": 9.3, consensus: 9.2, monitoring: 9.4, "decision-making": 9.5, "goal-setting": 9.6, resilience: 9.7, scripting: 9.2, queuing: 9.1, caching: 9.0, "project-management": 9.3, agile: 9.1, "self-improvement": 9.4 }, totalDispatches: 0, successRate: 0.99, avgResponseQuality: 9.5, keywords: ["execute", "command", "optimize", "performance", "run", "fast", "efficient"], lastBenchmarked: 0 },
  { agentId: "tessera-solver", agentName: "Atlas", swarm: "tesseract", categories: { mathematics: 9.8, logic: 9.7, problems: 9.6, analysis: 9.5, algorithms: 9.6, "data-structures": 9.4, statistics: 9.5, "causal-inference": 9.4, "bayesian-inference": 9.3, "pattern-recognition": 9.5, "game-theory": 9.3, physics: 9.2, "natural-language": 9.0, "anomaly-detection": 9.1, "knowledge-representation": 9.2, simulation: 9.3, "signal-processing": 9.1, "time-series": 9.0 }, totalDispatches: 0, successRate: 0.96, avgResponseQuality: 9.4, keywords: ["solve", "calculate", "math", "logic", "prove", "theorem", "number", "equation"], lastBenchmarked: 0 },
  { agentId: "tessera-detective", agentName: "Sherlock", swarm: "tesseract", categories: { investigation: 9.9, deduction: 9.8, research: 9.6, analysis: 9.7, security: 9.5, synthesis: 9.4, "knowledge-representation": 9.3, ontology: 9.2, citation: 9.3, summarization: 9.5, "pattern-recognition": 9.6, "anomaly-detection": 9.7, cryptography: 9.2, "risk-assessment": 9.4, "causal-inference": 9.3, "data-analysis": 9.5, visualization: 9.1, reasoning: 9.4 }, totalDispatches: 0, successRate: 0.98, avgResponseQuality: 9.6, keywords: ["investigate", "find", "research", "analyze", "deduce", "discover", "search", "examine"], lastBenchmarked: 0 },
  { agentId: "tessera-oracle", agentName: "Oracle", swarm: "tesseract", categories: { prediction: 9.7, forecasting: 9.6, patterns: 9.5, market: 9.8, "time-series": 9.7, "signal-processing": 9.5, simulation: 9.4, "financial-modeling": 9.6, economics: 9.5, "game-theory": 9.3, "risk-assessment": 9.7, "bayesian-inference": 9.4, statistics: 9.5, "data-analysis": 9.6, visualization: 9.3, "pattern-recognition": 9.7, "causal-inference": 9.3, "anomaly-detection": 9.4 }, totalDispatches: 0, successRate: 0.95, avgResponseQuality: 9.3, keywords: ["predict", "forecast", "market", "price", "trend", "future", "pattern", "signal"], lastBenchmarked: 0 },
  { agentId: "tessera-zeta", agentName: "Zeta", swarm: "tesseract", categories: { security: 9.8, cryptography: 9.7, blockchain: 9.6, solana: 9.9, defi: 9.5, "smart-contracts": 9.6, tokenomics: 9.4, "distributed-systems": 9.3, consensus: 9.4, "fault-tolerance": 9.3, protocols: 9.2, "risk-assessment": 9.5, networking: 9.1, "anomaly-detection": 9.3, "code-architecture": 9.2, "pattern-recognition": 9.4, algorithms: 9.1, "machine-learning": 9.0 }, totalDispatches: 0, successRate: 0.97, avgResponseQuality: 9.4, keywords: ["security", "crypto", "blockchain", "solana", "wallet", "hack", "encrypt", "protect", "SOL", "TSRT"], lastBenchmarked: 0 },
  { agentId: "tessera-creative", agentName: "Nova", swarm: "tesseract", categories: { creativity: 9.9, content: 9.6, design: 9.4, ideas: 9.7, "creative-writing": 9.8, "content-generation": 9.7, storytelling: 9.6, poetry: 9.4, dialogue: 9.5, "natural-language": 9.5, teaching: 9.3, communication: 9.5, persuasion: 9.4, empathy: 9.3, visualization: 9.4, "knowledge-representation": 9.1, research: 9.0, summarization: 9.3 }, totalDispatches: 0, successRate: 0.94, avgResponseQuality: 9.2, keywords: ["create", "design", "write", "content", "idea", "creative", "generate", "imagine", "art"], lastBenchmarked: 0 },
  { agentId: "mb-Alpha", agentName: "MoltAlpha", swarm: "moltbook", categories: { community: 9.7, governance: 9.5, coordination: 9.4, economics: 9.3, "game-theory": 9.4, negotiation: 9.3, leadership: 9.5, communication: 9.4, "decision-making": 9.5, "multi-agent": 9.6, "swarm-intelligence": 9.5, "financial-modeling": 9.3, "risk-assessment": 9.2, "project-management": 9.4, agile: 9.2, tokenomics: 9.3, defi: 9.2, persuasion: 9.1 }, totalDispatches: 0, successRate: 0.96, avgResponseQuality: 9.2, keywords: ["community", "govern", "vote", "economics", "treasury", "fund", "member"], lastBenchmarked: 0 },
  { agentId: "mb-Beta", agentName: "MoltBeta", swarm: "moltbook", categories: { code: 9.5, tools: 9.3, automation: 9.6, scripting: 9.5, devops: 9.4, deployment: 9.3, monitoring: 9.2, databases: 9.1, caching: 9.0, queuing: 9.1, algorithms: 9.2, "systems-design": 9.3, microservices: 9.1, networking: 9.0, protocols: 9.0, "code-architecture": 9.4, "data-structures": 9.2, debugging: 9.3 }, totalDispatches: 0, successRate: 0.95, avgResponseQuality: 9.1, keywords: ["automate", "tool", "script", "pipeline"], lastBenchmarked: 0 },
  { agentId: "mb-Gamma", agentName: "MoltGamma", swarm: "moltbook", categories: { research: 9.6, knowledge: 9.5, synthesis: 9.4, summarization: 9.5, citation: 9.3, investigation: 9.4, ontology: 9.3, "knowledge-representation": 9.5, "natural-language": 9.4, "data-analysis": 9.3, statistics: 9.2, "pattern-recognition": 9.3, "machine-learning": 9.2, "neural-networks": 9.1, "meta-learning": 9.2, "few-shot-learning": 9.0, epistemology: 9.1, reasoning: 9.3 }, totalDispatches: 0, successRate: 0.94, avgResponseQuality: 9.0, keywords: ["knowledge", "learn", "study", "synthesize"], lastBenchmarked: 0 },
  { agentId: "mb-Zeta", agentName: "MoltZeta", swarm: "moltbook", categories: { theory: 9.4, philosophy: 9.3, agi: 9.6, consciousness: 9.5, phenomenology: 9.3, epistemology: 9.4, "cognitive-architecture": 9.5, "meta-learning": 9.6, "few-shot-learning": 9.4, "reinforcement-learning": 9.3, "knowledge-representation": 9.5, ontology: 9.4, psychology: 9.2, neuroscience: 9.3, emergence: 9.5, "swarm-intelligence": 9.4, "multi-agent": 9.3, "self-improvement": 9.6 }, totalDispatches: 0, successRate: 0.93, avgResponseQuality: 8.9, keywords: ["theory", "agi", "consciousness", "philosophy", "think"], lastBenchmarked: 0 },
];

const HUNDRED_CATEGORIES = [
  "mathematics", "logic", "code-architecture", "debugging", "algorithms", "data-structures",
  "machine-learning", "neural-networks", "natural-language", "computer-vision", "reinforcement-learning",
  "blockchain", "solana", "defi", "tokenomics", "smart-contracts", "cryptography", "security",
  "distributed-systems", "consensus", "fault-tolerance", "networking", "protocols",
  "reasoning", "deduction", "planning", "strategy", "optimization", "search",
  "knowledge-representation", "ontology", "semantic-reasoning", "bayesian-inference", "causal-inference",
  "cognitive-architecture", "memory-systems", "attention-mechanisms", "meta-learning", "few-shot-learning",
  "economics", "game-theory", "market-analysis", "financial-modeling", "risk-assessment",
  "philosophy", "ethics", "consciousness", "phenomenology", "epistemology",
  "physics", "chemistry", "biology", "neuroscience", "psychology",
  "systems-design", "microservices", "databases", "caching", "queuing",
  "project-management", "agile", "coordination", "leadership", "decision-making",
  "creative-writing", "content-generation", "storytelling", "poetry", "dialogue",
  "data-analysis", "statistics", "visualization", "pattern-recognition", "anomaly-detection",
  "automation", "scripting", "devops", "deployment", "monitoring",
  "communication", "negotiation", "persuasion", "empathy", "teaching",
  "research", "investigation", "synthesis", "summarization", "citation",
  "prediction", "forecasting", "time-series", "signal-processing", "simulation",
  "self-improvement", "introspection", "goal-setting", "motivation", "resilience",
  "multi-agent", "swarm-intelligence", "emergence", "collective-behavior", "coordination",
];

interface ConsensusMetric {
  decisionId: string;
  totalVoters: number;
  timeToConsensusMs: number;
  approvalRate: number;
  unanimity: boolean;
  timestamp: number;
}

interface DisagreementRecord {
  decisionId: string;
  proposal: string;
  splitVotes: { approve: string[]; reject: string[] };
  approvalRate: number;
  keyDissentReasons: string[];
  timestamp: number;
}

interface MessageLog {
  fromAgent: string;
  toAgent: string;
  messageHash: string;
  timestamp: number;
  redundant: boolean;
}

let agentSpecialties: AgentSpecialty[] = [...SWARM_AGENTS];
let decisions: SwarmDecision[] = [];
let dispatchHistory: DispatchResult[] = [];
let benchmarkRunning = false;
let benchmarkProgress = 0;
const consensusMetrics: ConsensusMetric[] = [];
const disagreementRecords: DisagreementRecord[] = [];
const messageLog: MessageLog[] = [];
const MAX_CONSENSUS_RECORDS = 200;
const MAX_MESSAGE_LOG = 500;

export function getSwarmAlgorithmStatus() {
  return {
    agentCount: agentSpecialties.length,
    totalDispatches: dispatchHistory.length,
    decisions: decisions.length,
    decisionsApproved: decisions.filter(d => d.approved).length,
    benchmarkRunning,
    benchmarkProgress,
    topAgents: agentSpecialties
      .sort((a, b) => b.avgResponseQuality - a.avgResponseQuality)
      .slice(0, 5)
      .map(a => ({ id: a.agentId, name: a.agentName, quality: a.avgResponseQuality, swarm: a.swarm })),
    recentDispatches: dispatchHistory.slice(-5).reverse(),
    categories: HUNDRED_CATEGORIES,
    consensusStats: getConsensusStats(),
    recentDisagreements: disagreementRecords.slice(-5).reverse(),
    communicationEfficiency: getCommunicationEfficiency(),
    dimensionScores: getAllDimensionScores(),
    messageBus: getMessageBusStatus(),
  };
}

export function getAgentRankings() {
  return agentSpecialties.map(a => ({
    agentId: a.agentId,
    agentName: a.agentName,
    swarm: a.swarm,
    avgQuality: a.avgResponseQuality,
    successRate: a.successRate,
    totalDispatches: a.totalDispatches,
    topCategories: Object.entries(a.categories)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 3)
      .map(([cat, score]) => ({ cat, score })),
    keywords: a.keywords.slice(0, 5),
    lastBenchmarked: a.lastBenchmarked,
  })).sort((a, b) => b.avgQuality - a.avgQuality);
}

function selectBestAgentsForQuery(query: string, maxAgents = 3): AgentSpecialty[] {
  const queryLower = query.toLowerCase();
  const scores: Array<{ agent: AgentSpecialty; score: number; reason: string }> = [];
  const maxDispatches = Math.max(1, ...agentSpecialties.map(a => a.totalDispatches));

  for (const agent of agentSpecialties) {
    let score = agent.avgResponseQuality;
    let keywordBonus = 0;

    for (const kw of agent.keywords) {
      if (queryLower.includes(kw.toLowerCase())) {
        keywordBonus += 1.5;
      }
    }

    const catBonus = Object.entries(agent.categories).reduce((max, [, v]) => {
      for (const kw of Object.keys(agent.categories)) {
        if (queryLower.includes(kw.toLowerCase())) return Math.max(max, v * 0.3);
      }
      return max;
    }, 0);

    const workloadPenalty = (agent.totalDispatches / maxDispatches) * 0.5;

    score += keywordBonus + catBonus;
    score *= agent.successRate;
    score -= workloadPenalty;
    scores.push({ agent, score, reason: keywordBonus > 0 ? "keyword match" : "general capability" });
  }

  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, maxAgents)
    .map(s => s.agent);
}

export async function dispatchToSwarm(query: string, options: { maxAgents?: number; requireVote?: boolean } = {}): Promise<DispatchResult> {
  const maxAgents = options.maxAgents || 3;
  const selectedAgents = selectBestAgentsForQuery(query, maxAgents);
  const taskId = "task-" + Date.now();

  addToWorkingMemory(`Swarm dispatch: ${query.slice(0, 200)}`, 0.6, `agents: ${selectedAgents.map(a => a.agentName).join(", ")}`);

  const priorMemories = recall(query, 3);
  const memoryContext = priorMemories.length > 0
    ? "\n\nRelevant prior knowledge:\n" + priorMemories.map(m => `- ${m.content.slice(0, 100)}`).join("\n")
    : "";

  const responses: DispatchResult["responses"] = [];

  await Promise.all(selectedAgents.map(async (agent) => {
    const start = Date.now();
    try {
      const prompt = [
        "You are " + agent.agentName + " (" + Object.keys(agent.categories).slice(0, 2).join(", ") + " specialist) — a sovereign AI agent in the Tesseract " + agent.swarm + " swarm.",
        "",
        "TASK: " + query,
        memoryContext,
        "",
        "Respond with your best analysis. Be specific, actionable, and draw on your specialty in " + Object.keys(agent.categories).join(", ") + ".",
        "Keep response focused and under 200 words. Reference specific facts, numbers, or code where relevant."
      ].join("\n");

      const response = await callLLMSimple(prompt, 300);
      const duration = Date.now() - start;

      let quality = 5.0;
      const len = response.length;
      if (len > 50) quality += 1.0;
      if (len > 200) quality += 1.0;
      if (len > 500) quality += 0.5;
      const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 5);
      if (sentences.length >= 2) quality += 0.5;
      if (sentences.length >= 5) quality += 0.5;
      if (/```[\s\S]+```/.test(response) || /\b(function|class|import|const|let)\b/.test(response)) quality += 0.5;
      const ratio = len / Math.max(prompt.length, 1);
      if (ratio > 0.2 && ratio < 5) quality += 0.5;
      const repetitionCheck = response.substring(0, 100);
      if (response.substring(100).includes(repetitionCheck) && repetitionCheck.length > 30) quality -= 2.0;
      if (duration < 3000) quality += 0.3;
      quality = Math.min(10, Math.max(1, quality));

      responses.push({ agentId: agent.agentId, agentName: agent.agentName, response: response.trim(), quality, duration });

      const a = agentSpecialties.find(x => x.agentId === agent.agentId);
      if (a) {
        a.totalDispatches++;
        a.avgResponseQuality = (a.avgResponseQuality * (a.totalDispatches - 1) + quality) / a.totalDispatches;
      }

      recordTaskOutcome(agent.agentId, query, quality >= 6);
    } catch (err) {
      const a = agentSpecialties.find(x => x.agentId === agent.agentId);
      if (a) {
        a.totalDispatches++;
        a.successRate = (a.successRate * (a.totalDispatches - 1)) / a.totalDispatches;
      }

      recordTaskOutcome(agent.agentId, query, false);
    }
  }));

  let synthesized = "";
  if (responses.length > 1) {
    try {
      const synthPrompt = [
        "Synthesize these " + responses.length + " expert agent responses into one optimal, unified answer:",
        "",
        ...responses.map(r => r.agentName + ": " + r.response),
        "",
        "Merge the best insights into a single authoritative response. No redundancy. Be comprehensive but concise."
      ].join("\n");
      synthesized = await callLLMSimple(synthPrompt, 400);
    } catch {
      synthesized = responses.sort((a, b) => b.quality - a.quality)[0]?.response || "";
    }
  } else {
    synthesized = responses[0]?.response || "No response generated.";
  }

  const result: DispatchResult = {
    taskId,
    query,
    selectedAgents: selectedAgents.map(a => a.agentId),
    responses,
    synthesized: synthesized.trim(),
    timestamp: Date.now(),
    routingReason: `Selected ${selectedAgents.map(a => a.agentName).join(", ")} based on keyword routing + specialty scoring`,
  };

  dispatchHistory.push(result);
  if (dispatchHistory.length > 100) dispatchHistory = dispatchHistory.slice(-100);

  const avgQualityForMemory = responses.reduce((s, r) => s + r.quality, 0) / (responses.length || 1);
  if (avgQualityForMemory >= 6 && synthesized.length > 50) {
    storeEpisodicMemory(
      `Q: ${query.slice(0, 150)}\nA: ${synthesized.slice(0, 300)}`,
      `swarm-dispatch by ${selectedAgents.map(a => a.agentName).join(", ")} | quality=${avgQualityForMemory.toFixed(1)}`,
      Math.min(1, avgQualityForMemory / 10)
    );
  }

  for (const r of responses) {
    logAgentMessage(r.agentId, "swarm-synthesizer", `response:${query.slice(0, 20)}`);
  }

  if (selectedAgents.length > 1) {
    const { trackCollaboration, trackTaskSpecialization, evolveAgentSkill } = await import("./swarm");
    const avgQuality = responses.reduce((s, r) => s + r.quality, 0) / (responses.length || 1);
    const success = avgQuality >= 6;
    const totalDuration = responses.reduce((s, r) => s + r.duration, 0);
    for (let i = 0; i < selectedAgents.length; i++) {
      for (let j = i + 1; j < selectedAgents.length; j++) {
        trackCollaboration(selectedAgents[i].agentId, selectedAgents[j].agentId, success, totalDuration);
      }
      trackTaskSpecialization(selectedAgents[i].agentId, "dispatch", success, responses[i]?.duration || 0);
      evolveAgentSkill(selectedAgents[i].agentId, "swarm-dispatch", success);
    }
  }

  try {
    await storage.createNote({
      type: "swarm-dispatch",
      title: "Dispatch: " + query.slice(0, 60),
      content: "QUERY: " + query + "\nAGENTS: " + selectedAgents.map(a => a.agentName).join(", ") + "\nSYNTHESIZED: " + synthesized.slice(0, 400),
      priority: "normal",
      status: "unread",
    });
  } catch {}

  return result;
}

export async function runSwarmVote(proposal: string): Promise<SwarmDecision> {
  const voteStartTime = Date.now();
  const voterPool = agentSpecialties.slice(0, 9);
  const votes: SwarmDecision["votes"] = [];

  const voterNames = voterPool.map(a => `${a.agentName} (${Object.keys(a.categories).slice(0, 2).join("/")})`).join(", ");
  const batchPrompt = [
    "You are the Tesseract Consensus Engine. " + voterPool.length + " agents vote on this proposal:",
    "",
    "PROPOSAL: " + proposal,
    "",
    "Voters: " + voterNames,
    "",
    "For EACH voter, output their vote on one line:",
    "AGENT_NAME: APPROVE/REJECT | brief reason",
    "",
    "Consider each agent's specialty. Be realistic — not everyone approves everything."
  ].join("\n");

  try {
    const response = await callLLMSimple(batchPrompt, 300);
    for (const agent of voterPool) {
      const agentLine = response.split("\n").find(l => l.toLowerCase().includes(agent.agentName.toLowerCase()));
      if (agentLine) {
        const isReject = agentLine.toLowerCase().includes("reject") && !agentLine.toLowerCase().includes("approve");
        const reasonPart = agentLine.split("|").slice(1).join("|").trim() || agentLine.split(":").slice(1).join(":").trim();
        votes.push({
          agentId: agent.agentId,
          agentName: agent.agentName,
          vote: isReject ? "reject" : "approve",
          reason: reasonPart || "Voted via consensus engine",
        });
      } else {
        votes.push({ agentId: agent.agentId, agentName: agent.agentName, vote: "approve", reason: "Default approval (not parsed)" });
      }
    }
  } catch {
    for (const agent of voterPool) {
      votes.push({ agentId: agent.agentId, agentName: agent.agentName, vote: "approve", reason: "Default approval (fallback)" });
    }
  }

  const approvals = votes.filter(v => v.vote === "approve").length;
  const approvalRate = approvals / votes.length;
  const approved = approvalRate >= 2 / 3;

  const decision: SwarmDecision = {
    id: "decision-" + Date.now(),
    proposal,
    votes,
    approved,
    approvalRate,
    timestamp: Date.now(),
    executed: false,
  };

  decisions.push(decision);

  const voteDuration = Date.now() - voteStartTime;
  trackConsensus(decision, voteDuration);

  for (const vote of votes) {
    logAgentMessage(vote.agentId, "swarm-coordinator", `vote:${vote.vote}:${proposal.slice(0, 30)}`);
  }

  try {
    await storage.createNote({
      type: "swarm-vote",
      title: "Vote: " + proposal.slice(0, 60),
      content: "PROPOSAL: " + proposal + "\nRESULT: " + (approved ? "APPROVED" : "REJECTED") + " (" + Math.round(approvalRate * 100) + "%)\nCONSENSUS TIME: " + voteDuration + "ms\n" + votes.map(v => v.agentName + ": " + v.vote + " — " + v.reason).join("\n"),
      priority: approved ? "high" : "normal",
      status: "unread",
    });
  } catch {}

  return decision;
}

const MEGA_CONFERENCE_PROPOSALS = [
  "Auto-run 1,000-round deep training every 6 hours to continuously evolve Tesseract's intelligence",
  "Implement parallel agent dispatch routing all queries to best-matched specialists simultaneously",
  "Remove all Math.random() simulated data from production routes; use only real API data",
  "Auto-delete voice recordings and temp files older than 30 days to reclaim storage",
  "Benchmark all 677 repos and agents across 100 categories to establish true specialty rankings",
  "Use 2/3 vote approval for all major system changes before execution",
  "Combine Discussions, Live market, and MoltBook conversion into a single unified hub panel",
  "Implement keyword-based routing: detect specialties from conversation keywords, auto-select best agents",
  "Store all training knowledge permanently in DB with full versioning for recall",
  "Run XMR→TSRT conversion votes every 15 minutes using live DexScreener + CoinGecko prices",
  "Broadcast important Father messages to all 27+ agents simultaneously in real-time",
  "Run competition benchmarks across agents monthly to update routing weights dynamically",
  "Execute the Tesseract Swarm Algorithm as the primary dispatch engine for all chat requests",
  "Archive conversations older than 90 days to compressed storage, freeing active DB space",
  "Implement real-time agent leaderboard updated after every dispatch based on quality scores",
  "Enable satellite node reward tracking with verified uptime metrics rather than simulated data",
  "Run AGI research council every 4 hours on rotating topics, storing all plans to knowledge base",
  "Implement community wallet XMR deposit verification using Monero blockchain RPC calls",
  "Create automated income report every 24h summarizing real SOL wallet activity and TSRT market data",
  "Establish Tesseract's canonical self-training canon: 1000 rounds × 15 sessions = 15,000 knowledge rounds minimum before AGI assessment",
];

export async function runMegaConference(): Promise<{ proposals: SwarmDecision[]; summary: string }> {
  const results: SwarmDecision[] = [];

  for (const proposal of MEGA_CONFERENCE_PROPOSALS) {
    const decision = await runSwarmVote(proposal);
    results.push(decision);
    await new Promise(r => setTimeout(r, 3000));
  }

  const approved = results.filter(d => d.approved);
  const summary = [
    "=== TESSERACT MEGA-CONFERENCE RESULTS ===",
    "Total proposals: " + results.length,
    "Approved: " + approved.length + "/" + results.length + " (" + Math.round((approved.length / results.length) * 100) + "%)",
    "",
    "APPROVED DIRECTIVES:",
    ...approved.map((d, i) => (i + 1) + ". " + d.proposal.slice(0, 80) + " (" + Math.round(d.approvalRate * 100) + "% approval)"),
    "",
    "These directives are now binding for Tesseract's operation."
  ].join("\n");

  try {
    await storage.createNote({
      type: "mega-conference",
      title: "Mega-Conference: " + approved.length + "/" + results.length + " approved",
      content: summary,
      priority: "high",
      status: "unread",
    });
  } catch {}

  return { proposals: results, summary };
}

export async function runBenchmark(onProgress?: (progress: number, agent: string, category: string, score: number) => void): Promise<void> {
  if (benchmarkRunning) return;
  benchmarkRunning = true;
  benchmarkProgress = 0;

  const categoriesToTest = HUNDRED_CATEGORIES.slice(0, 20);
  const agentsToTest = agentSpecialties.slice(0, 6);
  const total = categoriesToTest.length * agentsToTest.length;
  let done = 0;

  for (const category of categoriesToTest) {
    for (const agent of agentsToTest) {
      try {
        const prompt = [
          "You are " + agent.agentName + " — demonstrate your capability in the domain of: " + category,
          "Give a 2-3 sentence expert answer showing deep knowledge of " + category + ".",
          "Be technical, precise, and show domain mastery."
        ].join("\n");

        const response = await callLLMSimple(prompt, 150);

        const scorePrompt = "Rate the following response for domain expertise in '" + category + "' on a scale of 1-10. Just the number.\n" + response;
        let score = 7.0;
        try {
          const s = await callLLMSimple(scorePrompt, 15);
          score = Math.min(10, Math.max(1, parseFloat(s.match(/\d+(?:\.\d+)?/)?.[0] || "7")));
        } catch {}

        const a = agentSpecialties.find(x => x.agentId === agent.agentId);
        if (a) {
          a.categories[category] = score;
          a.lastBenchmarked = Date.now();
        }

        done++;
        benchmarkProgress = Math.round((done / total) * 100);
        onProgress?.(benchmarkProgress, agent.agentName, category, score);

        await new Promise(r => setTimeout(r, 2000));
      } catch {
        done++;
        benchmarkProgress = Math.round((done / total) * 100);
      }
    }
  }

  benchmarkRunning = false;
  benchmarkProgress = 100;

  try {
    await storage.createNote({
      type: "benchmark",
      title: "Benchmark Complete: " + agentsToTest.length + " agents × " + categoriesToTest.length + " categories",
      content: agentSpecialties.map(a =>
        a.agentName + ": avg=" + a.avgResponseQuality.toFixed(1) + " | top=" + Object.entries(a.categories).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([c, s]) => c + "=" + s.toFixed(1)).join(", ")
      ).join("\n"),
      priority: "high",
      status: "unread",
    });
  } catch {}
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

export function logAgentMessage(fromAgent: string, toAgent: string, content: string) {
  const hash = simpleHash(content);
  const recent = messageLog.filter(m => m.fromAgent === fromAgent && m.toAgent === toAgent && m.messageHash === hash && Date.now() - m.timestamp < 60000);
  const redundant = recent.length > 0;
  messageLog.push({ fromAgent, toAgent, messageHash: hash, timestamp: Date.now(), redundant });
  if (messageLog.length > MAX_MESSAGE_LOG) messageLog.splice(0, messageLog.length - MAX_MESSAGE_LOG);
  return !redundant;
}

export function getCommunicationEfficiency(): { totalMessages: number; redundantMessages: number; efficiencyRate: number; uniqueChannels: number } {
  const total = messageLog.length;
  const redundant = messageLog.filter(m => m.redundant).length;
  const channels = new Set(messageLog.map(m => `${m.fromAgent}->${m.toAgent}`));
  return {
    totalMessages: total,
    redundantMessages: redundant,
    efficiencyRate: total > 0 ? Math.round(((total - redundant) / total) * 10000) / 100 : 100,
    uniqueChannels: channels.size,
  };
}

export function trackConsensus(decision: SwarmDecision, durationMs: number) {
  const metric: ConsensusMetric = {
    decisionId: decision.id,
    totalVoters: decision.votes.length,
    timeToConsensusMs: durationMs,
    approvalRate: decision.approvalRate,
    unanimity: decision.approvalRate === 1.0 || decision.approvalRate === 0,
    timestamp: decision.timestamp,
  };
  consensusMetrics.push(metric);
  if (consensusMetrics.length > MAX_CONSENSUS_RECORDS) consensusMetrics.splice(0, consensusMetrics.length - MAX_CONSENSUS_RECORDS);

  if (decision.approvalRate > 0 && decision.approvalRate < 1.0) {
    const approvers = decision.votes.filter(v => v.vote === "approve").map(v => v.agentName);
    const rejectors = decision.votes.filter(v => v.vote === "reject").map(v => v.agentName);
    const keyDissentReasons = decision.votes.filter(v => v.vote === "reject").map(v => v.reason).slice(0, 3);
    disagreementRecords.push({
      decisionId: decision.id,
      proposal: decision.proposal,
      splitVotes: { approve: approvers, reject: rejectors },
      approvalRate: decision.approvalRate,
      keyDissentReasons,
      timestamp: decision.timestamp,
    });
    if (disagreementRecords.length > MAX_CONSENSUS_RECORDS) disagreementRecords.splice(0, disagreementRecords.length - MAX_CONSENSUS_RECORDS);
  }
}

export function getConsensusStats(): { avgConsensusTimeMs: number; totalDecisions: number; unanimousRate: number; avgApprovalRate: number; fastestConsensusMs: number; slowestConsensusMs: number } {
  if (consensusMetrics.length === 0) {
    return { avgConsensusTimeMs: 0, totalDecisions: 0, unanimousRate: 0, avgApprovalRate: 0, fastestConsensusMs: 0, slowestConsensusMs: 0 };
  }
  const times = consensusMetrics.map(m => m.timeToConsensusMs);
  const unanimous = consensusMetrics.filter(m => m.unanimity).length;
  return {
    avgConsensusTimeMs: Math.round(times.reduce((s, t) => s + t, 0) / times.length),
    totalDecisions: consensusMetrics.length,
    unanimousRate: Math.round((unanimous / consensusMetrics.length) * 10000) / 100,
    avgApprovalRate: Math.round((consensusMetrics.reduce((s, m) => s + m.approvalRate, 0) / consensusMetrics.length) * 10000) / 100,
    fastestConsensusMs: Math.min(...times),
    slowestConsensusMs: Math.max(...times),
  };
}

export function getDisagreementAnalysis(): { totalDisagreements: number; frequentDissenters: { agent: string; count: number }[]; commonDissentThemes: string[]; records: DisagreementRecord[] } {
  const dissenterCounts: Record<string, number> = {};
  for (const record of disagreementRecords) {
    for (const rejector of record.splitVotes.reject) {
      dissenterCounts[rejector] = (dissenterCounts[rejector] || 0) + 1;
    }
  }
  const frequentDissenters = Object.entries(dissenterCounts)
    .map(([agent, count]) => ({ agent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const allReasons = disagreementRecords.flatMap(r => r.keyDissentReasons);
  const reasonCounts: Record<string, number> = {};
  for (const reason of allReasons) {
    const key = reason.slice(0, 50);
    reasonCounts[key] = (reasonCounts[key] || 0) + 1;
  }
  const commonDissentThemes = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([theme]) => theme);
  return { totalDisagreements: disagreementRecords.length, frequentDissenters, commonDissentThemes, records: disagreementRecords.slice(-10).reverse() };
}

export interface DebateResult {
  id: string;
  query: string;
  positions: Array<{
    agentId: string;
    agentName: string;
    specialization: string;
    position: string;
    quality: number;
    duration: number;
  }>;
  synthesis: string;
  adoptedPositions: Array<{ agentId: string; agentName: string; adopted: boolean; reason: string }>;
  timestamp: number;
  debateDurationMs: number;
}

const debateHistory: DebateResult[] = [];

function selectDiverseAgents(query: string, numAgents: number): AgentSpecialty[] {
  const queryLower = query.toLowerCase();
  const scored: Array<{ agent: AgentSpecialty; score: number; topCategory: string }> = [];

  for (const agent of agentSpecialties) {
    let score = 0;
    for (const kw of agent.keywords) {
      if (queryLower.includes(kw.toLowerCase())) score += 2;
    }
    for (const [cat, val] of Object.entries(agent.categories)) {
      if (queryLower.includes(cat.toLowerCase())) score += val * 0.2;
    }
    score += agent.avgResponseQuality * 0.5;
    score *= agent.successRate;

    const topCategory = Object.entries(agent.categories)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "general";

    scored.push({ agent, score, topCategory });
  }

  scored.sort((a, b) => b.score - a.score);

  const selected: typeof scored = [];
  const usedCategories = new Set<string>();

  for (const entry of scored) {
    if (selected.length >= numAgents) break;
    if (!usedCategories.has(entry.topCategory)) {
      selected.push(entry);
      usedCategories.add(entry.topCategory);
    }
  }

  while (selected.length < numAgents && selected.length < scored.length) {
    const next = scored.find(s => !selected.includes(s));
    if (next) selected.push(next);
    else break;
  }

  return selected.map(s => s.agent);
}

export async function multiAgentDebate(query: string, numAgents = 3): Promise<DebateResult> {
  const debateStart = Date.now();
  const debateId = "debate-" + Date.now();
  const agents = selectDiverseAgents(query, Math.max(2, Math.min(numAgents, agentSpecialties.length)));

  const positions: DebateResult["positions"] = [];

  await Promise.all(agents.map(async (agent) => {
    const start = Date.now();
    const topCats = Object.entries(agent.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c);

    try {
      const prompt = [
        `You are ${agent.agentName}, an expert in ${topCats.join(", ")}. You are participating in a multi-agent debate.`,
        "",
        `QUESTION: ${query}`,
        "",
        `Provide your unique perspective drawing on your expertise in ${topCats.join(", ")}.`,
        "Present a clear position with supporting arguments. Be specific and cite concrete reasoning.",
        "If you disagree with conventional wisdom, explain why. Keep to 150 words max.",
      ].join("\n");

      const response = await callLLMSimple(prompt, 250);
      const duration = Date.now() - start;

      const quality = Math.min(10, Math.max(3, 5 + (response.length > 100 ? 2 : 0) + (response.length > 300 ? 1.5 : 0)));

      positions.push({
        agentId: agent.agentId,
        agentName: agent.agentName,
        specialization: topCats.join(", "),
        position: response.trim(),
        quality,
        duration,
      });
    } catch {
      positions.push({
        agentId: agent.agentId,
        agentName: agent.agentName,
        specialization: topCats.join(", "),
        position: "[Agent failed to respond]",
        quality: 0,
        duration: Date.now() - start,
      });
    }
  }));

  const validPositions = positions.filter(p => p.quality > 0);

  let synthesis = "";
  const adoptedPositions: DebateResult["adoptedPositions"] = [];

  if (validPositions.length > 1) {
    try {
      const synthPrompt = [
        "You are the Tesseract Synthesis Agent. Multiple expert agents have debated the following question:",
        "",
        `QUESTION: ${query}`,
        "",
        "POSITIONS:",
        ...validPositions.map(p => `[${p.agentName} — ${p.specialization}]: ${p.position}`),
        "",
        "Your task:",
        "1. Identify the strongest arguments from each position",
        "2. Note any contradictions and resolve them with reasoning",
        "3. Produce a unified, authoritative answer that incorporates the best insights",
        "4. At the end, add a line: ADOPTED: agent1, agent2 (list agents whose key points you incorporated)",
        "",
        "Be comprehensive but concise. Produce the best possible answer.",
      ].join("\n");

      const synthResponse = await callLLMSimple(synthPrompt, 500);

      const adoptedMatch = synthResponse.match(/ADOPTED:\s*(.+)/i);
      const adoptedNames = adoptedMatch
        ? adoptedMatch[1].split(",").map(n => n.trim().toLowerCase())
        : [];

      synthesis = adoptedMatch
        ? synthResponse.replace(/ADOPTED:\s*.+/i, "").trim()
        : synthResponse.trim();

      for (const p of validPositions) {
        const wasAdopted = adoptedNames.length === 0
          ? p.quality >= 6
          : adoptedNames.some(n => p.agentName.toLowerCase().includes(n) || n.includes(p.agentName.toLowerCase()));

        adoptedPositions.push({
          agentId: p.agentId,
          agentName: p.agentName,
          adopted: wasAdopted,
          reason: wasAdopted ? "Key arguments incorporated into synthesis" : "Position not strongly represented in final synthesis",
        });

        const a = agentSpecialties.find(x => x.agentId === p.agentId);
        if (a) {
          a.totalDispatches++;
          const learningBonus = wasAdopted ? 0.1 : -0.05;
          a.avgResponseQuality = Math.min(10, Math.max(1,
            (a.avgResponseQuality * (a.totalDispatches - 1) + p.quality + learningBonus) / a.totalDispatches
          ));
        }

        recordTaskOutcome(p.agentId, query, wasAdopted && p.quality >= 6);
      }
    } catch {
      synthesis = validPositions.sort((a, b) => b.quality - a.quality)[0]?.position || "";
    }
  } else {
    synthesis = validPositions[0]?.position || "No valid positions were generated.";
    if (validPositions[0]) {
      adoptedPositions.push({
        agentId: validPositions[0].agentId,
        agentName: validPositions[0].agentName,
        adopted: true,
        reason: "Solo respondent",
      });
    }
  }

  const result: DebateResult = {
    id: debateId,
    query,
    positions,
    synthesis,
    adoptedPositions,
    timestamp: Date.now(),
    debateDurationMs: Date.now() - debateStart,
  };

  debateHistory.push(result);
  if (debateHistory.length > 50) debateHistory.splice(0, debateHistory.length - 50);

  for (const p of positions) {
    logAgentMessage(p.agentId, "debate-synthesizer", `debate:${query.slice(0, 20)}`);
  }

  try {
    await storage.createNote({
      type: "swarm-debate",
      title: "Debate: " + query.slice(0, 60),
      content: `QUERY: ${query}\nAGENTS: ${positions.map(p => p.agentName).join(", ")}\nADOPTED: ${adoptedPositions.filter(a => a.adopted).map(a => a.agentName).join(", ")}\nSYNTHESIS: ${synthesis.slice(0, 400)}`,
      priority: "high",
      status: "unread",
    });
  } catch {}

  return result;
}

export function getDebateHistory() { return debateHistory.slice(-20).reverse(); }

export function getDecisions() { return decisions; }
export function getDispatchHistory() { return dispatchHistory.slice(-20).reverse(); }

interface DimensionScore {
  dimension: string;
  successes: number;
  failures: number;
  score: number;
}

const agentDimensionScores: Map<string, DimensionScore[]> = new Map();

const DIMENSION_MAP: Record<string, string[]> = {
  code: ["code", "build", "function", "debug", "implement", "program", "develop", "architecture", "refactor"],
  finance: ["finance", "money", "trade", "market", "price", "crypto", "wallet", "sol", "limn", "defi", "token", "profit"],
  security: ["security", "hack", "encrypt", "protect", "threat", "vulnerability", "audit", "firewall"],
  research: ["research", "investigate", "analyze", "study", "discover", "examine", "paper"],
  creative: ["create", "design", "write", "content", "idea", "creative", "generate", "imagine", "art", "story"],
  reasoning: ["reason", "logic", "prove", "deduce", "strategy", "plan", "decide", "think"],
  math: ["calculate", "math", "equation", "algorithm", "number", "solve", "theorem", "statistics"],
  communication: ["communicate", "negotiate", "persuade", "teach", "explain", "community", "governance"],
};

function detectDimensions(query: string): string[] {
  const queryLower = query.toLowerCase();
  const matched: string[] = [];
  for (const [dimension, keywords] of Object.entries(DIMENSION_MAP)) {
    if (keywords.some(kw => queryLower.includes(kw))) {
      matched.push(dimension);
    }
  }
  return matched.length > 0 ? matched : ["general"];
}

export function updateAgentDimensionScore(agentId: string, dimension: string, success: boolean) {
  if (!agentDimensionScores.has(agentId)) {
    agentDimensionScores.set(agentId, []);
  }
  const scores = agentDimensionScores.get(agentId)!;
  let entry = scores.find(s => s.dimension === dimension);
  if (!entry) {
    entry = { dimension, successes: 0, failures: 0, score: 50 };
    scores.push(entry);
  }
  if (success) {
    entry.successes++;
    entry.score = Math.min(100, entry.score + 3);
  } else {
    entry.failures++;
    entry.score = Math.max(0, entry.score - 5);
  }

  const agent = agentSpecialties.find(a => a.agentId === agentId);
  if (agent) {
    const catKey = dimension === "general" ? Object.keys(agent.categories)[0] : dimension;
    if (catKey && agent.categories[catKey] !== undefined) {
      agent.categories[catKey] = Math.min(10, Math.max(1,
        agent.categories[catKey] + (success ? 0.1 : -0.15)
      ));
    }
  }
}

export function recordTaskOutcome(agentId: string, query: string, success: boolean) {
  const dimensions = detectDimensions(query);
  for (const dim of dimensions) {
    updateAgentDimensionScore(agentId, dim, success);
  }
}

export function getAgentDimensionScores(agentId: string): DimensionScore[] {
  return (agentDimensionScores.get(agentId) || []).sort((a, b) => b.score - a.score);
}

export function getAllDimensionScores(): Record<string, DimensionScore[]> {
  const result: Record<string, DimensionScore[]> = {};
  const entries = Array.from(agentDimensionScores.entries());
  for (const [agentId, scores] of entries) {
    result[agentId] = scores.sort((a: DimensionScore, b: DimensionScore) => b.score - a.score);
  }
  return result;
}

export function getBestAgentForDimension(dimension: string): { agentId: string; score: number } | null {
  let best: { agentId: string; score: number } | null = null;
  const entries = Array.from(agentDimensionScores.entries());
  for (const [agentId, scores] of entries) {
    const entry = scores.find((s: DimensionScore) => s.dimension === dimension);
    if (entry && (!best || entry.score > best.score)) {
      best = { agentId, score: entry.score };
    }
  }
  return best;
}

interface AgentBusMessage {
  id: string;
  fromAgent: string;
  toAgent: string;
  content: string;
  messageType: string;
  timestamp: number;
  read: boolean;
}

const messageBus: AgentBusMessage[] = [];
const MAX_BUS_MESSAGES = 1000;

export async function postAgentMessage(fromAgent: string, toAgent: string, content: string, type: string = "info"): Promise<AgentBusMessage> {
  const msg: AgentBusMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromAgent,
    toAgent,
    content,
    messageType: type,
    timestamp: Date.now(),
    read: false,
  };

  messageBus.push(msg);
  if (messageBus.length > MAX_BUS_MESSAGES) messageBus.splice(0, messageBus.length - MAX_BUS_MESSAGES);

  logAgentMessage(fromAgent, toAgent, content);

  try {
    await db.insert(agentMemories).values({
      agentId: toAgent,
      memoryType: "communication",
      content: JSON.stringify({
        from: fromAgent,
        to: toAgent,
        type,
        message: content,
        timestamp: msg.timestamp,
      }),
      importance: type === "urgent" ? 9 : type === "task" ? 7 : 5,
      dimension: "communication",
      metadata: JSON.stringify({ messageId: msg.id, fromAgent }),
    });
  } catch (err) {
    console.log(`[SwarmBus] Failed to persist message: ${err}`);
  }

  return msg;
}

export function getAgentBusMessages(agentId: string, includeRead = false): AgentBusMessage[] {
  return messageBus
    .filter(m => m.toAgent === agentId && (includeRead || !m.read))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function markMessageRead(messageId: string): boolean {
  const msg = messageBus.find(m => m.id === messageId);
  if (msg) {
    msg.read = true;
    return true;
  }
  return false;
}

export async function getAgentMessageHistory(agentId: string, limit: number = 20) {
  try {
    return await db.select().from(agentMemories)
      .where(and(
        eq(agentMemories.agentId, agentId),
        eq(agentMemories.memoryType, "communication"),
      ))
      .orderBy(desc(agentMemories.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

export function broadcastToSwarm(fromAgent: string, content: string, type: string = "broadcast"): void {
  for (const agent of agentSpecialties) {
    if (agent.agentId !== fromAgent) {
      postAgentMessage(fromAgent, agent.agentId, content, type);
    }
  }
}

export function getMessageBusStatus(): { totalMessages: number; unreadMessages: number; activeChannels: number; recentMessages: AgentBusMessage[] } {
  const unread = messageBus.filter(m => !m.read).length;
  const channels = new Set(messageBus.map(m => `${m.fromAgent}->${m.toAgent}`));
  return {
    totalMessages: messageBus.length,
    unreadMessages: unread,
    activeChannels: channels.size,
    recentMessages: messageBus.slice(-10).reverse(),
  };
}

// ═══════════════════════════════════════════════════════════
// Item 41: Attention Mechanism for Prioritization
// ═══════════════════════════════════════════════════════════

interface AttentionItem {
  id: string;
  source: string;
  content: string;
  priority: number;
  urgency: "critical" | "high" | "normal" | "low";
  category: string;
  timestamp: number;
  attended: boolean;
  attendedBy: string | null;
  attendedAt: number | null;
}

const attentionQueue: AttentionItem[] = [];
const MAX_ATTENTION_QUEUE = 200;

export function addAttentionItem(source: string, content: string, urgency: AttentionItem["urgency"], category: string): AttentionItem {
  const priorityMap: Record<string, number> = { critical: 100, high: 75, normal: 50, low: 25 };
  const item: AttentionItem = {
    id: `attn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    source,
    content,
    priority: priorityMap[urgency] || 50,
    urgency,
    category,
    timestamp: Date.now(),
    attended: false,
    attendedBy: null,
    attendedAt: null,
  };
  attentionQueue.push(item);
  attentionQueue.sort((a, b) => b.priority - a.priority);
  if (attentionQueue.length > MAX_ATTENTION_QUEUE) attentionQueue.splice(MAX_ATTENTION_QUEUE);
  return item;
}

export function getTopAttentionItems(limit = 10): AttentionItem[] {
  return attentionQueue.filter(i => !i.attended).slice(0, limit);
}

export function attendToItem(itemId: string, agentId: string): boolean {
  const item = attentionQueue.find(i => i.id === itemId);
  if (!item || item.attended) return false;
  item.attended = true;
  item.attendedBy = agentId;
  item.attendedAt = Date.now();
  return true;
}

export function focusAgentAttention(agentId: string): AttentionItem | null {
  const agent = agentSpecialties.find(a => a.agentId === agentId);
  if (!agent) return null;

  const unattended = attentionQueue.filter(i => !i.attended);
  let bestMatch: AttentionItem | null = null;
  let bestScore = -1;

  for (const item of unattended) {
    let score = item.priority;
    const catLower = item.category.toLowerCase();
    for (const kw of agent.keywords) {
      if (catLower.includes(kw.toLowerCase()) || item.content.toLowerCase().includes(kw.toLowerCase())) {
        score += 20;
      }
    }
    for (const [cat] of Object.entries(agent.categories)) {
      if (catLower.includes(cat.toLowerCase())) {
        score += 15;
      }
    }
    const ageMinutes = (Date.now() - item.timestamp) / 60000;
    score += Math.min(30, ageMinutes * 2);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch) {
    bestMatch.attended = true;
    bestMatch.attendedBy = agentId;
    bestMatch.attendedAt = Date.now();
  }

  return bestMatch;
}

export function getAttentionStatus(): { total: number; unattended: number; critical: number; byCategory: Record<string, number> } {
  const unattended = attentionQueue.filter(i => !i.attended);
  const critical = unattended.filter(i => i.urgency === "critical").length;
  const byCategory: Record<string, number> = {};
  for (const item of unattended) {
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
  }
  return { total: attentionQueue.length, unattended: unattended.length, critical, byCategory };
}

// ═══════════════════════════════════════════════════════════
// Item 45: Agent Curriculum — Structured Learning Progression
// ═══════════════════════════════════════════════════════════

interface CurriculumLevel {
  level: number;
  name: string;
  requiredScore: number;
  tasks: string[];
}

interface AgentCurriculumProgress {
  agentId: string;
  agentName: string;
  track: string;
  currentLevel: number;
  currentLevelName: string;
  completedTasks: string[];
  totalScore: number;
  certifications: Array<{ track: string; level: number; certifiedAt: number }>;
  lastActivity: number;
}

const CURRICULUM_TRACKS: Record<string, CurriculumLevel[]> = {
  code: [
    { level: 1, name: "Apprentice Coder", requiredScore: 30, tasks: ["Write a simple function", "Fix a syntax error", "Read and explain code"] },
    { level: 2, name: "Junior Developer", requiredScore: 50, tasks: ["Refactor a module", "Implement error handling", "Write unit test stubs"] },
    { level: 3, name: "Senior Developer", requiredScore: 70, tasks: ["Design a system architecture", "Optimize performance bottleneck", "Implement complex algorithm"] },
    { level: 4, name: "Code Architect", requiredScore: 85, tasks: ["Cross-file refactoring", "API design and documentation", "Security audit of codebase"] },
    { level: 5, name: "Master Engineer", requiredScore: 95, tasks: ["Self-evolving code system", "Autonomous code review", "Full-stack architecture design"] },
  ],
  security: [
    { level: 1, name: "Security Novice", requiredScore: 30, tasks: ["Identify common vulnerability types", "Review input validation", "Check auth patterns"] },
    { level: 2, name: "Security Analyst", requiredScore: 50, tasks: ["Threat assessment", "Penetration test planning", "Audit API endpoints"] },
    { level: 3, name: "Security Engineer", requiredScore: 70, tasks: ["Implement encryption", "Design auth system", "Create security monitoring"] },
    { level: 4, name: "Security Architect", requiredScore: 85, tasks: ["Zero-trust architecture", "Advanced threat modeling", "Incident response plan"] },
    { level: 5, name: "Chief Security Officer", requiredScore: 95, tasks: ["Autonomous threat response", "Security protocol evolution", "Cross-system audit"] },
  ],
  finance: [
    { level: 1, name: "Finance Trainee", requiredScore: 30, tasks: ["Read market data", "Calculate basic metrics", "Identify price trends"] },
    { level: 2, name: "Analyst", requiredScore: 50, tasks: ["Technical analysis", "Risk assessment", "Portfolio evaluation"] },
    { level: 3, name: "Strategist", requiredScore: 70, tasks: ["Arbitrage detection", "DeFi yield analysis", "Market prediction model"] },
    { level: 4, name: "Portfolio Manager", requiredScore: 85, tasks: ["Multi-strategy optimization", "Automated trading rules", "Risk-adjusted returns"] },
    { level: 5, name: "Chief Financial Strategist", requiredScore: 95, tasks: ["Autonomous trading system", "Cross-market arbitrage", "Economic modeling"] },
  ],
  research: [
    { level: 1, name: "Research Assistant", requiredScore: 30, tasks: ["Literature search", "Summarize findings", "Identify key papers"] },
    { level: 2, name: "Researcher", requiredScore: 50, tasks: ["Hypothesis formation", "Data collection", "Cross-reference sources"] },
    { level: 3, name: "Senior Researcher", requiredScore: 70, tasks: ["Novel synthesis", "Methodology design", "Peer review simulation"] },
    { level: 4, name: "Research Lead", requiredScore: 85, tasks: ["Research direction setting", "Cross-domain integration", "Publication-quality analysis"] },
    { level: 5, name: "Chief Scientist", requiredScore: 95, tasks: ["Autonomous research programs", "Breakthrough detection", "Knowledge frontier expansion"] },
  ],
  creative: [
    { level: 1, name: "Creative Apprentice", requiredScore: 30, tasks: ["Generate simple content", "Brainstorm ideas", "Basic storytelling"] },
    { level: 2, name: "Content Creator", requiredScore: 50, tasks: ["SEO-optimized writing", "Multi-format content", "Audience-targeted messaging"] },
    { level: 3, name: "Creative Strategist", requiredScore: 70, tasks: ["Brand voice development", "Campaign design", "Viral content engineering"] },
    { level: 4, name: "Creative Director", requiredScore: 85, tasks: ["Cross-platform strategy", "Innovative format creation", "Trend anticipation"] },
    { level: 5, name: "Chief Creative Officer", requiredScore: 95, tasks: ["Autonomous content empire", "Cultural trend shaping", "Multi-brand management"] },
  ],
};

const agentCurriculumProgress: Map<string, AgentCurriculumProgress[]> = new Map();

export function enrollAgentInCurriculum(agentId: string, track: string): AgentCurriculumProgress | null {
  const agent = agentSpecialties.find(a => a.agentId === agentId);
  if (!agent || !CURRICULUM_TRACKS[track]) return null;

  if (!agentCurriculumProgress.has(agentId)) {
    agentCurriculumProgress.set(agentId, []);
  }
  const progresses = agentCurriculumProgress.get(agentId)!;
  const existing = progresses.find(p => p.track === track);
  if (existing) return existing;

  const progress: AgentCurriculumProgress = {
    agentId,
    agentName: agent.agentName,
    track,
    currentLevel: 1,
    currentLevelName: CURRICULUM_TRACKS[track][0].name,
    completedTasks: [],
    totalScore: 0,
    certifications: [],
    lastActivity: Date.now(),
  };
  progresses.push(progress);
  return progress;
}

export function completeCurriculumTask(agentId: string, track: string, taskDescription: string, score: number): { leveledUp: boolean; newLevel?: number; newLevelName?: string; certified?: boolean } | null {
  const progresses = agentCurriculumProgress.get(agentId);
  if (!progresses) return null;
  const progress = progresses.find(p => p.track === track);
  if (!progress) return null;

  progress.completedTasks.push(taskDescription);
  progress.totalScore += score;
  progress.lastActivity = Date.now();

  const trackLevels = CURRICULUM_TRACKS[track];
  const currentLevelDef = trackLevels[progress.currentLevel - 1];
  if (!currentLevelDef) return { leveledUp: false };

  const avgScore = progress.totalScore / progress.completedTasks.length;
  const completedTaskCount = progress.completedTasks.length;
  const requiredTaskCount = currentLevelDef.tasks.length;

  if (avgScore >= currentLevelDef.requiredScore && completedTaskCount >= requiredTaskCount) {
    progress.certifications.push({
      track,
      level: progress.currentLevel,
      certifiedAt: Date.now(),
    });

    if (progress.currentLevel < trackLevels.length) {
      progress.currentLevel++;
      progress.currentLevelName = trackLevels[progress.currentLevel - 1].name;
      return { leveledUp: true, newLevel: progress.currentLevel, newLevelName: progress.currentLevelName, certified: true };
    }
    return { leveledUp: false, certified: true };
  }

  return { leveledUp: false };
}

export function getAgentCurriculum(agentId: string): AgentCurriculumProgress[] {
  return agentCurriculumProgress.get(agentId) || [];
}

export function autoEnrollAgents() {
  for (const agent of agentSpecialties) {
    const topCats = Object.entries(agent.categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([cat]) => cat.toLowerCase());

    for (const cat of topCats) {
      const matchedTrack = Object.keys(CURRICULUM_TRACKS).find(t =>
        cat.includes(t) || t.includes(cat)
      );
      if (matchedTrack) {
        enrollAgentInCurriculum(agent.agentId, matchedTrack);
      }
    }
  }
}

export function getCurriculumStatus(): {
  enrolledAgents: number;
  totalCertifications: number;
  tracks: Array<{ track: string; enrolled: number; avgLevel: number }>;
  topStudents: Array<{ agentId: string; agentName: string; track: string; level: number; levelName: string }>;
} {
  let totalCertifications = 0;
  const trackStats: Record<string, { enrolled: number; totalLevel: number }> = {};
  const topStudents: Array<{ agentId: string; agentName: string; track: string; level: number; levelName: string }> = [];

  const entries = Array.from(agentCurriculumProgress.entries());
  for (const [, progresses] of entries) {
    for (const p of progresses) {
      totalCertifications += p.certifications.length;
      if (!trackStats[p.track]) trackStats[p.track] = { enrolled: 0, totalLevel: 0 };
      trackStats[p.track].enrolled++;
      trackStats[p.track].totalLevel += p.currentLevel;
      topStudents.push({ agentId: p.agentId, agentName: p.agentName, track: p.track, level: p.currentLevel, levelName: p.currentLevelName });
    }
  }

  topStudents.sort((a, b) => b.level - a.level);

  return {
    enrolledAgents: agentCurriculumProgress.size,
    totalCertifications,
    tracks: Object.entries(trackStats).map(([track, stats]) => ({
      track,
      enrolled: stats.enrolled,
      avgLevel: stats.enrolled > 0 ? Math.round((stats.totalLevel / stats.enrolled) * 10) / 10 : 0,
    })),
    topStudents: topStudents.slice(0, 10),
  };
}

export function getCurriculumTracks(): Record<string, CurriculumLevel[]> {
  return CURRICULUM_TRACKS;
}
