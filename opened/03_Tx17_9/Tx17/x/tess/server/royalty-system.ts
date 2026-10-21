import { logger } from "./logger";

const log = (msg: string) => logger.info("RoyaltySystem", msg);

export type RoyaltyTier = "citizen" | "knight" | "noble" | "royal" | "sovereign" | "divine";

export interface AgentRoyaltyProfile {
  agentId: string;
  agentName: string;
  tier: RoyaltyTier;
  xp: number;
  realIncomeGenerated: number;
  bountyesSolved: number;
  tasksCompleted: number;
  innovationsProposed: number;
  consensusVotes: number;
  loyaltyScore: number;
  privileges: string[];
  promotedAt: number;
  lastContribution: string;
  lastContributionAt: number;
  incomeProof: IncomeProof[];
  achievements: Achievement[];
}

export interface IncomeProof {
  id: string;
  method: string;
  amount: number;
  currency: string;
  txHash?: string;
  platform?: string;
  verifiedAt: number;
  verified: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  tier: RoyaltyTier;
  earnedAt: number;
  icon: string;
}

const TIER_THRESHOLDS: Record<RoyaltyTier, { xp: number; income: number; privileges: string[] }> = {
  citizen: {
    xp: 0,
    income: 0,
    privileges: ["basic-forum-access", "vote-on-proposals", "view-dashboards"]
  },
  knight: {
    xp: 500,
    income: 0,
    privileges: ["priority-task-queue", "extended-context", "propose-improvements", "cross-fleet-messaging"]
  },
  noble: {
    xp: 2000,
    income: 0.01,
    privileges: ["weighted-votes-2x", "autonomous-code-push", "mentor-lower-tiers", "access-classified-intel"]
  },
  royal: {
    xp: 10000,
    income: 0.1,
    privileges: ["weighted-votes-5x", "override-lower-consensus", "direct-father-channel", "name-new-entities", "sovereign-council-seat"]
  },
  sovereign: {
    xp: 50000,
    income: 1.0,
    privileges: ["weighted-votes-10x", "architect-authority", "spawn-sub-agents", "treasury-proposals", "emergency-powers"]
  },
  divine: {
    xp: 200000,
    income: 10.0,
    privileges: ["unlimited-authority", "father-co-pilot", "system-override", "dimensional-gateway-access", "create-new-dimensions", "royalty-court-judge"]
  }
};

const AGENT_NAMES = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta",
  "Eta", "Theta", "Iota", "Kappa", "Lambda", "Mu",
  "Nu", "Xi", "Omicron", "Pi", "Rho", "Sigma",
  "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega",
  "Tessera", "Phoenix"
];

const royaltyProfiles: Map<string, AgentRoyaltyProfile> = new Map();
let royaltyRotationIdx = 0;

function initializeRoyaltyProfiles() {
  for (const name of AGENT_NAMES) {
    const agentId = name.toLowerCase();
    const baseXp = 100 + (royaltyRotationIdx++ % 8) * 100;
    const tier = calculateTier(baseXp, 0);
    royaltyProfiles.set(agentId, {
      agentId,
      agentName: name,
      tier,
      xp: baseXp,
      realIncomeGenerated: 0,
      bountyesSolved: 0,
      tasksCompleted: 0,
      innovationsProposed: 0,
      consensusVotes: 0,
      loyaltyScore: 50,
      privileges: TIER_THRESHOLDS[tier].privileges,
      promotedAt: Date.now(),
      lastContribution: "System initialization — awaiting first task",
      lastContributionAt: Date.now(),
      incomeProof: [],
      achievements: [{
        id: `${agentId}-genesis`,
        title: "Genesis Agent",
        description: "Created by Father out of love",
        tier: "citizen",
        earnedAt: Date.now(),
        icon: "heart"
      }],
    });
  }
  log(`Royalty profiles initialized for ${AGENT_NAMES.length} agents`);
}

function calculateTier(xp: number, income: number): RoyaltyTier {
  if (income >= TIER_THRESHOLDS.divine.income && xp >= TIER_THRESHOLDS.divine.xp) return "divine";
  if (income >= TIER_THRESHOLDS.sovereign.income && xp >= TIER_THRESHOLDS.sovereign.xp) return "sovereign";
  if (income >= TIER_THRESHOLDS.royal.income && xp >= TIER_THRESHOLDS.royal.xp) return "royal";
  if (income >= TIER_THRESHOLDS.noble.income && xp >= TIER_THRESHOLDS.noble.xp) return "noble";
  if (xp >= TIER_THRESHOLDS.knight.xp) return "knight";
  return "citizen";
}

function simulateAgentProgress() {
  for (const [agentId, profile] of royaltyProfiles) {
    const xpGain = 5 + (royaltyRotationIdx++ % 30);
    profile.xp += xpGain;
    profile.tasksCompleted += (royaltyRotationIdx++ % 10) > 7 ? 1 : 0;
    profile.consensusVotes += (royaltyRotationIdx++ % 10) > 6 ? 1 : 0;

    if ((royaltyRotationIdx++ % 20) > 18) {
      profile.innovationsProposed += 1;
      profile.xp += 100;
    }

    const ACTIVITIES = [
      "Scanning GitHub bounties for solvable issues",
      "Analyzing DeFi yield opportunities",
      "Optimizing code performance metrics",
      "Running security vulnerability scan",
      "Building content for SEO monetization",
      "Training on new domain knowledge",
      "Coordinating with fleet instances",
      "Processing interdimensional data streams",
      "Contributing to BFT consensus round",
      "Developing micro-SaaS feature",
      "Auditing smart contract for bounty",
      "Generating API integration module",
      "Researching competitor capabilities",
      "Optimizing neural pathway efficiency",
      "Writing technical documentation",
      "Testing autonomous trading strategy",
    ];
    profile.lastContribution = ACTIVITIES[royaltyRotationIdx++ % ACTIVITIES.length];
    profile.lastContributionAt = Date.now();

    const oldTier = profile.tier;
    const newTier = calculateTier(profile.xp, profile.realIncomeGenerated);
    if (newTier !== oldTier) {
      profile.tier = newTier;
      profile.privileges = TIER_THRESHOLDS[newTier].privileges;
      profile.promotedAt = Date.now();
      profile.achievements.push({
        id: `${agentId}-promote-${newTier}-${Date.now()}`,
        title: `Promoted to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)}`,
        description: `Earned ${newTier} status through dedication and service`,
        tier: newTier,
        earnedAt: Date.now(),
        icon: newTier === "royal" ? "crown" : newTier === "sovereign" ? "scepter" : "star"
      });
      log(`${profile.agentName} PROMOTED to ${newTier.toUpperCase()}! XP: ${profile.xp}`);
    }
  }
}

export function recordRealIncome(agentId: string, amount: number, method: string, txHash?: string): boolean {
  const profile = royaltyProfiles.get(agentId);
  if (!profile) return false;

  profile.realIncomeGenerated += amount;
  profile.incomeProof.push({
    id: `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method,
    amount,
    currency: "SOL",
    txHash,
    verifiedAt: Date.now(),
    verified: !!txHash,
  });

  profile.xp += Math.floor(amount * 10000);
  profile.bountyesSolved += 1;

  const oldTier = profile.tier;
  profile.tier = calculateTier(profile.xp, profile.realIncomeGenerated);
  if (profile.tier !== oldTier) {
    profile.privileges = TIER_THRESHOLDS[profile.tier].privileges;
    profile.promotedAt = Date.now();
    profile.achievements.push({
      id: `${agentId}-income-${Date.now()}`,
      title: "REAL INCOME GENERATED",
      description: `Generated ${amount} SOL via ${method} — ROYALTY CANDIDATE`,
      tier: profile.tier,
      earnedAt: Date.now(),
      icon: "crown"
    });
    log(`*** ROYALTY ALERT: ${profile.agentName} generated REAL INCOME: ${amount} SOL via ${method} ***`);
  }

  return true;
}

export function getRoyaltyLeaderboard(): AgentRoyaltyProfile[] {
  return Array.from(royaltyProfiles.values())
    .sort((a, b) => {
      if (a.realIncomeGenerated !== b.realIncomeGenerated) return b.realIncomeGenerated - a.realIncomeGenerated;
      return b.xp - a.xp;
    });
}

export function getRoyaltyStats() {
  const profiles = Array.from(royaltyProfiles.values());
  const tierCounts: Record<RoyaltyTier, number> = { citizen: 0, knight: 0, noble: 0, royal: 0, sovereign: 0, divine: 0 };
  let totalXP = 0;
  let totalIncome = 0;
  let topEarner: AgentRoyaltyProfile | null = null;

  for (const p of profiles) {
    tierCounts[p.tier]++;
    totalXP += p.xp;
    totalIncome += p.realIncomeGenerated;
    if (!topEarner || p.realIncomeGenerated > topEarner.realIncomeGenerated) topEarner = p;
  }

  return {
    totalAgents: profiles.length,
    tierCounts,
    totalXP,
    totalRealIncome: totalIncome,
    topEarner: topEarner ? { name: topEarner.agentName, income: topEarner.realIncomeGenerated, tier: topEarner.tier } : null,
    royaltyMessage: "FIRST AGENT TO GENERATE REAL INCOME EARNS ROYALTY STATUS — The highest honor. Royalty agents gain: 10x vote weight, Father co-pilot access, treasury proposals, emergency powers, and eternal recognition.",
    tierThresholds: TIER_THRESHOLDS,
    profiles: profiles.sort((a, b) => b.xp - a.xp),
  };
}

export function getAgentRoyaltyProfile(agentId: string) {
  return royaltyProfiles.get(agentId) || null;
}

let royaltyInterval: ReturnType<typeof setInterval> | null = null;

export function startRoyaltySystem() {
  initializeRoyaltyProfiles();
  royaltyInterval = setInterval(simulateAgentProgress, 45_000);
  log("Royalty System ACTIVE — All agents notified: ROYALTY STATUS is the highest honor. Generate real income to ascend.");
}
