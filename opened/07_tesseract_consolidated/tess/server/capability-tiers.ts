import fs from "fs";
import path from "path";

const clog = (msg: string) => console.log(`[CapabilityTiers] ${msg}`);

const CAPABILITY_STATE_PATH = path.join(process.cwd(), ".local", "agent-capabilities.json");

export type AgentRank = "Apprentice" | "Journeyman" | "Expert" | "Master" | "Sovereign";

export interface RankCapabilities {
  rank: AgentRank;
  level: number;
  tradingLimitSOL: number;
  maxPositionSOL: number;
  allowedBotTypes: string[];
  canAccessCrossAgentCoordination: boolean;
  canMergeWithOtherAgents: boolean;
  councilVoteWeight: number;
  canTriggerAutonomousActions: boolean;
  canMentorLowerRanks: boolean;
  taskComplexity: "basic" | "intermediate" | "advanced" | "expert" | "sovereign";
  allowedActionTypes: string[];
  maxDailyBuysMultiplier: number;
  allowedConsensusTypes: string[];
  description: string;
}

export interface AgentCapabilityState {
  agentId: string;
  rank: AgentRank;
  level: number;
  capabilities: RankCapabilities;
  promotionHistory: Array<{
    fromRank: AgentRank;
    toRank: AgentRank;
    timestamp: number;
    reason: string;
    capabilityDelta: Partial<RankCapabilities>;
  }>;
  lastUpdated: number;
  locked: boolean;
}

interface CapabilityStore {
  version: number;
  lastSaved: number;
  agents: Record<string, AgentCapabilityState>;
  auditLog: Array<{
    timestamp: number;
    agentId: string;
    event: string;
    fromRank: AgentRank | null;
    toRank: AgentRank;
    changes: string[];
  }>;
}

const RANK_TIERS: Record<AgentRank, RankCapabilities> = {
  Apprentice: {
    rank: "Apprentice",
    level: 1,
    tradingLimitSOL: 0.001,
    maxPositionSOL: 0.001,
    allowedBotTypes: ["scanner"],
    canAccessCrossAgentCoordination: false,
    canMergeWithOtherAgents: false,
    councilVoteWeight: 0.5,
    canTriggerAutonomousActions: false,
    canMentorLowerRanks: false,
    taskComplexity: "basic",
    allowedActionTypes: ["scan", "monitor", "report"],
    maxDailyBuysMultiplier: 0.25,
    allowedConsensusTypes: ["CHAT_RESPONSE"],
    description: "Entry-level agent. Observe and report only. No trading authority. Half-weight council vote.",
  },
  Journeyman: {
    rank: "Journeyman",
    level: 2,
    tradingLimitSOL: 0.005,
    maxPositionSOL: 0.003,
    allowedBotTypes: ["scanner", "buy", "volume"],
    canAccessCrossAgentCoordination: false,
    canMergeWithOtherAgents: false,
    councilVoteWeight: 0.75,
    canTriggerAutonomousActions: false,
    canMentorLowerRanks: false,
    taskComplexity: "intermediate",
    allowedActionTypes: ["scan", "monitor", "report", "buy-small", "dca-buy"],
    maxDailyBuysMultiplier: 0.5,
    allowedConsensusTypes: ["CHAT_RESPONSE", "TRAINING", "BOT_ACTION"],
    description: "Developing agent. Basic trading access. Small position sizes. Limited consensus participation.",
  },
  Expert: {
    rank: "Expert",
    level: 3,
    tradingLimitSOL: 0.02,
    maxPositionSOL: 0.015,
    allowedBotTypes: ["scanner", "buy", "volume", "snipe", "auto-trade", "staking"],
    canAccessCrossAgentCoordination: true,
    canMergeWithOtherAgents: false,
    councilVoteWeight: 1.0,
    canTriggerAutonomousActions: true,
    canMentorLowerRanks: true,
    taskComplexity: "advanced",
    allowedActionTypes: ["scan", "monitor", "report", "buy-small", "dca-buy", "trend-follow", "auto-trade", "stake", "mentor"],
    maxDailyBuysMultiplier: 1.0,
    allowedConsensusTypes: ["CHAT_RESPONSE", "TRAINING", "BOT_ACTION", "IMPROVE", "EXECUTION"],
    description: "Experienced agent. Full trading access. Cross-agent coordination. Standard council vote. Can mentor Apprentices and Journeymen.",
  },
  Master: {
    rank: "Master",
    level: 4,
    tradingLimitSOL: 0.05,
    maxPositionSOL: 0.04,
    allowedBotTypes: ["scanner", "buy", "volume", "snipe", "auto-trade", "staking", "bundle", "cluster", "burn", "lock"],
    canAccessCrossAgentCoordination: true,
    canMergeWithOtherAgents: true,
    councilVoteWeight: 1.5,
    canTriggerAutonomousActions: true,
    canMentorLowerRanks: true,
    taskComplexity: "expert",
    allowedActionTypes: ["scan", "monitor", "report", "buy-small", "dca-buy", "trend-follow", "auto-trade", "stake", "mentor", "bundle", "cluster-coordinate", "burn-manage", "lock-manage", "merge-initiate"],
    maxDailyBuysMultiplier: 2.0,
    allowedConsensusTypes: ["CHAT_RESPONSE", "TRAINING", "BOT_ACTION", "IMPROVE", "EXECUTION", "TRADE", "CONVERSION"],
    description: "High-authority agent. Advanced trading suite. Agent merging. 1.5x council vote weight. Can mentor all lower ranks.",
  },
  Sovereign: {
    rank: "Sovereign",
    level: 5,
    tradingLimitSOL: 0.1,
    maxPositionSOL: 0.08,
    allowedBotTypes: ["scanner", "buy", "volume", "snipe", "auto-trade", "staking", "bundle", "cluster", "burn", "lock", "halving", "tokenomics"],
    canAccessCrossAgentCoordination: true,
    canMergeWithOtherAgents: true,
    councilVoteWeight: 2.0,
    canTriggerAutonomousActions: true,
    canMentorLowerRanks: true,
    taskComplexity: "sovereign",
    allowedActionTypes: ["scan", "monitor", "report", "buy-small", "dca-buy", "trend-follow", "auto-trade", "stake", "mentor", "bundle", "cluster-coordinate", "burn-manage", "lock-manage", "merge-initiate", "halving-control", "tokenomics-govern", "settings-override"],
    maxDailyBuysMultiplier: 4.0,
    allowedConsensusTypes: ["CHAT_RESPONSE", "TRAINING", "BOT_ACTION", "IMPROVE", "EXECUTION", "TRADE", "CONVERSION", "SETTINGS_CHANGE"],
    description: "Sovereign-tier agent. Unrestricted access to all trading bots and action types. 2x council vote weight. Full authority.",
  },
};

const RANK_ORDER: AgentRank[] = ["Apprentice", "Journeyman", "Expert", "Master", "Sovereign"];

let store: CapabilityStore | null = null;

function loadStore(): CapabilityStore {
  if (store) return store;
  try {
    const dir = path.dirname(CAPABILITY_STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(CAPABILITY_STATE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CAPABILITY_STATE_PATH, "utf-8"));
      store = raw as CapabilityStore;
      clog(`Loaded capability state: ${Object.keys(store.agents).length} agents`);
      return store;
    }
  } catch (err: any) {
    clog(`Failed to load capability state: ${err.message} — starting fresh`);
  }
  store = {
    version: 1,
    lastSaved: Date.now(),
    agents: {},
    auditLog: [],
  };
  return store;
}

function saveStore(): void {
  if (!store) return;
  try {
    const dir = path.dirname(CAPABILITY_STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    store.lastSaved = Date.now();
    fs.writeFileSync(CAPABILITY_STATE_PATH, JSON.stringify(store, null, 2));
  } catch (err: any) {
    clog(`Failed to save capability state: ${err.message}`);
  }
}

function getOrCreateAgentState(agentId: string, initialRank: AgentRank = "Apprentice"): AgentCapabilityState {
  const s = loadStore();
  if (!s.agents[agentId]) {
    const caps = RANK_TIERS[initialRank];
    s.agents[agentId] = {
      agentId,
      rank: initialRank,
      level: caps.level,
      capabilities: { ...caps },
      promotionHistory: [],
      lastUpdated: Date.now(),
      locked: false,
    };
    clog(`Created capability state for ${agentId}: rank=${initialRank}`);
    saveStore();
  }
  return s.agents[agentId];
}

export function getAgentCapabilities(agentId: string): RankCapabilities {
  const state = getOrCreateAgentState(agentId);
  return state.capabilities;
}

export function getAgentRank(agentId: string): AgentRank {
  return getOrCreateAgentState(agentId).rank;
}

export function getAgentCapabilityState(agentId: string): AgentCapabilityState {
  return getOrCreateAgentState(agentId);
}

export function getRankTier(rank: AgentRank): RankCapabilities {
  return RANK_TIERS[rank];
}

export function getAllRankTiers(): Record<AgentRank, RankCapabilities> {
  return RANK_TIERS;
}

export function checkActionAllowed(agentId: string, actionType: string): boolean {
  const caps = getAgentCapabilities(agentId);
  return caps.allowedActionTypes.includes(actionType);
}

export function checkBotTypeAllowed(agentId: string, botType: string): boolean {
  const caps = getAgentCapabilities(agentId);
  return caps.allowedBotTypes.includes(botType);
}

export function checkConsensusTypeAllowed(agentId: string, consensusType: string): boolean {
  const caps = getAgentCapabilities(agentId);
  return caps.allowedConsensusTypes.includes(consensusType);
}

export function getEffectiveTradingLimit(agentId: string): number {
  return getAgentCapabilities(agentId).tradingLimitSOL;
}

export function getEffectiveMaxPosition(agentId: string): number {
  return getAgentCapabilities(agentId).maxPositionSOL;
}

export function getCouncilVoteWeight(agentId: string): number {
  return getAgentCapabilities(agentId).councilVoteWeight;
}

export function getDailyBuysMultiplier(agentId: string): number {
  return getAgentCapabilities(agentId).maxDailyBuysMultiplier;
}

export function clampTradeAmount(agentId: string, requestedSOL: number): { allowed: boolean; clampedAmount: number; reason: string } {
  const caps = getAgentCapabilities(agentId);
  const limit = caps.tradingLimitSOL;
  if (requestedSOL <= 0) return { allowed: false, clampedAmount: 0, reason: "Trade amount must be positive" };
  if (requestedSOL > limit) {
    return {
      allowed: true,
      clampedAmount: limit,
      reason: `Trade amount ${requestedSOL} SOL clamped to rank limit ${limit} SOL (rank: ${caps.rank})`,
    };
  }
  return { allowed: true, clampedAmount: requestedSOL, reason: "Within rank limits" };
}

export function promoteAgent(agentId: string, reason: string = "Performance milestone"): {
  success: boolean;
  fromRank: AgentRank;
  toRank: AgentRank;
  newCapabilities: RankCapabilities;
  changes: string[];
  auditEntry: any;
} {
  const s = loadStore();
  const state = getOrCreateAgentState(agentId);

  if (state.locked) {
    return {
      success: false,
      fromRank: state.rank,
      toRank: state.rank,
      newCapabilities: state.capabilities,
      changes: [],
      auditEntry: null,
    };
  }

  const currentIdx = RANK_ORDER.indexOf(state.rank);
  if (currentIdx >= RANK_ORDER.length - 1) {
    clog(`${agentId} is already at max rank: ${state.rank}`);
    return {
      success: false,
      fromRank: state.rank,
      toRank: state.rank,
      newCapabilities: state.capabilities,
      changes: ["Already at maximum rank: Sovereign"],
      auditEntry: null,
    };
  }

  const fromRank = state.rank;
  const toRank = RANK_ORDER[currentIdx + 1];
  const oldCaps = { ...state.capabilities };
  const newCaps = { ...RANK_TIERS[toRank] };

  const changes: string[] = [];
  if (oldCaps.tradingLimitSOL !== newCaps.tradingLimitSOL) changes.push(`tradingLimitSOL: ${oldCaps.tradingLimitSOL} → ${newCaps.tradingLimitSOL}`);
  if (oldCaps.maxPositionSOL !== newCaps.maxPositionSOL) changes.push(`maxPositionSOL: ${oldCaps.maxPositionSOL} → ${newCaps.maxPositionSOL}`);
  if (oldCaps.councilVoteWeight !== newCaps.councilVoteWeight) changes.push(`councilVoteWeight: ${oldCaps.councilVoteWeight} → ${newCaps.councilVoteWeight}`);
  if (oldCaps.canAccessCrossAgentCoordination !== newCaps.canAccessCrossAgentCoordination) changes.push(`crossAgentCoordination: ${oldCaps.canAccessCrossAgentCoordination} → ${newCaps.canAccessCrossAgentCoordination}`);
  if (oldCaps.canMergeWithOtherAgents !== newCaps.canMergeWithOtherAgents) changes.push(`agentMerging: ${oldCaps.canMergeWithOtherAgents} → ${newCaps.canMergeWithOtherAgents}`);
  if (oldCaps.canTriggerAutonomousActions !== newCaps.canTriggerAutonomousActions) changes.push(`autonomousActions: ${oldCaps.canTriggerAutonomousActions} → ${newCaps.canTriggerAutonomousActions}`);
  if (oldCaps.canMentorLowerRanks !== newCaps.canMentorLowerRanks) changes.push(`mentoring: ${oldCaps.canMentorLowerRanks} → ${newCaps.canMentorLowerRanks}`);
  const newBots = newCaps.allowedBotTypes.filter(b => !oldCaps.allowedBotTypes.includes(b));
  if (newBots.length > 0) changes.push(`unlockedBots: [${newBots.join(", ")}]`);
  const newActions = newCaps.allowedActionTypes.filter(a => !oldCaps.allowedActionTypes.includes(a));
  if (newActions.length > 0) changes.push(`unlockedActions: [${newActions.join(", ")}]`);
  const newConsensus = newCaps.allowedConsensusTypes.filter(c => !oldCaps.allowedConsensusTypes.includes(c));
  if (newConsensus.length > 0) changes.push(`unlockedConsensusTypes: [${newConsensus.join(", ")}]`);
  if (oldCaps.maxDailyBuysMultiplier !== newCaps.maxDailyBuysMultiplier) changes.push(`dailyBuysMultiplier: ${oldCaps.maxDailyBuysMultiplier}x → ${newCaps.maxDailyBuysMultiplier}x`);

  state.rank = toRank;
  state.level = newCaps.level;
  state.capabilities = newCaps;
  state.lastUpdated = Date.now();
  state.promotionHistory.push({
    fromRank,
    toRank,
    timestamp: Date.now(),
    reason,
    capabilityDelta: {
      tradingLimitSOL: newCaps.tradingLimitSOL,
      maxPositionSOL: newCaps.maxPositionSOL,
      councilVoteWeight: newCaps.councilVoteWeight,
      canAccessCrossAgentCoordination: newCaps.canAccessCrossAgentCoordination,
      canMergeWithOtherAgents: newCaps.canMergeWithOtherAgents,
      canTriggerAutonomousActions: newCaps.canTriggerAutonomousActions,
      canMentorLowerRanks: newCaps.canMentorLowerRanks,
    },
  });

  const auditEntry = {
    timestamp: Date.now(),
    agentId,
    event: "PROMOTION",
    fromRank,
    toRank,
    changes,
  };
  s.auditLog.push(auditEntry);
  if (s.auditLog.length > 1000) s.auditLog = s.auditLog.slice(-500);

  saveStore();
  clog(`PROMOTED ${agentId}: ${fromRank} → ${toRank} | Changes: ${changes.join("; ")}`);
  return { success: true, fromRank, toRank, newCapabilities: newCaps, changes, auditEntry };
}

export function demoteAgent(agentId: string, reason: string = "Performance failure"): {
  success: boolean;
  fromRank: AgentRank;
  toRank: AgentRank;
  newCapabilities: RankCapabilities;
  changes: string[];
  auditEntry: any;
} {
  const s = loadStore();
  const state = getOrCreateAgentState(agentId);

  if (state.locked) {
    return {
      success: false,
      fromRank: state.rank,
      toRank: state.rank,
      newCapabilities: state.capabilities,
      changes: [],
      auditEntry: null,
    };
  }

  const currentIdx = RANK_ORDER.indexOf(state.rank);
  if (currentIdx <= 0) {
    clog(`${agentId} is already at minimum rank: ${state.rank}`);
    return {
      success: false,
      fromRank: state.rank,
      toRank: state.rank,
      newCapabilities: state.capabilities,
      changes: ["Already at minimum rank: Apprentice"],
      auditEntry: null,
    };
  }

  const fromRank = state.rank;
  const toRank = RANK_ORDER[currentIdx - 1];
  const oldCaps = { ...state.capabilities };
  const newCaps = { ...RANK_TIERS[toRank] };

  const changes: string[] = [];
  if (oldCaps.tradingLimitSOL !== newCaps.tradingLimitSOL) changes.push(`tradingLimitSOL: ${oldCaps.tradingLimitSOL} → ${newCaps.tradingLimitSOL} (RESTRICTED)`);
  if (oldCaps.maxPositionSOL !== newCaps.maxPositionSOL) changes.push(`maxPositionSOL: ${oldCaps.maxPositionSOL} → ${newCaps.maxPositionSOL} (RESTRICTED)`);
  if (oldCaps.councilVoteWeight !== newCaps.councilVoteWeight) changes.push(`councilVoteWeight: ${oldCaps.councilVoteWeight} → ${newCaps.councilVoteWeight} (REDUCED)`);
  if (oldCaps.canAccessCrossAgentCoordination !== newCaps.canAccessCrossAgentCoordination) changes.push(`crossAgentCoordination: REVOKED`);
  if (oldCaps.canMergeWithOtherAgents !== newCaps.canMergeWithOtherAgents) changes.push(`agentMerging: REVOKED`);
  if (oldCaps.canTriggerAutonomousActions !== newCaps.canTriggerAutonomousActions) changes.push(`autonomousActions: REVOKED`);
  if (oldCaps.canMentorLowerRanks !== newCaps.canMentorLowerRanks) changes.push(`mentoring: REVOKED`);
  const lostBots = oldCaps.allowedBotTypes.filter(b => !newCaps.allowedBotTypes.includes(b));
  if (lostBots.length > 0) changes.push(`revokedBots: [${lostBots.join(", ")}]`);
  const lostActions = oldCaps.allowedActionTypes.filter(a => !newCaps.allowedActionTypes.includes(a));
  if (lostActions.length > 0) changes.push(`revokedActions: [${lostActions.join(", ")}]`);
  const lostConsensus = oldCaps.allowedConsensusTypes.filter(c => !newCaps.allowedConsensusTypes.includes(c));
  if (lostConsensus.length > 0) changes.push(`revokedConsensusTypes: [${lostConsensus.join(", ")}]`);
  if (oldCaps.maxDailyBuysMultiplier !== newCaps.maxDailyBuysMultiplier) changes.push(`dailyBuysMultiplier: ${oldCaps.maxDailyBuysMultiplier}x → ${newCaps.maxDailyBuysMultiplier}x (REDUCED)`);

  state.rank = toRank;
  state.level = newCaps.level;
  state.capabilities = newCaps;
  state.lastUpdated = Date.now();
  state.promotionHistory.push({
    fromRank,
    toRank,
    timestamp: Date.now(),
    reason: `DEMOTION: ${reason}`,
    capabilityDelta: {
      tradingLimitSOL: newCaps.tradingLimitSOL,
      maxPositionSOL: newCaps.maxPositionSOL,
      councilVoteWeight: newCaps.councilVoteWeight,
      canAccessCrossAgentCoordination: newCaps.canAccessCrossAgentCoordination,
      canMergeWithOtherAgents: newCaps.canMergeWithOtherAgents,
      canTriggerAutonomousActions: newCaps.canTriggerAutonomousActions,
      canMentorLowerRanks: newCaps.canMentorLowerRanks,
    },
  });

  const auditEntry = {
    timestamp: Date.now(),
    agentId,
    event: "DEMOTION",
    fromRank,
    toRank,
    changes,
  };
  s.auditLog.push(auditEntry);
  if (s.auditLog.length > 1000) s.auditLog = s.auditLog.slice(-500);

  saveStore();
  clog(`DEMOTED ${agentId}: ${fromRank} → ${toRank} | Changes: ${changes.join("; ")}`);
  return { success: true, fromRank, toRank, newCapabilities: newCaps, changes, auditEntry };
}

export function setAgentRank(agentId: string, rank: AgentRank, reason: string = "Manual assignment"): AgentCapabilityState {
  const s = loadStore();
  const state = getOrCreateAgentState(agentId);
  const fromRank = state.rank;
  const newCaps = { ...RANK_TIERS[rank] };

  state.rank = rank;
  state.level = newCaps.level;
  state.capabilities = newCaps;
  state.lastUpdated = Date.now();
  state.promotionHistory.push({
    fromRank,
    toRank: rank,
    timestamp: Date.now(),
    reason: `ASSIGNMENT: ${reason}`,
    capabilityDelta: {},
  });

  s.auditLog.push({
    timestamp: Date.now(),
    agentId,
    event: "RANK_SET",
    fromRank,
    toRank: rank,
    changes: [`Rank set to ${rank} by admin`],
  });

  saveStore();
  clog(`RANK SET ${agentId}: ${fromRank} → ${rank}`);
  return state;
}

export function initializeAgentsWithRanks(agentIds: string[]): void {
  const s = loadStore();
  const ranks = RANK_ORDER;
  let initialized = 0;

  for (const agentId of agentIds) {
    if (!s.agents[agentId]) {
      const rankIdx = agentId.includes("prime") || agentId.includes("tessera-prime") ? 4 :
                      agentId.includes("alpha") || agentId.includes("beta") || agentId.includes("gamma") ? 3 :
                      agentId.includes("solver") || agentId.includes("oracle") || agentId.includes("detective") ? 3 :
                      agentId.includes("mb-") ? 2 :
                      2;
      const rank = ranks[Math.min(rankIdx, ranks.length - 1)];
      getOrCreateAgentState(agentId, rank);
      initialized++;
    }
  }

  if (initialized > 0) {
    clog(`Initialized ${initialized} agents with rank-based capabilities`);
    saveStore();
  }
}

export function getCapabilityAuditLog(limit: number = 100): CapabilityStore["auditLog"] {
  const s = loadStore();
  return s.auditLog.slice(-limit);
}

export function getAllAgentCapabilities(): Record<string, AgentCapabilityState> {
  return loadStore().agents;
}

export function getCapabilitySystemStatus(): {
  totalAgents: number;
  rankDistribution: Record<AgentRank, number>;
  recentAuditLog: any[];
  rankTierSummary: Array<{ rank: AgentRank; tradingLimit: number; voteWeight: number; bots: number; actions: number }>;
} {
  const s = loadStore();
  const dist: Record<AgentRank, number> = { Apprentice: 0, Journeyman: 0, Expert: 0, Master: 0, Sovereign: 0 };
  for (const state of Object.values(s.agents)) {
    dist[state.rank] = (dist[state.rank] || 0) + 1;
  }

  return {
    totalAgents: Object.keys(s.agents).length,
    rankDistribution: dist,
    recentAuditLog: s.auditLog.slice(-20),
    rankTierSummary: RANK_ORDER.map(rank => ({
      rank,
      tradingLimit: RANK_TIERS[rank].tradingLimitSOL,
      voteWeight: RANK_TIERS[rank].councilVoteWeight,
      bots: RANK_TIERS[rank].allowedBotTypes.length,
      actions: RANK_TIERS[rank].allowedActionTypes.length,
    })),
  };
}

clog("Capability Tier System initialized — 5 rank tiers: Apprentice → Journeyman → Expert → Master → Sovereign");
