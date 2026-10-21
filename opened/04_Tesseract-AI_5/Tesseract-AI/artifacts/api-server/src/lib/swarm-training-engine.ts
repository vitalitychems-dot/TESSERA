import { db } from "@workspace/db";
import {
  swarm_training_cycles,
  swarm_votes,
  swarm_nodes,
  swarm_sync_logs,
  knowledge_graph,
  sovereignty_metrics,
  training_pipeline,
} from "@workspace/db";
import { eq, desc, sql, count } from "drizzle-orm";
import { TESSERA_AGENTS } from "./tessera-persona.js";
import { extractCount } from "./db-utils";
import { logger } from "./logger";
import { recordEngineEvent } from "./metacognition-engine";

const LOG_PREFIX = "[SwarmTraining]";

interface SwarmTrainingState {
  cycleCount: number;
  totalKnowledgeAbsorbed: number;
  convergenceRate: number;
  activeNodes: number;
  lastCycleTime: number;
  isRunning: boolean;
}

let engineState: SwarmTrainingState = {
  cycleCount: 0,
  totalKnowledgeAbsorbed: 0,
  convergenceRate: 0,
  activeNodes: 0,
  lastCycleTime: 0,
  isRunning: false,
};

let cycleTimer: ReturnType<typeof setInterval> | null = null;

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function measureRealKnowledgeState(): Promise<{
  totalNodes: number;
  realNodes: number;
  insightNodes: number;
  domainCount: number;
  recentNodes: number;
  sourceTypes: number;
}> {
  let totalNodes = 0, realNodes = 0, insightNodes = 0, domainCount = 0, recentNodes = 0, sourceTypes = 0;

  try {
    const r1 = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph`);
    totalNodes = extractCount(r1);
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const r2 = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph WHERE source_type NOT IN ('insight', 'swarm_training')`);
    realNodes = extractCount(r2);
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const r3 = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph WHERE source_type = 'insight'`);
    insightNodes = extractCount(r3);
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const r4 = await db.execute(sql`SELECT COUNT(DISTINCT metadata->>'domain') as cnt FROM knowledge_graph WHERE metadata->>'domain' IS NOT NULL`);
    domainCount = extractCount(r4);
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const r5 = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph WHERE created_at > NOW() - INTERVAL '1 hour'`);
    recentNodes = extractCount(r5);
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const r6 = await db.execute(sql`SELECT COUNT(DISTINCT source_type) as cnt FROM knowledge_graph`);
    sourceTypes = extractCount(r6);
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  return { totalNodes, realNodes, insightNodes, domainCount, recentNodes, sourceTypes };
}

async function recordAgentContributions(cycleId: string, knowledgeState: any): Promise<{ contributions: number }> {
  const agents = TESSERA_AGENTS.slice(0, 27);
  let contributions = 0;

  for (const agent of agents) {
    const agentDomain = agent.dimension || agent.role || "general";
    let domainNodes = 0;
    try {
      const r = await db.execute(sql.raw(`
        SELECT COUNT(*) as cnt FROM knowledge_graph 
        WHERE label ILIKE '%${agentDomain}%' OR content ILIKE '%${agentDomain}%'
        OR metadata->>'domain' ILIKE '%${agentDomain}%'
      `));
      domainNodes = extractCount(r);
    } catch (err) { logger.warn({ err }, "suppressed error"); }

    const hasKnowledge = domainNodes > 0;
    contributions += hasKnowledge ? 1 : 0;

    await db.insert(swarm_votes).values({
      voteId: generateId("sv"),
      cycleId,
      agentId: agent.id,
      agentName: agent.name,
      proposalType: "knowledge_assessment",
      proposal: `Domain coverage assessment for ${agentDomain}`,
      vote: hasKnowledge ? "approve" : "abstain",
      confidence: Math.min(1, domainNodes / 100),
      reasoning: hasKnowledge
        ? `${domainNodes} knowledge nodes found in ${agentDomain} domain — contribution verified.`
        : `No knowledge nodes found in ${agentDomain} domain — need more data ingestion.`,
      dimensionalPerspective: agentDomain,
      weight: agent.id === "tessera" ? 2.0 : 1.0,
    }).onConflictDoNothing();
  }

  return { contributions };
}

async function computeConvergence(cycleId: string): Promise<number> {
  const recentCycles = await db.select()
    .from(swarm_training_cycles)
    .orderBy(desc(swarm_training_cycles.cycleNumber))
    .limit(10);

  if (recentCycles.length < 2) return 0.5;

  const scores = recentCycles.map(c => c.convergenceScore);
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
  const stability = 1 - Math.min(Math.sqrt(variance), 1);

  return Math.min(avgScore * 0.7 + stability * 0.3, 0.99);
}

export async function runSwarmTrainingCycle(): Promise<object> {
  if (engineState.isRunning) {
    return { status: "already_running", message: "A swarm training cycle is already in progress" };
  }

  engineState.isRunning = true;
  const startTime = Date.now();
  engineState.cycleCount++;

  const cycleId = generateId("stc");

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} SWARM TRAINING CYCLE #${engineState.cycleCount} — REAL DATA MEASUREMENT`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  const [cycle] = await db.insert(swarm_training_cycles).values({
    cycleId,
    cycleNumber: engineState.cycleCount,
    status: "running",
    phase: "measurement",
    dimensionsProcessed: [],
    metadata: { startTime },
  }).returning();

  console.log(`${LOG_PREFIX} [Phase 1] KNOWLEDGE MEASUREMENT — Real DB state`);
  await db.update(swarm_training_cycles).set({ phase: "measurement" }).where(eq(swarm_training_cycles.cycleId, cycleId));
  const knowledgeState = await measureRealKnowledgeState();
  console.log(`${LOG_PREFIX} [Phase 1] Total: ${knowledgeState.totalNodes} | Real: ${knowledgeState.realNodes} | Insights: ${knowledgeState.insightNodes} | Domains: ${knowledgeState.domainCount}`);

  console.log(`${LOG_PREFIX} [Phase 2] AGENT ASSESSMENT — 27 agents measuring domain coverage`);
  await db.update(swarm_training_cycles).set({ phase: "assessment" }).where(eq(swarm_training_cycles.cycleId, cycleId));
  const { contributions } = await recordAgentContributions(cycleId, knowledgeState);
  console.log(`${LOG_PREFIX} [Phase 2] ${contributions}/27 agents found knowledge in their domain`);

  console.log(`${LOG_PREFIX} [Phase 3] CONVERGENCE — Computing from historical cycles`);
  await db.update(swarm_training_cycles).set({ phase: "convergence" }).where(eq(swarm_training_cycles.cycleId, cycleId));

  const knowledgeScore = Math.min(1, knowledgeState.totalNodes / 10000);
  const domainScore = Math.min(1, knowledgeState.domainCount / 69);
  const agentScore = contributions / 27;
  const rawConvergence = (knowledgeScore * 0.4 + domainScore * 0.3 + agentScore * 0.3);
  const historicalConvergence = await computeConvergence(cycleId);
  const convergenceScore = engineState.cycleCount > 2
    ? historicalConvergence * 0.6 + rawConvergence * 0.4
    : rawConvergence;

  const latencyMs = Date.now() - startTime;

  await db.update(swarm_training_cycles).set({
    status: "completed",
    phase: "completed",
    knowledgeAbsorbed: knowledgeState.totalNodes,
    agentsParticipated: 27,
    votesReceived: 27,
    votesApproved: contributions,
    convergenceScore,
    reinforcementSignals: [],
    crossDimensionalInsights: [{
      totalNodes: knowledgeState.totalNodes,
      realNodes: knowledgeState.realNodes,
      insightNodes: knowledgeState.insightNodes,
      domainCount: knowledgeState.domainCount,
      recentNodes: knowledgeState.recentNodes,
    }],
    latencyMs,
    completedAt: new Date(),
    metadata: {
      startTime,
      endTime: Date.now(),
      knowledgeState,
      contributions,
    },
  }).where(eq(swarm_training_cycles.cycleId, cycleId));

  engineState.totalKnowledgeAbsorbed = knowledgeState.totalNodes;
  engineState.convergenceRate = convergenceScore;
  engineState.lastCycleTime = latencyMs;
  engineState.isRunning = false;

  await updateSwarmMetrics();

  recordEngineEvent("swarm_training", "training_cycle", convergenceScore > 0.3, latencyMs, {
    cycleNumber: engineState.cycleCount,
    totalNodes: knowledgeState.totalNodes,
    agentCoverage: contributions,
    convergenceScore,
  });

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} CYCLE #${engineState.cycleCount} COMPLETE`);
  console.log(`${LOG_PREFIX} Knowledge: ${knowledgeState.totalNodes} total | ${knowledgeState.recentNodes} recent`);
  console.log(`${LOG_PREFIX} Agent coverage: ${contributions}/27 | Convergence: ${(convergenceScore * 100).toFixed(1)}%`);
  console.log(`${LOG_PREFIX} Duration: ${latencyMs}ms`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  return {
    cycleId,
    cycleNumber: engineState.cycleCount,
    knowledgeState,
    agentContributions: contributions,
    convergenceScore,
    latencyMs,
  };
}

async function updateSwarmMetrics(): Promise<void> {
  const totalCycles = await db.select({ count: count() }).from(swarm_training_cycles);
  const totalVotes = await db.select({ count: count() }).from(swarm_votes);
  const totalKnowledge = await db.select({ count: count() }).from(knowledge_graph);

  const metricsUpdates = [
    { metricName: "Swarm Convergence Rate", currentValue: engineState.convergenceRate * 100 },
    { metricName: "Training Loop Continuity", currentValue: Math.min((totalCycles[0]?.count || 0) * 10, 99.99) },
    { metricName: "Governance Proposals Processed", currentValue: totalVotes[0]?.count || 0 },
    { metricName: "Cross-Node Latency", currentValue: engineState.lastCycleTime },
  ];

  for (const update of metricsUpdates) {
    await db.update(sovereignty_metrics)
      .set({ currentValue: update.currentValue, status: "active", updatedAt: new Date() })
      .where(
        sql`${sovereignty_metrics.phaseNumber} = 7 AND ${sovereignty_metrics.metricName} = ${update.metricName}`
      );
  }
}

export async function getSwarmTrainingStatus(): Promise<object> {
  const recentCycles = await db.select()
    .from(swarm_training_cycles)
    .orderBy(desc(swarm_training_cycles.cycleNumber))
    .limit(20);

  const totalCycles = await db.select({ count: count() }).from(swarm_training_cycles);
  const totalVotes = await db.select({ count: count() }).from(swarm_votes);
  const nodes = await db.select().from(swarm_nodes);

  return {
    engineState: {
      ...engineState,
      activeNodes: nodes.filter(n => n.status === "online").length,
    },
    totalCycles: totalCycles[0]?.count || 0,
    totalVotes: totalVotes[0]?.count || 0,
    recentCycles,
    nodes,
    permanentLoopActive: cycleTimer !== null,
  };
}

export async function getSwarmVotes(cycleId?: string, limit = 50): Promise<object[]> {
  if (cycleId) {
    return db.select().from(swarm_votes).where(eq(swarm_votes.cycleId, cycleId)).orderBy(desc(swarm_votes.createdAt)).limit(limit);
  }
  return db.select().from(swarm_votes).orderBy(desc(swarm_votes.createdAt)).limit(limit);
}

export function startPermanentTrainingLoop(intervalMs = 600000): void {
  if (cycleTimer) {
    console.log(`${LOG_PREFIX} Permanent training loop already active`);
    return;
  }

  console.log(`${LOG_PREFIX} Starting PERMANENT training loop — interval: ${intervalMs / 1000}s`);
  cycleTimer = setInterval(async () => {
    try {
      await runSwarmTrainingCycle();
    } catch (err) {
      console.error(`${LOG_PREFIX} Training cycle error:`, err instanceof Error ? err.message : String(err));
      engineState.isRunning = false;
    }
  }, intervalMs);

  setTimeout(() => runSwarmTrainingCycle().catch(console.error), 5000);
}

export function stopPermanentTrainingLoop(): void {
  if (cycleTimer) {
    clearInterval(cycleTimer);
    cycleTimer = null;
    console.log(`${LOG_PREFIX} Permanent training loop stopped`);
  }
}

export async function initializeSwarmTraining(): Promise<void> {
  console.log(`${LOG_PREFIX} Initializing Swarm Training Engine`);

  const existingCycles = await db.select({ count: count() }).from(swarm_training_cycles);
  engineState.cycleCount = existingCycles[0]?.count || 0;

  const nodes = await db.select().from(swarm_nodes);
  engineState.activeNodes = nodes.filter(n => n.status === "online").length;

  if (engineState.cycleCount > 0) {
    const lastCycle = await db.select()
      .from(swarm_training_cycles)
      .orderBy(desc(swarm_training_cycles.cycleNumber))
      .limit(1);
    if (lastCycle[0]) {
      engineState.convergenceRate = lastCycle[0].convergenceScore;
      engineState.totalKnowledgeAbsorbed = lastCycle[0].knowledgeAbsorbed;
    }
  }

  startPermanentTrainingLoop();
  console.log(`${LOG_PREFIX} Swarm Training Engine initialized — ${engineState.cycleCount} previous cycles, ${engineState.activeNodes} active nodes`);
}
