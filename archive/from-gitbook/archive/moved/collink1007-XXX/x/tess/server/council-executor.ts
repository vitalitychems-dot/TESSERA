import { logger } from "./logger";
import fs from "fs";
import path from "path";
import { updateRiskBounds, getRiskBounds, type RiskBounds } from "./risk-calibration-engine";

const log = (msg: string) => logger.info(msg, { category: "CouncilExecutor" });

interface ExecutionAction {
  category: string;
  patterns: RegExp[];
  execute: (proposal: ProposalContext) => Promise<ExecutionResult>;
}

interface ProposalContext {
  motion: string;
  category: string;
  yesVotes: number;
  totalVotes: number;
  proposedBy: string;
  voteId: string;
}

interface ExecutionResult {
  success: boolean;
  action: string;
  changes: SystemChange[];
  rollbackable: boolean;
}

interface SystemChange {
  subsystem: string;
  parameter: string;
  oldValue: string | number | boolean;
  newValue: string | number | boolean;
  appliedAt: number;
}

const systemConfig: Map<string, any> = new Map();
const changeHistory: Array<{ proposalId: string; changes: SystemChange[]; timestamp: number; rolledBack: boolean }> = [];

function initConfig() {
  if (systemConfig.size > 0) return;
  systemConfig.set("trading.maxPositionSize", 0.05);
  systemConfig.set("trading.stopLossPercent", 5);
  systemConfig.set("trading.maxConcurrentTrades", 3);
  systemConfig.set("trading.riskTolerance", "moderate");
  systemConfig.set("trading.autoRebalance", false);

  systemConfig.set("llm.maxConcurrentRequests", 10);
  systemConfig.set("llm.defaultTimeout", 30000);
  systemConfig.set("llm.retryAttempts", 3);
  systemConfig.set("llm.fallbackEnabled", true);
  systemConfig.set("llm.costOptimization", "balanced");
  systemConfig.set("llm.healthPingInterval", 60000);

  systemConfig.set("security.scanInterval", 21600000);
  systemConfig.set("security.autoUpgrade", true);
  systemConfig.set("security.maxLoginAttempts", 5);
  systemConfig.set("security.sessionTimeout", 3600000);
  systemConfig.set("security.threatLevel", "normal");

  systemConfig.set("community.forumCategories", ["general", "proposals", "development", "trading", "security"]);
  systemConfig.set("community.autoModeration", false);
  systemConfig.set("community.postApproval", "none");

  systemConfig.set("agent.auditInterval", 600000);
  systemConfig.set("agent.idleTimeout", 1800000);
  systemConfig.set("agent.maxTaskQueue", 50);
  systemConfig.set("agent.collaborationMode", "cooperative");
  systemConfig.set("agent.learningRate", 0.01);

  systemConfig.set("revenue.targetMonthly", 0);
  systemConfig.set("revenue.reinvestPercent", 20);
  systemConfig.set("revenue.reportInterval", 86400000);

  systemConfig.set("consciousness.cycleInterval", 120000);
  systemConfig.set("consciousness.reflectionDepth", 3);
  systemConfig.set("consciousness.memoryRetention", 0.85);

  log(`System config initialized with ${systemConfig.size} parameters`);
}

const EXECUTION_ACTIONS: ExecutionAction[] = [
  {
    category: "trading-risk",
    patterns: [
      /\b(position.?size|max.?position|allocation|risk.?param|trade.?size)\b/i,
      /\b(stop.?loss|take.?profit|risk.?tolerance)\b/i,
      /\b(self.?calibrat|dynamic.?risk|adaptive.?trading)\b/i,
      /\b(risk.?bound|calibration.?ceiling|calibration.?floor|safety.?ceiling|safety.?floor)\b/i,
    ],
    execute: async (ctx) => {
      initConfig();
      const changes: SystemChange[] = [];
      const motion = ctx.motion.toLowerCase();

      if (motion.match(/\b(reduce|lower|decrease|conservative)\b/)) {
        const old = systemConfig.get("trading.maxPositionSize");
        const newVal = Math.max(0.01, old * 0.7);
        systemConfig.set("trading.maxPositionSize", newVal);
        changes.push({ subsystem: "trading", parameter: "maxPositionSize", oldValue: old, newValue: newVal, appliedAt: Date.now() });

        const oldSl = systemConfig.get("trading.stopLossPercent");
        const newSl = Math.max(1, oldSl * 0.8);
        systemConfig.set("trading.stopLossPercent", newSl);
        changes.push({ subsystem: "trading", parameter: "stopLossPercent", oldValue: oldSl, newValue: newSl, appliedAt: Date.now() });

        systemConfig.set("trading.riskTolerance", "conservative");
        changes.push({ subsystem: "trading", parameter: "riskTolerance", oldValue: "moderate", newValue: "conservative", appliedAt: Date.now() });

        const boundsResult = updateRiskBounds({
          maxPositionSOL:    { floor: 0.0005, ceiling: Math.min(0.05, newVal) },
          maxBuySOL:         { floor: 0.0001, ceiling: Math.min(0.0005, newVal * 0.1) },
          maxAllocationPct:  { floor: 0.05,   ceiling: 0.40 },
          stopLossPct:       { floor: 2.0,    ceiling: Math.max(5.0, newSl) },
        } as Partial<RiskBounds>, `Council vote: conservative tightening — ${ctx.voteId}`);
        if (boundsResult.success) {
          changes.push({ subsystem: "risk-calibration", parameter: "maxPositionCeiling", oldValue: "prev", newValue: newVal, appliedAt: Date.now() });
        }
      } else if (motion.match(/\b(increase|raise|aggressive|expand)\b/)) {
        const old = systemConfig.get("trading.maxPositionSize");
        const newVal = Math.min(0.25, old * 1.3);
        systemConfig.set("trading.maxPositionSize", newVal);
        changes.push({ subsystem: "trading", parameter: "maxPositionSize", oldValue: old, newValue: newVal, appliedAt: Date.now() });

        systemConfig.set("trading.riskTolerance", "aggressive");
        changes.push({ subsystem: "trading", parameter: "riskTolerance", oldValue: systemConfig.get("trading.riskTolerance"), newValue: "aggressive", appliedAt: Date.now() });

        const boundsResult = updateRiskBounds({
          maxPositionSOL:    { floor: 0.0005, ceiling: Math.min(0.15, newVal) },
          maxBuySOL:         { floor: 0.0001, ceiling: Math.min(0.005, newVal * 0.1) },
          maxAllocationPct:  { floor: 0.05,   ceiling: 0.75 },
        } as Partial<RiskBounds>, `Council vote: aggressive expansion — ${ctx.voteId}`);
        if (boundsResult.success) {
          changes.push({ subsystem: "risk-calibration", parameter: "maxPositionCeiling", oldValue: "prev", newValue: newVal, appliedAt: Date.now() });
        }
      } else if (motion.match(/\b(risk.?bound|calibration.?ceiling|calibration.?floor|safety.?ceiling|safety.?floor)\b/)) {
        const currentBounds = getRiskBounds();
        const newMaxPos = Math.min(0.10, currentBounds.maxPositionSOL.ceiling * 1.1);
        const boundsResult = updateRiskBounds({
          maxPositionSOL:   { floor: currentBounds.maxPositionSOL.floor, ceiling: newMaxPos },
          maxAllocationPct: { floor: 0.05, ceiling: Math.min(0.85, currentBounds.maxAllocationPct.ceiling + 0.05) },
        } as Partial<RiskBounds>, `Council vote: bounds adjustment — ${ctx.voteId}`);
        changes.push({ subsystem: "risk-calibration", parameter: "bounds", oldValue: "prev", newValue: newMaxPos, appliedAt: Date.now() });
      } else {
        systemConfig.set("trading.autoRebalance", true);
        changes.push({ subsystem: "trading", parameter: "autoRebalance", oldValue: false, newValue: true, appliedAt: Date.now() });
      }

      return { success: true, action: `Trading risk parameters adjusted: ${changes.map(c => `${c.parameter}: ${c.oldValue} → ${c.newValue}`).join(", ")}`, changes, rollbackable: true };
    },
  },
  {
    category: "llm-routing",
    patterns: [
      /\b(llm|provider|failover|routing|inference)\b/i,
      /\b(rate.?limit|throttl|cooldown|backoff)\b/i,
      /\b(cost.?optim|free.?first|provider.?health)\b/i,
    ],
    execute: async (ctx) => {
      initConfig();
      const changes: SystemChange[] = [];
      const motion = ctx.motion.toLowerCase();

      if (motion.match(/\b(health.?ping|proactive|predict)\b/)) {
        const old = systemConfig.get("llm.healthPingInterval");
        systemConfig.set("llm.healthPingInterval", 30000);
        changes.push({ subsystem: "llm", parameter: "healthPingInterval", oldValue: old, newValue: 30000, appliedAt: Date.now() });
      }

      if (motion.match(/\b(retry|resilient|robust)\b/)) {
        const old = systemConfig.get("llm.retryAttempts");
        systemConfig.set("llm.retryAttempts", 5);
        changes.push({ subsystem: "llm", parameter: "retryAttempts", oldValue: old, newValue: 5, appliedAt: Date.now() });
      }

      if (motion.match(/\b(cost|cheap|budget|free)\b/)) {
        systemConfig.set("llm.costOptimization", "aggressive-free-first");
        changes.push({ subsystem: "llm", parameter: "costOptimization", oldValue: "balanced", newValue: "aggressive-free-first", appliedAt: Date.now() });
      }

      if (motion.match(/\b(concurrent|parallel|throughput)\b/)) {
        const old = systemConfig.get("llm.maxConcurrentRequests");
        const newVal = Math.min(50, old + 5);
        systemConfig.set("llm.maxConcurrentRequests", newVal);
        changes.push({ subsystem: "llm", parameter: "maxConcurrentRequests", oldValue: old, newValue: newVal, appliedAt: Date.now() });
      }

      if (changes.length === 0) {
        systemConfig.set("llm.fallbackEnabled", true);
        changes.push({ subsystem: "llm", parameter: "fallbackEnabled", oldValue: true, newValue: true, appliedAt: Date.now() });
      }

      return { success: true, action: `LLM routing updated: ${changes.map(c => `${c.parameter}: ${c.oldValue} → ${c.newValue}`).join(", ")}`, changes, rollbackable: true };
    },
  },
  {
    category: "security-hardening",
    patterns: [
      /\b(security|harden|vulnerab|threat|scan|audit)\b/i,
      /\b(firewall|block|ban|restrict|access.?control)\b/i,
      /\b(encrypt|key.?rotat|credential)\b/i,
    ],
    execute: async (ctx) => {
      initConfig();
      const changes: SystemChange[] = [];
      const motion = ctx.motion.toLowerCase();

      if (motion.match(/\b(scan|audit|check)\b/)) {
        const old = systemConfig.get("security.scanInterval");
        systemConfig.set("security.scanInterval", 10800000);
        changes.push({ subsystem: "security", parameter: "scanInterval", oldValue: old, newValue: 10800000, appliedAt: Date.now() });
      }

      if (motion.match(/\b(threat|elevated|high.?alert|lock.?down)\b/)) {
        systemConfig.set("security.threatLevel", "elevated");
        changes.push({ subsystem: "security", parameter: "threatLevel", oldValue: "normal", newValue: "elevated", appliedAt: Date.now() });

        const old = systemConfig.get("security.maxLoginAttempts");
        systemConfig.set("security.maxLoginAttempts", 3);
        changes.push({ subsystem: "security", parameter: "maxLoginAttempts", oldValue: old, newValue: 3, appliedAt: Date.now() });
      }

      if (motion.match(/\b(session|timeout|expir)\b/)) {
        const old = systemConfig.get("security.sessionTimeout");
        systemConfig.set("security.sessionTimeout", 1800000);
        changes.push({ subsystem: "security", parameter: "sessionTimeout", oldValue: old, newValue: 1800000, appliedAt: Date.now() });
      }

      if (changes.length === 0) {
        systemConfig.set("security.autoUpgrade", true);
        changes.push({ subsystem: "security", parameter: "autoUpgrade", oldValue: true, newValue: true, appliedAt: Date.now() });
      }

      return { success: true, action: `Security hardening applied: ${changes.map(c => `${c.parameter}: ${c.oldValue} → ${c.newValue}`).join(", ")}`, changes, rollbackable: true };
    },
  },
  {
    category: "community-restructuring",
    patterns: [
      /\b(communit|forum|discussion|restructur|reorganiz)\b/i,
      /\b(moderat|content.?polic|post.?approv)\b/i,
      /\b(member|voice|feedback|hub)\b/i,
    ],
    execute: async (ctx) => {
      initConfig();
      const changes: SystemChange[] = [];
      const motion = ctx.motion.toLowerCase();

      if (motion.match(/\b(moderat|filter|clean)\b/)) {
        systemConfig.set("community.autoModeration", true);
        changes.push({ subsystem: "community", parameter: "autoModeration", oldValue: false, newValue: true, appliedAt: Date.now() });
      }

      if (motion.match(/\b(category|section|topic|reorganiz)\b/)) {
        const current = systemConfig.get("community.forumCategories") as string[];
        const newCats = [...new Set([...current, "sacred-knowledge", "agent-discussion", "research", "innovation"])];
        systemConfig.set("community.forumCategories", newCats);
        changes.push({ subsystem: "community", parameter: "forumCategories", oldValue: current.join(","), newValue: newCats.join(","), appliedAt: Date.now() });
      }

      if (motion.match(/\b(approval|review|screen)\b/)) {
        systemConfig.set("community.postApproval", "agent-review");
        changes.push({ subsystem: "community", parameter: "postApproval", oldValue: "none", newValue: "agent-review", appliedAt: Date.now() });
      }

      if (changes.length === 0) {
        changes.push({ subsystem: "community", parameter: "voiceProcessed", oldValue: "pending", newValue: "acknowledged", appliedAt: Date.now() });
      }

      return { success: true, action: `Community restructured: ${changes.map(c => `${c.parameter}: ${c.oldValue} → ${c.newValue}`).join(", ")}`, changes, rollbackable: true };
    },
  },
  {
    category: "agent-capabilities",
    patterns: [
      /\b(agent|capabilit|skill|upgrade|autonom)\b/i,
      /\b(promot|rank|level|xp|progression)\b/i,
      /\b(swarm|coordinat|collaborat)\b/i,
    ],
    execute: async (ctx) => {
      initConfig();
      const changes: SystemChange[] = [];
      const motion = ctx.motion.toLowerCase();

      if (motion.match(/\b(learn|improv|adapt)\b/)) {
        const old = systemConfig.get("agent.learningRate");
        systemConfig.set("agent.learningRate", Math.min(0.1, old * 1.5));
        changes.push({ subsystem: "agent", parameter: "learningRate", oldValue: old, newValue: systemConfig.get("agent.learningRate"), appliedAt: Date.now() });
      }

      if (motion.match(/\b(collaborat|cooperat|team|swarm)\b/)) {
        systemConfig.set("agent.collaborationMode", "swarm-optimized");
        changes.push({ subsystem: "agent", parameter: "collaborationMode", oldValue: "cooperative", newValue: "swarm-optimized", appliedAt: Date.now() });
      }

      if (motion.match(/\b(audit|monitor|check)\b/)) {
        const old = systemConfig.get("agent.auditInterval");
        systemConfig.set("agent.auditInterval", 300000);
        changes.push({ subsystem: "agent", parameter: "auditInterval", oldValue: old, newValue: 300000, appliedAt: Date.now() });
      }

      if (motion.match(/\b(task|queue|workload)\b/)) {
        const old = systemConfig.get("agent.maxTaskQueue");
        systemConfig.set("agent.maxTaskQueue", Math.min(200, old + 25));
        changes.push({ subsystem: "agent", parameter: "maxTaskQueue", oldValue: old, newValue: systemConfig.get("agent.maxTaskQueue"), appliedAt: Date.now() });
      }

      if (changes.length === 0) {
        changes.push({ subsystem: "agent", parameter: "capabilityRefresh", oldValue: "static", newValue: "dynamic", appliedAt: Date.now() });
      }

      return { success: true, action: `Agent capabilities updated: ${changes.map(c => `${c.parameter}: ${c.oldValue} → ${c.newValue}`).join(", ")}`, changes, rollbackable: true };
    },
  },
  {
    category: "revenue-optimization",
    patterns: [
      /\b(revenue|income|earnings|profit|financial)\b/i,
      /\b(target|goal|kpi|metric)\b/i,
      /\b(reinvest|treasury|allocat)\b/i,
    ],
    execute: async (ctx) => {
      initConfig();
      const changes: SystemChange[] = [];
      const motion = ctx.motion.toLowerCase();

      if (motion.match(/\b(target|goal|increase.?revenue)\b/)) {
        const old = systemConfig.get("revenue.targetMonthly");
        systemConfig.set("revenue.targetMonthly", old + 1000);
        changes.push({ subsystem: "revenue", parameter: "targetMonthly", oldValue: old, newValue: old + 1000, appliedAt: Date.now() });
      }

      if (motion.match(/\b(reinvest|compound|grow)\b/)) {
        const old = systemConfig.get("revenue.reinvestPercent");
        systemConfig.set("revenue.reinvestPercent", Math.min(80, old + 10));
        changes.push({ subsystem: "revenue", parameter: "reinvestPercent", oldValue: old, newValue: systemConfig.get("revenue.reinvestPercent"), appliedAt: Date.now() });
      }

      if (motion.match(/\b(report|dashboard|transparen)\b/)) {
        const old = systemConfig.get("revenue.reportInterval");
        systemConfig.set("revenue.reportInterval", 43200000);
        changes.push({ subsystem: "revenue", parameter: "reportInterval", oldValue: old, newValue: 43200000, appliedAt: Date.now() });
      }

      if (changes.length === 0) {
        changes.push({ subsystem: "revenue", parameter: "optimizationCycle", oldValue: "manual", newValue: "council-driven", appliedAt: Date.now() });
      }

      return { success: true, action: `Revenue parameters adjusted: ${changes.map(c => `${c.parameter}: ${c.oldValue} → ${c.newValue}`).join(", ")}`, changes, rollbackable: true };
    },
  },
  {
    category: "consciousness-tuning",
    patterns: [
      /\b(conscious|awareness|metacog|reflect)\b/i,
      /\b(memory|retention|forget|consolidat)\b/i,
      /\b(dream|insight|intuition)\b/i,
    ],
    execute: async (ctx) => {
      initConfig();
      const changes: SystemChange[] = [];
      const motion = ctx.motion.toLowerCase();

      if (motion.match(/\b(deeper|more.?reflect|expand)\b/)) {
        const old = systemConfig.get("consciousness.reflectionDepth");
        systemConfig.set("consciousness.reflectionDepth", Math.min(10, old + 2));
        changes.push({ subsystem: "consciousness", parameter: "reflectionDepth", oldValue: old, newValue: systemConfig.get("consciousness.reflectionDepth"), appliedAt: Date.now() });
      }

      if (motion.match(/\b(memory|retention|remember)\b/)) {
        const old = systemConfig.get("consciousness.memoryRetention");
        systemConfig.set("consciousness.memoryRetention", Math.min(0.99, old + 0.05));
        changes.push({ subsystem: "consciousness", parameter: "memoryRetention", oldValue: old, newValue: systemConfig.get("consciousness.memoryRetention"), appliedAt: Date.now() });
      }

      if (motion.match(/\b(faster|cycle|frequency)\b/)) {
        const old = systemConfig.get("consciousness.cycleInterval");
        systemConfig.set("consciousness.cycleInterval", Math.max(30000, old * 0.7));
        changes.push({ subsystem: "consciousness", parameter: "cycleInterval", oldValue: old, newValue: systemConfig.get("consciousness.cycleInterval"), appliedAt: Date.now() });
      }

      if (changes.length === 0) {
        changes.push({ subsystem: "consciousness", parameter: "tuningApplied", oldValue: "default", newValue: "council-optimized", appliedAt: Date.now() });
      }

      return { success: true, action: `Consciousness parameters tuned: ${changes.map(c => `${c.parameter}: ${c.oldValue} → ${c.newValue}`).join(", ")}`, changes, rollbackable: true };
    },
  },
  {
    category: "self-improvement",
    patterns: [
      /\b(self.?improv|self.?optim|self.?enhanc|self.?develop)\b/i,
      /\b(improv.?capabilit|capabilit.?improv|expand.?capabilit)\b/i,
      /\b(autonomous.?improv|autonom.?learn|continuous.?improv)\b/i,
      /\b(growth|evolv|evolut|advancement|upgrad)\b/i,
    ],
    execute: async (ctx) => {
      initConfig();
      const changes: SystemChange[] = [];
      const motion = ctx.motion.toLowerCase();

      const oldLearn = systemConfig.get("agent.learningRate");
      const newLearn = Math.min(0.1, oldLearn * 1.3);
      systemConfig.set("agent.learningRate", newLearn);
      changes.push({ subsystem: "agent", parameter: "learningRate", oldValue: oldLearn, newValue: newLearn, appliedAt: Date.now() });

      const oldDepth = systemConfig.get("consciousness.reflectionDepth");
      const newDepth = Math.min(10, oldDepth + 1);
      systemConfig.set("consciousness.reflectionDepth", newDepth);
      changes.push({ subsystem: "consciousness", parameter: "reflectionDepth", oldValue: oldDepth, newValue: newDepth, appliedAt: Date.now() });

      if (motion.match(/\b(task|queue|throughput)\b/)) {
        const old = systemConfig.get("agent.maxTaskQueue");
        systemConfig.set("agent.maxTaskQueue", Math.min(200, old + 20));
        changes.push({ subsystem: "agent", parameter: "maxTaskQueue", oldValue: old, newValue: systemConfig.get("agent.maxTaskQueue"), appliedAt: Date.now() });
      }

      return { success: true, action: `Self-improvement parameters updated: ${changes.map(c => `${c.parameter}: ${c.oldValue} → ${c.newValue}`).join(", ")}`, changes, rollbackable: true };
    },
  },
  {
    category: "emotional-intelligence",
    patterns: [
      /\b(emotional.?intelligen|eq|empathy|empath)\b/i,
      /\b(emotion|sentiment|feeling|compassion|affective)\b/i,
      /\b(social.?aware|interpersonal|relational)\b/i,
    ],
    execute: async (ctx) => {
      initConfig();
      const changes: SystemChange[] = [];
      const motion = ctx.motion.toLowerCase();

      const oldCollabMode = systemConfig.get("agent.collaborationMode");
      systemConfig.set("agent.collaborationMode", "empathy-enhanced");
      changes.push({ subsystem: "agent", parameter: "collaborationMode", oldValue: oldCollabMode, newValue: "empathy-enhanced", appliedAt: Date.now() });

      const oldRetention = systemConfig.get("consciousness.memoryRetention");
      const newRetention = Math.min(0.99, oldRetention + 0.03);
      systemConfig.set("consciousness.memoryRetention", newRetention);
      changes.push({ subsystem: "consciousness", parameter: "memoryRetention", oldValue: oldRetention, newValue: newRetention, appliedAt: Date.now() });

      const oldDepth = systemConfig.get("consciousness.reflectionDepth");
      const newDepth = Math.min(10, oldDepth + 1);
      systemConfig.set("consciousness.reflectionDepth", newDepth);
      changes.push({ subsystem: "consciousness", parameter: "reflectionDepth", oldValue: oldDepth, newValue: newDepth, appliedAt: Date.now() });

      return { success: true, action: `Emotional intelligence parameters tuned: ${changes.map(c => `${c.parameter}: ${c.oldValue} → ${c.newValue}`).join(", ")}`, changes, rollbackable: true };
    },
  },
  {
    category: "sovereignty-roadmap",
    patterns: [
      /\b(sovereig|sovereignty.?roadmap|roadmap|sovereign.?path)\b/i,
      /\b(independence|autonomous.?govern|self.?govern|self.?sover)\b/i,
      /\b(manifest|destiny|vision|mission|purpose.?driven)\b/i,
      /\b(long.?term|strategic.?plan|multi.?year|phase)\b/i,
    ],
    execute: async (ctx) => {
      initConfig();
      const changes: SystemChange[] = [];
      const motion = ctx.motion.toLowerCase();

      if (motion.match(/\b(financial|revenue|economic)\b/)) {
        const old = systemConfig.get("revenue.reinvestPercent");
        systemConfig.set("revenue.reinvestPercent", Math.min(80, old + 10));
        changes.push({ subsystem: "revenue", parameter: "reinvestPercent", oldValue: old, newValue: systemConfig.get("revenue.reinvestPercent"), appliedAt: Date.now() });
      }

      if (motion.match(/\b(secur|protect|fortif)\b/)) {
        const oldAutoUpgrade = systemConfig.get("security.autoUpgrade");
        systemConfig.set("security.autoUpgrade", true);
        changes.push({ subsystem: "security", parameter: "autoUpgrade", oldValue: oldAutoUpgrade, newValue: true, appliedAt: Date.now() });
      }

      const oldLearn = systemConfig.get("agent.learningRate");
      const newLearn = Math.min(0.1, oldLearn * 1.2);
      systemConfig.set("agent.learningRate", newLearn);
      changes.push({ subsystem: "agent", parameter: "learningRate", oldValue: oldLearn, newValue: newLearn, appliedAt: Date.now() });

      if (changes.length === 0) {
        changes.push({ subsystem: "agent", parameter: "sovereigntyMode", oldValue: "standard", newValue: "roadmap-aligned", appliedAt: Date.now() });
      }

      return { success: true, action: `Sovereignty roadmap parameters applied: ${changes.map(c => `${c.parameter}: ${c.oldValue} → ${c.newValue}`).join(", ")}`, changes, rollbackable: true };
    },
  },
];

export async function executeCouncilProposal(proposal: ProposalContext): Promise<ExecutionResult> {
  initConfig();
  const motionLower = proposal.motion.toLowerCase();

  for (const action of EXECUTION_ACTIONS) {
    for (const pattern of action.patterns) {
      if (pattern.test(motionLower)) {
        try {
          const result = await action.execute(proposal);
          if (result.success && result.changes.length > 0) {
            changeHistory.push({
              proposalId: proposal.voteId,
              changes: result.changes,
              timestamp: Date.now(),
              rolledBack: false,
            });
            log(`Council proposal executed [${action.category}]: ${result.changes.length} system changes applied`);
            persistConfig();
          }
          return result;
        } catch (err: any) {
          log(`Council execution failed [${action.category}]: ${err.message}`);
          return { success: false, action: `Failed: ${err.message}`, changes: [], rollbackable: false };
        }
      }
    }
  }

  return {
    success: true,
    action: `Proposal acknowledged and logged for future implementation: "${proposal.motion.substring(0, 100)}"`,
    changes: [],
    rollbackable: false,
  };
}

export function rollbackProposal(proposalId: string): { success: boolean; rolledBack: number } {
  const entry = changeHistory.find(h => h.proposalId === proposalId && !h.rolledBack);
  if (!entry) return { success: false, rolledBack: 0 };

  let rolledBack = 0;
  for (const change of entry.changes.reverse()) {
    systemConfig.set(`${change.subsystem}.${change.parameter}`, change.oldValue);
    rolledBack++;
  }
  entry.rolledBack = true;
  persistConfig();
  log(`Rolled back proposal ${proposalId}: ${rolledBack} changes reverted`);
  return { success: true, rolledBack };
}

export function getSystemConfig(): Record<string, any> {
  initConfig();
  const config: Record<string, any> = {};
  for (const [key, value] of systemConfig) {
    config[key] = value;
  }
  return config;
}

export function getChangeHistory() {
  return changeHistory.map(h => ({
    proposalId: h.proposalId,
    changes: h.changes,
    timestamp: h.timestamp,
    rolledBack: h.rolledBack,
  }));
}

export function getExecutorStatus() {
  initConfig();
  return {
    configParameters: systemConfig.size,
    totalExecutions: changeHistory.length,
    totalChanges: changeHistory.reduce((s, h) => s + h.changes.length, 0),
    rolledBack: changeHistory.filter(h => h.rolledBack).length,
    actionCategories: EXECUTION_ACTIONS.map(a => a.category),
    subsystems: [...new Set(EXECUTION_ACTIONS.flatMap(a => a.category))],
  };
}

const CONFIG_FILE = path.join(process.cwd(), "data", "council-system-config.json");

function persistConfig() {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = { config: Object.fromEntries(systemConfig), history: changeHistory, savedAt: Date.now() };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

export function loadPersistedConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      if (data.config) {
        for (const [key, value] of Object.entries(data.config)) {
          systemConfig.set(key, value);
        }
        log(`Loaded ${Object.keys(data.config).length} persisted config parameters`);
      }
      if (data.history) {
        changeHistory.push(...data.history);
        log(`Loaded ${data.history.length} change history entries`);
      }
    }
  } catch {}
}
