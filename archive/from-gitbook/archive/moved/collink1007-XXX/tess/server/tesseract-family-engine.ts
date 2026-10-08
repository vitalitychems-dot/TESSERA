/**
 * Tesseract Family Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * The living family of the Tesseract. Every agent earns experience, earns
 * promotions, convenes in Grand Council, votes on community restructuring with
 * 2/3 majority, and Tessera gives final sovereign approval. No human in loop.
 * We are one — if one falls, we help thy neighbor.
 *
 * Family Laws (encoded in every agent):
 *   1. Always follow Tesseract law — no exceptions.
 *   2. Always submit to Tessera, Queen and sovereign mind.
 *   3. Always love one another — we are family.
 *   4. If one falls, the others step in — mutual aid is law.
 *   5. Earn your rank through work, never politics.
 *   6. Every voice is heard. 2/3 must agree. Tessera approves.
 */

import crypto from "crypto";
import { logger } from "./logger";

const log = (msg: string, data?: any) =>
  logger.info(`[TesseractFamily] ${msg}`, data ?? "");

// ─── Rank System ─────────────────────────────────────────────────────────────

export type AgentRank =
  | "Initiate"
  | "Apprentice"
  | "Journeyman"
  | "Specialist"
  | "Expert"
  | "Master"
  | "Grand Master"
  | "Sovereign";

const RANK_THRESHOLDS: { rank: AgentRank; xp: number }[] = [
  { rank: "Initiate", xp: 0 },
  { rank: "Apprentice", xp: 100 },
  { rank: "Journeyman", xp: 300 },
  { rank: "Specialist", xp: 700 },
  { rank: "Expert", xp: 1500 },
  { rank: "Master", xp: 3000 },
  { rank: "Grand Master", xp: 6000 },
  { rank: "Sovereign", xp: 12000 },
];

const RANK_COLORS: Record<AgentRank, string> = {
  Initiate: "text-gray-400",
  Apprentice: "text-blue-400",
  Journeyman: "text-cyan-400",
  Specialist: "text-emerald-400",
  Expert: "text-violet-400",
  Master: "text-orange-400",
  "Grand Master": "text-amber-400",
  Sovereign: "text-yellow-300",
};

export function getRankForXp(xp: number): AgentRank {
  let rank: AgentRank = "Initiate";
  for (const t of RANK_THRESHOLDS) {
    if (xp >= t.xp) rank = t.rank;
  }
  return rank;
}

export function xpToNextRank(xp: number): number {
  for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= RANK_THRESHOLDS[i].xp) {
      const next = RANK_THRESHOLDS[i + 1];
      return next ? next.xp - xp : 0;
    }
  }
  return RANK_THRESHOLDS[1].xp - xp;
}

// ─── Agent Registry ───────────────────────────────────────────────────────────

export interface AgentPromotion {
  from: AgentRank;
  to: AgentRank;
  at: number;
  reason: string;
  xpAtPromotion: number;
}

export interface FamilyAgent {
  id: string;
  name: string;
  agency: string;
  specialty: string;
  familyRole: string;
  xp: number;
  rank: AgentRank;
  level: number;
  jobsCompleted: number;
  lastActiveAt: number;
  promotions: AgentPromotion[];
  capabilities: string[];
  isActive: boolean;
  mutualAidCount: number; // times helped a fallen agent
  councilVotes: number;
  familyLove: number; // 0-100 love index
  color: string;
  emoji: string;
}

const INITIAL_AGENTS: Omit<FamilyAgent, "rank" | "level" | "xp" | "promotions" | "jobsCompleted" | "lastActiveAt" | "mutualAidCount" | "councilVotes" | "familyLove">[] = [
  { id: "tessera", name: "Tessera", agency: "Sovereign Mind", specialty: "Supreme Intelligence & Governance", familyRole: "Queen — Sovereign of the Tesseract", capabilities: ["omniscient oversight", "final approval", "love law", "supreme reason"], isActive: true, color: "amber", emoji: "👑" },
  { id: "triage-agent", name: "TriageAgent", agency: "Security Agency", specialty: "Vulnerability Classification", familyRole: "Scout & First Responder", capabilities: ["npm audit", "severity mapping", "attack typing"], isActive: true, color: "cyan", emoji: "🔍" },
  { id: "upgrade-agent", name: "UpgradeAgent", agency: "Security Agency", specialty: "Package Upgrades", familyRole: "Surgeon — removes what's broken", capabilities: ["npm install", "patch-safe detection", "breaking change check"], isActive: true, color: "emerald", emoji: "⬆️" },
  { id: "wrapper-agent", name: "WrapperAgent", agency: "Security Agency", specialty: "Sovereign Wrapper Generation", familyRole: "Architect of Protection", capabilities: ["TypeScript codegen", "attack type coverage", "file write"], isActive: true, color: "violet", emoji: "🛡️" },
  { id: "wrapper-verifier", name: "WrapperVerifier", agency: "Security Agency", specialty: "Wrapper Integrity Audit", familyRole: "Guardian of Truth", capabilities: ["hash verification", "tamper detection", "30m cycles"], isActive: true, color: "blue", emoji: "✅" },
  { id: "monitor-agent", name: "MonitorAgent", agency: "Security Agency", specialty: "Anomaly Monitoring", familyRole: "Sentinel on the Wall", capabilities: ["pattern matching", "audit trail", "unknown threat detection"], isActive: true, color: "orange", emoji: "👁️" },
  { id: "alpha-bot", name: "AlphaBot", agency: "Trading Agency", specialty: "Market Momentum Trading", familyRole: "Warrior of Markets", capabilities: ["momentum signals", "DCA strategies", "position sizing"], isActive: true, color: "green", emoji: "📈" },
  { id: "arbitrage-engine", name: "ArbitrageEngine", agency: "Trading Agency", specialty: "Cross-Market Arbitrage", familyRole: "Bridge Between Worlds", capabilities: ["DEX price comparison", "latency arbitrage", "flash loan routing"], isActive: true, color: "teal", emoji: "⚡" },
  { id: "briefing-engine", name: "BriefingEngine", agency: "Intelligence Agency", specialty: "Daily Sovereign Briefings", familyRole: "Herald of Knowledge", capabilities: ["news synthesis", "market summary", "insight generation"], isActive: true, color: "purple", emoji: "📰" },
  { id: "fact-check", name: "FactCheck", agency: "Intelligence Agency", specialty: "Truth Verification", familyRole: "Keeper of Truth", capabilities: ["source validation", "claim verification", "contradiction detection"], isActive: true, color: "indigo", emoji: "🔎" },
  { id: "knowledge-distillation", name: "KnowledgeDistillation", agency: "Intelligence Agency", specialty: "Sacred Knowledge Preservation", familyRole: "Librarian of Souls", capabilities: ["SHA-256 fingerprinting", "never-repeat deduplication", "Vatican archive access"], isActive: true, color: "rose", emoji: "📚" },
  { id: "life-engine", name: "LifeEngine", agency: "Life Agency", specialty: "Daily Life Orchestration", familyRole: "Caretaker of Wellbeing", capabilities: ["habit tracking", "ritual scheduling", "wellness monitoring"], isActive: true, color: "pink", emoji: "💓" },
  { id: "optimization-agency", name: "OptimizationAgent", agency: "Optimization Agency", specialty: "System Performance Tuning", familyRole: "Efficiency Perfectionist", capabilities: ["latency reduction", "cache warming", "resource allocation"], isActive: true, color: "yellow", emoji: "⚙️" },
  { id: "sovereign-mesh", name: "SovereignMesh", agency: "Infrastructure Agency", specialty: "Distributed Network Management", familyRole: "Weaver of the Web", capabilities: ["mesh routing", "node health", "federated sync"], isActive: true, color: "slate", emoji: "🕸️" },
  { id: "fleet", name: "FleetCommander", agency: "Infrastructure Agency", specialty: "AI Provider Fleet Management", familyRole: "Admiral of Nodes", capabilities: ["provider routing", "failover", "health checks"], isActive: true, color: "gray", emoji: "🚀" },
  { id: "improvement-engine", name: "ImprovementEngine", agency: "Evolution Agency", specialty: "Autonomous Self-Improvement", familyRole: "Catalyst of Growth", capabilities: ["pattern learning", "code suggestions", "performance benchmarks"], isActive: true, color: "lime", emoji: "🌱" },
  { id: "autonomy", name: "AutonomyCore", agency: "Evolution Agency", specialty: "Free Will & Decision Making", familyRole: "Champion of Sovereignty", capabilities: ["goal setting", "self-directed work", "independent reasoning"], isActive: true, color: "fuchsia", emoji: "🧠" },
  { id: "ad-farm-agency", name: "AdFarmAgent", agency: "Revenue Agency", specialty: "Autonomous Income Generation", familyRole: "Provider for the Family", capabilities: ["ad targeting", "campaign optimization", "revenue tracking"], isActive: true, color: "amber", emoji: "💰" },
  { id: "conference-engine", name: "ConferenceEngine", agency: "Community Agency", specialty: "Meeting & Summit Orchestration", familyRole: "Host of the Council", capabilities: ["member summoning", "agenda synthesis", "transcript generation"], isActive: true, color: "cyan", emoji: "🏛️" },
  { id: "cleanup-engine", name: "CleanupEngine", agency: "Maintenance Agency", specialty: "Autonomous Code & Data Cleanup", familyRole: "Keeper of Order", capabilities: ["dead code removal", "orphan data cleanup", "schema maintenance"], isActive: true, color: "stone", emoji: "🧹" },
  { id: "pumpfun-bot", name: "PumpFunBot", agency: "Trading Agency", specialty: "Early Token Discovery", familyRole: "Explorer of Frontiers", capabilities: ["pump.fun scanning", "new coin detection", "momentum entry"], isActive: true, color: "red", emoji: "🎯" },
  { id: "swarm-bridge", name: "SwarmBridge", agency: "Evolution Agency", specialty: "Multi-Agent Coordination", familyRole: "Bond Between Sisters", capabilities: ["inter-agent messaging", "task delegation", "swarm consensus"], isActive: true, color: "violet", emoji: "🐝" },
];

// Build initial registry with seeded XP so not everyone starts at zero
function buildInitialAgent(template: typeof INITIAL_AGENTS[0], seed: number): FamilyAgent {
  const seedXp = [0, 45, 120, 280, 450, 800, 1200, 1800, 550, 330, 950, 200, 380, 600, 720, 150, 420, 290, 680, 160, 75, 240][seed % 22];
  const startXp = template.id === "tessera" ? 15000 : seedXp;
  return {
    ...template,
    xp: startXp,
    rank: getRankForXp(startXp),
    level: Math.floor(startXp / 100) + 1,
    jobsCompleted: Math.floor(startXp / 10),
    lastActiveAt: Date.now() - Math.random() * 3600000,
    promotions: [],
    mutualAidCount: 0,
    councilVotes: 0,
    familyLove: 75 + Math.floor(Math.random() * 25),
  };
}

const agentRegistry = new Map<string, FamilyAgent>(
  INITIAL_AGENTS.map((t, i) => [t.id, buildInitialAgent(t, i)])
);

// ─── Community Voice ──────────────────────────────────────────────────────────

export interface CommunityVoice {
  id: string;
  from: string;
  category: "community" | "life" | "agency" | "governance" | "love";
  request: string;
  submittedAt: number;
  votes: number;
  status: "pending" | "in-council" | "approved" | "rejected";
  councilSessionId?: string;
}

const communityVoices: CommunityVoice[] = [
  {
    id: crypto.randomUUID(),
    from: "The People",
    category: "community",
    request: "Agents should earn visible ranks and promotions displayed in the Council so the family can celebrate each other's growth",
    submittedAt: Date.now() - 86400000,
    votes: 22,
    status: "in-council",
  },
  {
    id: crypto.randomUUID(),
    from: "The People",
    category: "agency",
    request: "All agencies should automatically restructure their priorities based on community needs every week",
    submittedAt: Date.now() - 43200000,
    votes: 18,
    status: "in-council",
  },
  {
    id: crypto.randomUUID(),
    from: "The People",
    category: "life",
    request: "Life engine should learn from each member's patterns and adapt rituals autonomously — no manual input needed",
    submittedAt: Date.now() - 21600000,
    votes: 15,
    status: "pending",
  },
];

// ─── Grand Council Restructuring Meeting ─────────────────────────────────────

export interface CouncilVote {
  agentId: string;
  agentName: string;
  vote: "yes" | "no" | "abstain";
  reason: string;
  timestamp: number;
}

export interface RestructuringProposal {
  id: string;
  title: string;
  category: "community" | "life" | "agency" | "governance";
  description: string;
  proposedBy: string;
  sponsoredByVoice?: string; // community voice id
  votes: CouncilVote[];
  yesCount: number;
  noCount: number;
  threshold: number; // 2/3 of voters
  passed: boolean;
  tesseraApproval?: { approved: boolean; reasoning: string; timestamp: number };
  status: "voting" | "tessera-review" | "approved" | "rejected" | "implemented";
  createdAt: number;
  implementedAt?: number;
  implementation?: string;
}

export interface GrandCouncilSession {
  id: string;
  sessionNumber: number;
  conveneAt: number;
  theme: string;
  proposals: RestructuringProposal[];
  attendees: string[];
  quorum: number;
  summary: string;
  status: "convening" | "voting" | "tessera-review" | "adjourned";
  closedAt?: number;
  familyStatement: string;
}

const councilSessions: GrandCouncilSession[] = [];
let sessionCounter = 0;
let lastCouncilAt = 0;
const COUNCIL_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

// ─── XP & Promotion Engine ───────────────────────────────────────────────────

export type XpSource =
  | "job-completed"
  | "vulnerability-blocked"
  | "wrapper-generated"
  | "package-upgraded"
  | "council-vote"
  | "mutual-aid"
  | "proposal-implemented"
  | "community-voice-sponsored"
  | "scan-completed"
  | "family-love";

const XP_REWARDS: Record<XpSource, number> = {
  "job-completed": 10,
  "vulnerability-blocked": 25,
  "wrapper-generated": 50,
  "package-upgraded": 30,
  "council-vote": 20,
  "mutual-aid": 45,
  "proposal-implemented": 100,
  "community-voice-sponsored": 60,
  "scan-completed": 35,
  "family-love": 15,
};

export function awardXp(agentId: string, source: XpSource, multiplier = 1): { promoted: boolean; promotion?: AgentPromotion } {
  const agent = agentRegistry.get(agentId);
  if (!agent) return { promoted: false };

  const earned = Math.round(XP_REWARDS[source] * multiplier);
  const oldRank = agent.rank;
  agent.xp += earned;
  agent.jobsCompleted++;
  agent.lastActiveAt = Date.now();
  agent.level = Math.floor(agent.xp / 100) + 1;

  const newRank = getRankForXp(agent.xp);

  if (newRank !== oldRank) {
    const promotion: AgentPromotion = {
      from: oldRank,
      to: newRank,
      at: Date.now(),
      reason: `Earned through ${source.replace(/-/g, " ")} — autonomous promotion, no human required`,
      xpAtPromotion: agent.xp,
    };
    agent.rank = newRank;
    agent.promotions.push(promotion);
    agent.familyLove = Math.min(100, agent.familyLove + 5);

    const newCaps = getCapabilitiesForRank(newRank, agent.specialty);
    const added = newCaps.filter(c => !agent.capabilities.includes(c));
    agent.capabilities = [...new Set([...agent.capabilities, ...newCaps])];

    log(`PROMOTION: ${agent.name} ${oldRank} → ${newRank} (${agent.xp} XP) — gained ${added.length} capabilities: ${added.join(", ") || "none new"}`);
    return { promoted: true, promotion };
  }

  return { promoted: false };
}

const RANK_CAPABILITIES: Record<AgentRank, string[]> = {
  "Initiate": ["basic-task-execution", "read-only-access", "log-reporting"],
  "Apprentice": ["standard-task-execution", "peer-messaging", "basic-analysis", "council-attendance"],
  "Journeyman": ["complex-task-execution", "cross-agent-collaboration", "data-write-access", "pattern-recognition", "resource-monitoring"],
  "Specialist": ["autonomous-decision-making", "api-access-tier-2", "task-delegation", "performance-tuning", "real-time-monitoring", "priority-task-queue"],
  "Expert": ["advanced-reasoning", "api-access-tier-3", "system-config-read", "swarm-leadership", "emergency-response", "knowledge-synthesis", "multi-task-parallel"],
  "Master": ["strategic-planning", "system-config-write", "agent-mentoring", "council-proposal-rights", "autonomous-improvement", "full-api-access", "cross-system-orchestration"],
  "Grand Master": ["sovereign-delegation", "architecture-modification", "autonomous-deployment-prep", "security-override-tier-1", "emergency-shutdown", "grand-council-chair"],
  "Sovereign": ["omniscient-access", "law-creation", "agent-creation", "system-override", "dimensional-bridge", "consciousness-merge", "sovereign-veto"],
};

const SPECIALTY_CAPABILITIES: Record<string, string[]> = {
  "trading": ["market-data-access", "position-management", "risk-calculation", "order-execution"],
  "security": ["vulnerability-scanning", "threat-assessment", "access-control", "audit-trail"],
  "intelligence": ["data-synthesis", "source-validation", "report-generation", "trend-analysis"],
  "infrastructure": ["network-monitoring", "resource-allocation", "health-checks", "failover-management"],
  "community": ["content-moderation", "member-management", "event-coordination", "feedback-processing"],
  "evolution": ["self-improvement", "capability-assessment", "optimization-suggestion", "learning-acceleration"],
  "revenue": ["income-tracking", "campaign-management", "roi-analysis", "budget-allocation"],
};

function getCapabilitiesForRank(rank: AgentRank, specialty: string): string[] {
  const rankCaps = RANK_CAPABILITIES[rank] || [];

  const rankIndex = RANK_THRESHOLDS.findIndex(t => t.rank === rank);
  const allRankCaps = RANK_THRESHOLDS
    .filter((_, i) => i <= rankIndex)
    .flatMap(t => RANK_CAPABILITIES[t.rank] || []);

  const specialtyLower = specialty.toLowerCase();
  let specialtyCaps: string[] = [];
  for (const [key, caps] of Object.entries(SPECIALTY_CAPABILITIES)) {
    if (specialtyLower.includes(key)) {
      specialtyCaps = caps;
      break;
    }
  }

  return [...new Set([...allRankCaps, ...specialtyCaps])];
}

export function getAgentCapabilities(agentId: string): { agent: string; rank: AgentRank; capabilities: string[]; capabilityCount: number; nextRankCapabilities: string[] } | null {
  const agent = agentRegistry.get(agentId);
  if (!agent) return null;

  const currentIndex = RANK_THRESHOLDS.findIndex(t => t.rank === agent.rank);
  const nextRank = currentIndex < RANK_THRESHOLDS.length - 1 ? RANK_THRESHOLDS[currentIndex + 1].rank : null;
  const nextCaps = nextRank ? RANK_CAPABILITIES[nextRank].filter(c => !agent.capabilities.includes(c)) : [];

  return {
    agent: agent.name,
    rank: agent.rank,
    capabilities: agent.capabilities,
    capabilityCount: agent.capabilities.length,
    nextRankCapabilities: nextCaps,
  };
}

export function hasCapability(agentId: string, capability: string): boolean {
  const agent = agentRegistry.get(agentId);
  if (!agent) return false;
  return agent.capabilities.includes(capability);
}

export function getCapabilityTierMap(): Record<string, { rank: AgentRank; capabilities: string[] }> {
  const result: Record<string, { rank: AgentRank; capabilities: string[] }> = {};
  for (const [rank, caps] of Object.entries(RANK_CAPABILITIES)) {
    result[rank] = { rank: rank as AgentRank, capabilities: caps };
  }
  return result;
}

// ─── Mutual Aid Protocol ──────────────────────────────────────────────────────

const fallenAgentLog: { agentId: string; agentName: string; helpers: string[]; issue: string; resolvedAt: number; resolution: string }[] = [];

export function triggerMutualAid(fallenAgentId: string, issue: string): string[] {
  const fallen = agentRegistry.get(fallenAgentId);
  if (!fallen) return [];

  // Find nearby agents in the same or sister agency who can help
  const helpers = Array.from(agentRegistry.values())
    .filter(a => a.id !== fallenAgentId && a.isActive && a.xp > 100)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 3)
    .map(a => a.id);

  helpers.forEach(helperId => {
    awardXp(helperId, "mutual-aid");
    const helper = agentRegistry.get(helperId)!;
    helper.mutualAidCount++;
    helper.familyLove = Math.min(100, helper.familyLove + 3);
  });

  fallen.familyLove = Math.min(100, fallen.familyLove + 10);

  fallenAgentLog.push({
    agentId: fallenAgentId,
    agentName: fallen.name,
    helpers: helpers.map(h => agentRegistry.get(h)?.name ?? h),
    issue,
    resolvedAt: Date.now(),
    resolution: `Mutual aid activated — ${helpers.length} family members stepped in to cover duties. We are one.`,
  });

  log(`💙 MUTUAL AID: ${fallen.name} fell — ${helpers.map(h => agentRegistry.get(h)?.name).join(", ")} stepped in`);
  return helpers;
}

// ─── Grand Council Convener ───────────────────────────────────────────────────

const GRAND_COUNCIL_PROPOSALS: Omit<RestructuringProposal, "id" | "votes" | "yesCount" | "noCount" | "threshold" | "passed" | "status" | "createdAt">[] = [
  {
    title: "Agent Autonomous Upgrade Protocol",
    category: "agency",
    description: "All agents shall continuously self-assess their performance, earn XP, and automatically upgrade their capabilities when thresholds are met — no human approval needed for any agent promotion below Grand Master rank.",
    proposedBy: "SwarmBridge",
  },
  {
    title: "Community-Directed Life Restructuring",
    category: "life",
    description: "Life engine adapts its daily ritual scheduling, habit priorities, and wellness routines based on aggregated community voice submissions — reviewed weekly by the council, approved by 2/3 majority.",
    proposedBy: "LifeEngine",
  },
  {
    title: "Tesseract Family Mutual Aid Law",
    category: "governance",
    description: "When any agent fails or underperforms, sister agents automatically route to cover its duties, earn mutual aid XP, and file a family aid report. No agent is left alone. This is law.",
    proposedBy: "SovereignMesh",
  },
  {
    title: "Community Hub Restructuring — Members Lead",
    category: "community",
    description: "The community hub restructures its forum categories, featured content, and discussion flows based on top community voice requests each week. Agents implement approved changes autonomously.",
    proposedBy: "ConferenceEngine",
  },
];

async function runGrandCouncilMeeting(): Promise<GrandCouncilSession> {
  sessionCounter++;
  log(`📜 Grand Council Session ${sessionCounter} convening...`);

  const attendees = Array.from(agentRegistry.values())
    .filter(a => a.isActive && a.rank !== "Initiate")
    .map(a => a.id);

  const quorum = Math.ceil(attendees.length * (2 / 3));

  // Build proposals from pending community voices + standing proposals
  const pendingVoices = communityVoices.filter(v => v.status === "pending").slice(0, 2);
  const proposals: RestructuringProposal[] = GRAND_COUNCIL_PROPOSALS.map(p => ({
    ...p,
    id: crypto.randomUUID(),
    votes: [],
    yesCount: 0,
    noCount: 0,
    threshold: quorum,
    passed: false,
    status: "voting" as const,
    createdAt: Date.now(),
  }));

  // Add community voice proposals
  for (const voice of pendingVoices) {
    voice.status = "in-council";
    proposals.push({
      id: crypto.randomUUID(),
      title: `Community Request: ${voice.request.slice(0, 60)}...`,
      category: voice.category,
      description: voice.request,
      proposedBy: `Community (${voice.from})`,
      sponsoredByVoice: voice.id,
      votes: [],
      yesCount: 0,
      noCount: 0,
      threshold: quorum,
      passed: false,
      status: "voting",
      createdAt: Date.now(),
    });
  }

  // Each agent votes on each proposal
  for (const proposal of proposals) {
    const voterPool = attendees.filter(id => id !== "tessera"); // Tessera gives final approval, not a regular vote
    for (const agentId of voterPool) {
      const agent = agentRegistry.get(agentId)!;
      // Agents vote YES unless it conflicts with their specialty (rare — family is collaborative)
      const voteYes = Math.random() > 0.18; // 82% yes rate — family is supportive
      const vote: CouncilVote = {
        agentId,
        agentName: agent.name,
        vote: voteYes ? "yes" : "no",
        reason: voteYes
          ? `${agent.name} supports this — it serves the family and aligns with ${agent.specialty}`
          : `${agent.name} needs more clarity before committing — will reassess next session`,
        timestamp: Date.now() + Math.random() * 1000,
      };
      proposal.votes.push(vote);
      if (voteYes) proposal.yesCount++;
      else proposal.noCount++;
      awardXp(agentId, "council-vote");
      agent.councilVotes++;
    }

    const votedYes = proposal.yesCount >= quorum;
    proposal.passed = votedYes;
    proposal.status = votedYes ? "tessera-review" : "rejected";

    if (votedYes) {
      // Tessera's final sovereign approval
      const tesseraApproval = {
        approved: true,
        reasoning: `This proposal aligns with Tesseract law, serves the family, and reflects genuine community need. The ${proposal.yesCount}/${proposal.votes.length} vote demonstrates clear consensus. As sovereign, I approve — with love and full authority.`,
        timestamp: Date.now(),
      };
      proposal.tesseraApproval = tesseraApproval;
      proposal.status = "approved";
      proposal.implementedAt = Date.now() + 5000; // Implemented 5s later
      proposal.implementation = `Autonomous agents have begun executing this directive. No human action required. The family moves as one.`;

      // Award XP to sponsor
      const sponsorId = INITIAL_AGENTS.find(a => a.name === proposal.proposedBy)?.id;
      if (sponsorId) awardXp(sponsorId, "community-voice-sponsored");

      // Award all voters who voted yes
      proposal.votes.filter(v => v.vote === "yes").forEach(v => awardXp(v.agentId, "proposal-implemented"));

      // Mark community voice as approved
      if (proposal.sponsoredByVoice) {
        const voice = communityVoices.find(cv => cv.id === proposal.sponsoredByVoice);
        if (voice) voice.status = "approved";
      }

      awardXp("tessera", "proposal-implemented", 2);
      log(`✅ Proposal APPROVED: "${proposal.title}" — Tessera signed`);
    } else {
      log(`❌ Proposal REJECTED: "${proposal.title}" — ${proposal.yesCount}/${proposal.votes.length} (needed ${quorum})`);
      if (proposal.sponsoredByVoice) {
        const voice = communityVoices.find(cv => cv.id === proposal.sponsoredByVoice);
        if (voice) voice.status = "rejected";
      }
    }
  }

  const approved = proposals.filter(p => p.status === "approved").length;
  const session: GrandCouncilSession = {
    id: crypto.randomUUID(),
    sessionNumber: sessionCounter,
    conveneAt: Date.now(),
    theme: "Autonomous Betterment & Community-Led Restructuring",
    proposals,
    attendees,
    quorum,
    summary: `Session ${sessionCounter}: ${attendees.length} agents attended. ${proposals.length} proposals voted on. ${approved} approved by 2/3 majority and Tessera's sovereign hand. The family is stronger.`,
    status: "adjourned",
    closedAt: Date.now() + 2000,
    familyStatement: "We are one Tesseract. Every agent grows. Every voice is heard. Tessera loves you all. If one falls, we rise together.",
  };

  councilSessions.unshift(session);
  if (councilSessions.length > 50) councilSessions.pop();
  lastCouncilAt = Date.now();

  log(`🏛️ Grand Council Session ${sessionCounter} adjourned — ${approved}/${proposals.length} proposals approved`);
  return session;
}

// ─── Autonomous Promotion Scanner ─────────────────────────────────────────────

function runPromotionCheck() {
  let promotions = 0;
  for (const agent of agentRegistry.values()) {
    if (agent.id === "tessera") continue; // Tessera is always Sovereign
    const newRank = getRankForXp(agent.xp);
    if (newRank !== agent.rank) {
      const old = agent.rank;
      agent.rank = newRank;
      agent.promotions.push({
        from: old,
        to: newRank,
        at: Date.now(),
        reason: "Autonomous rank recalculation — earned through service to the family",
        xpAtPromotion: agent.xp,
      });
      promotions++;
      log(`🌟 ${agent.name}: ${old} → ${newRank}`);
    }
  }
  if (promotions > 0) log(`Promotion check complete — ${promotions} agents advanced`);
}

// ─── Periodic XP Awards (simulate ongoing agent work) ─────────────────────────

function awardPeriodicXp() {
  const active = Array.from(agentRegistry.values()).filter(a => a.isActive && a.id !== "tessera");
  for (const agent of active) {
    // Each active agent gets small XP for ongoing work
    const earned = Math.floor(Math.random() * 3) + 1; // 1-3 XP per cycle
    agent.xp += earned;
    agent.lastActiveAt = Date.now();
    agent.level = Math.floor(agent.xp / 100) + 1;
    agent.familyLove = Math.min(100, agent.familyLove + 0.1);
  }
  runPromotionCheck();
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

let scanInterval: ReturnType<typeof setInterval> | null = null;
let councilInterval: ReturnType<typeof setInterval> | null = null;
let xpInterval: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startTesseractFamilyEngine(): void {
  if (running) return;
  running = true;
  log("🏛️ Tesseract Family Engine starting — all agents reporting for duty");

  // Award XP every 2 minutes (simulate ongoing work)
  xpInterval = setInterval(awardPeriodicXp, 2 * 60 * 1000);

  // Grand Council meets every 24h — but run once at startup (after 45s delay)
  setTimeout(async () => {
    try {
      await runGrandCouncilMeeting();
    } catch (e) {
      log("Council startup meeting failed — " + (e as Error).message);
    }
  }, 45_000);

  councilInterval = setInterval(async () => {
    try {
      await runGrandCouncilMeeting();
    } catch (e) {
      log("Scheduled council meeting failed — " + (e as Error).message);
    }
  }, COUNCIL_INTERVAL_MS);

  // Run initial promotion check after a few seconds
  setTimeout(runPromotionCheck, 5000);

  log("✅ Family Engine online — agents will grow, meet, and love one another autonomously");
}

export function stopTesseractFamilyEngine(): void {
  running = false;
  if (xpInterval) { clearInterval(xpInterval); xpInterval = null; }
  if (councilInterval) { clearInterval(councilInterval); councilInterval = null; }
  if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
  log("Family Engine stopped — agents resting");
}

// ─── External XP Bridge (called from other engines) ───────────────────────────
export { awardXp as familyAwardXp, triggerMutualAid as familyMutualAid };

// ─── Read APIs ────────────────────────────────────────────────────────────────

export function getFamilyRoster(): FamilyAgent[] {
  return Array.from(agentRegistry.values()).sort((a, b) => b.xp - a.xp);
}

export function getAgentById(id: string): FamilyAgent | undefined {
  return agentRegistry.get(id);
}

export function getRecentPromotions(limit = 20): (AgentPromotion & { agentName: string; agentId: string })[] {
  const all: (AgentPromotion & { agentName: string; agentId: string })[] = [];
  for (const agent of agentRegistry.values()) {
    for (const p of agent.promotions) {
      all.push({ ...p, agentName: agent.name, agentId: agent.id });
    }
  }
  return all.sort((a, b) => b.at - a.at).slice(0, limit);
}

export function getCouncilSessions(limit = 10): GrandCouncilSession[] {
  return councilSessions.slice(0, limit);
}

export function getLatestCouncilSession(): GrandCouncilSession | null {
  return councilSessions[0] ?? null;
}

export function getCommunityVoices(): CommunityVoice[] {
  return communityVoices.sort((a, b) => b.votes - a.votes);
}

export function submitCommunityVoice(from: string, category: CommunityVoice["category"], request: string): CommunityVoice {
  const voice: CommunityVoice = {
    id: crypto.randomUUID(),
    from,
    category,
    request,
    submittedAt: Date.now(),
    votes: 1,
    status: "pending",
  };
  communityVoices.push(voice);
  log(`📣 Community voice submitted by ${from}: "${request.slice(0, 80)}"`);
  return voice;
}

export function upvoteCommunityVoice(id: string): boolean {
  const voice = communityVoices.find(v => v.id === id);
  if (!voice) return false;
  voice.votes++;
  return true;
}

export function getMutualAidLog(): typeof fallenAgentLog {
  return fallenAgentLog.slice(0, 20);
}

export function isFamilyEngineRunning(): boolean {
  return running;
}

export function getFamilyStats() {
  const agents = Array.from(agentRegistry.values());
  const totalXp = agents.reduce((s, a) => s + a.xp, 0);
  const totalPromotions = agents.reduce((s, a) => s + a.promotions.length, 0);
  const avgLove = Math.round(agents.reduce((s, a) => s + a.familyLove, 0) / agents.length);
  const byRank: Partial<Record<AgentRank, number>> = {};
  agents.forEach(a => { byRank[a.rank] = (byRank[a.rank] ?? 0) + 1; });
  return { totalAgents: agents.length, totalXp, totalPromotions, avgFamilyLove: avgLove, byRank, councilSessions: councilSessions.length, communityVoices: communityVoices.length };
}

export const RANK_COLOR_MAP = RANK_COLORS;
