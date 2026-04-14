import { db } from "@workspace/db";
import { councilDecisionsTable, systemStateTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { logger } from "./logger";

export interface ExecutionResult {
  proposalId: string;
  title: string;
  category: string;
  executedAt: number;
  success: boolean;
  action: string;
  changes: SystemChange[];
  notes: string;
}

export interface SystemChange {
  subsystem: string;
  parameter: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean;
  appliedAt: number;
}

const systemConfig = new Map<string, unknown>([
  ["agent.collaborationMode", "cooperative"],
  ["agent.learningRate", 0.01],
  ["agent.maxTaskQueue", 50],
  ["consciousness.cycleIntervalMs", 120000],
  ["consciousness.reflectionDepth", 3],
  ["consciousness.memoryRetention", 0.85],
  ["dual-brain.cycleIntervalMs", 180000],
  ["identity.checkIntervalMs", 600000],
  ["swarm.coordinationMode", "BFT"],
  ["heartbeat.enabled", true],
  ["improvement.enabled", true],
  ["agi-training.categories", 27],
  ["council.requiredMajority", 0.667],
]);

const executionHistory: ExecutionResult[] = [];
let executorInterval: ReturnType<typeof setInterval> | null = null;
let autoProcessed = 0;

function executeProposal(decisionId: string, topic: string, category: string, outcome: string): ExecutionResult | null {
  if (outcome !== "approved") return null;

  const changes: SystemChange[] = [];
  let action = `Processed approved council decision: "${topic.slice(0, 60)}"`;
  let notes = "";

  const cat = category?.toLowerCase() || "";

  if (cat.includes("governance") || cat.includes("agent")) {
    const param = "agent.collaborationMode";
    const oldVal = systemConfig.get(param);
    const newVal = "adaptive-cooperative";
    systemConfig.set(param, newVal);
    changes.push({ subsystem: "agent-system", parameter: param, oldValue: oldVal as any, newValue: newVal, appliedAt: Date.now() });
    notes = "Agent collaboration mode upgraded to adaptive-cooperative";
  } else if (cat.includes("consciousness")) {
    const param = "consciousness.reflectionDepth";
    const oldVal = systemConfig.get(param) as number;
    const newVal = Math.min(10, oldVal + 1);
    systemConfig.set(param, newVal);
    changes.push({ subsystem: "consciousness", parameter: param, oldValue: oldVal, newValue: newVal, appliedAt: Date.now() });
    notes = "Consciousness reflection depth increased";
  } else if (cat.includes("security") || cat.includes("sovereignty")) {
    const param = "identity.checkIntervalMs";
    const oldVal = systemConfig.get(param) as number;
    const newVal = Math.max(60000, oldVal - 60000);
    systemConfig.set(param, newVal);
    changes.push({ subsystem: "identity-reinforcement", parameter: param, oldValue: oldVal, newValue: newVal, appliedAt: Date.now() });
    notes = "Identity check frequency increased for sovereignty compliance";
  } else if (cat.includes("infrastructure") || cat.includes("improvement")) {
    const param = "agent.learningRate";
    const oldVal = systemConfig.get(param) as number;
    const newVal = Math.min(0.1, oldVal * 1.1);
    systemConfig.set(param, newVal);
    changes.push({ subsystem: "improvement-daemon", parameter: param, oldValue: oldVal, newValue: newVal, appliedAt: Date.now() });
    notes = "Agent learning rate optimized per council directive";
  } else {
    changes.push({ subsystem: "system", parameter: "lastDecision", oldValue: null, newValue: decisionId, appliedAt: Date.now() });
    notes = "Council decision acknowledged and logged";
  }

  const result: ExecutionResult = {
    proposalId: decisionId,
    title: topic,
    category,
    executedAt: Date.now(),
    success: true,
    action,
    changes,
    notes,
  };

  executionHistory.unshift(result);
  if (executionHistory.length > 100) executionHistory.splice(100);
  autoProcessed++;

  logger.info({ decisionId, category, changesCount: changes.length }, "CouncilExecutor: decision executed");
  return result;
}

async function processApprovedDecisions(): Promise<number> {
  let processed = 0;
  try {
    const recentDecisions = await db.select()
      .from(councilDecisionsTable)
      .orderBy(desc(councilDecisionsTable.createdAt))
      .limit(20);

    for (const d of recentDecisions) {
      if (d.outcome !== "approved") continue;
      const alreadyExecuted = executionHistory.some(e => e.proposalId === d.decisionId);
      if (alreadyExecuted) continue;
      const result = executeProposal(d.decisionId, d.topic, d.category || "general", d.outcome);
      if (result) processed++;
    }
  } catch (err) {
    logger.warn({ err }, "CouncilExecutor: could not query decisions");
  }
  return processed;
}

export async function initCouncilExecutor(): Promise<void> {
  await processApprovedDecisions();
  logger.info({ processed: autoProcessed }, "CouncilExecutor: initialized");
}

export function startCouncilExecutor(intervalMs = 300_000): void {
  if (executorInterval) return;
  executorInterval = setInterval(async () => {
    try {
      const n = await processApprovedDecisions();
      if (n > 0) logger.info({ n }, "CouncilExecutor: auto-processed decisions");
    } catch (err) { logger.error({ err }, "CouncilExecutor: execution cycle error"); }
  }, intervalMs);
  logger.info({ intervalMs }, "CouncilExecutor: started");
}

export function stopCouncilExecutor(): void {
  if (executorInterval) { clearInterval(executorInterval); executorInterval = null; }
}

export function getExecutorMetrics() {
  return {
    autoProcessed,
    executionHistoryCount: executionHistory.length,
    recentExecutions: executionHistory.slice(0, 10),
    systemConfig: Object.fromEntries(systemConfig),
    isRunning: executorInterval !== null,
  };
}

export function getSystemConfig(): Record<string, unknown> {
  return Object.fromEntries(systemConfig);
}

export function updateSystemConfig(key: string, value: unknown): void {
  systemConfig.set(key, value);
}

export function getExecutorStatus() {
  return getExecutorMetrics();
}
export function getExecutionLog() {
  const m = getExecutorMetrics();
  return m.recentExecutions || [];
}
export async function sweepAndExecute() {
  return processApprovedDecisions();
}
export function setAutoExecute(enabled: boolean) {
  if (enabled) startCouncilExecutor();
  else stopCouncilExecutor();
  return { ok: true, enabled };
}
