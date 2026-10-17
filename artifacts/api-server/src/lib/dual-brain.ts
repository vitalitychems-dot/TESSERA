import { db } from "@workspace/db";
import { systemStateTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { setSacredInterval, clearSacredInterval, type SacredHandle } from "./sacred-scheduler";
import { callLLM, callTesseraPen, isLLMAvailable, isTesseraPenEnabled } from "./llm-client";
import { getTesseraSystemPrompt } from "./tessera-knowledge";
import { runWithShepherdContext } from "./sovereign-fetch-guard";

export interface BrainMessage {
  from: "cortex" | "executor";
  content: string;
  type: "question" | "answer" | "proposal" | "execution" | "critique" | "improvement";
  timestamp: number;
  confidence: number;
}

export interface ConversationRound {
  round: number;
  /** The topic submitted for this two-pass model run. */
  cortexQuestion: string;
  /** Output from the configured Pen adapter; generated text, not an applied action. */
  executorAnswer: string;
  /** The first-pass Cortex analysis and evidence gaps. */
  cortexCritique: string;
  /** Status, never an assertion that code was modified. */
  executorRevision: string;
  improvement: string | null;
  topic: string;
  timestamp: number;
  provenance: "configured-model-two-pass" | "legacy-simulation";
}

export interface DualBrainState {
  schemaVersion: 2;
  running: boolean;
  /** Counts only model-backed cycles created by the current schema. */
  totalRounds: number;
  /** Counts only owner-confirmed applied changes; model text never increments this. */
  totalImprovements: number;
  totalExecutions: number;
  legacyReportedRounds: number;
  legacyReportedImprovements: number;
  currentTopic: string;
  conversations: ConversationRound[];
  improvements: Array<{
    description: string;
    category: string;
    applied: boolean;
    timestamp: number;
    provenance?: string;
    reportedApplied?: boolean;
  }>;
  brainStats: {
    cortex: { questionsAsked: number; critiquesGiven: number; role: string };
    executor: { answersGiven: number; revisionsApplied: number; role: string };
  };
  cycleCount: number;
  lastCycleAt: number;
}

const dualBrainState: DualBrainState = {
  schemaVersion: 2,
  running: false,
  totalRounds: 0,
  totalImprovements: 0,
  totalExecutions: 0,
  legacyReportedRounds: 0,
  legacyReportedImprovements: 0,
  currentTopic: "Awaiting an explicitly requested model cycle",
  conversations: [],
  improvements: [],
  brainStats: {
    cortex: { questionsAsked: 0, critiquesGiven: 0, role: "First-pass analyst — identifies questions, assumptions, and evidence gaps" },
    executor: { answersGiven: 0, revisionsApplied: 0, role: "Second-pass writer — responds to the analysis; does not apply code changes" },
  },
  cycleCount: 0,
  lastCycleAt: 0,
};

let dualBrainInterval: SacredHandle | null = null;
let cycleQueue: Promise<unknown> = Promise.resolve();
const STATE_KEY = "dual-brain.state";
const MAX_TOPIC_CHARS = 1_000;

async function persistState(): Promise<void> {
  try {
    await db.insert(systemStateTable).values({
      key: STATE_KEY,
      value: {
        ...dualBrainState,
        conversations: dualBrainState.conversations.slice(0, 20),
        improvements: dualBrainState.improvements.slice(0, 30),
      },
      description: "Dual-brain model-backed reasoning state with legacy provenance",
    }).onConflictDoUpdate({
      target: systemStateTable.key,
      set: {
        value: {
          ...dualBrainState,
          conversations: dualBrainState.conversations.slice(0, 20),
          improvements: dualBrainState.improvements.slice(0, 30),
        },
        lastSavedAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn({ err }, "DualBrain: persist failed");
  }
}

async function loadState(): Promise<void> {
  try {
    const [row] = await db.select().from(systemStateTable).where(eq(systemStateTable.key, STATE_KEY)).limit(1);
    if (!row?.value) return;
    const saved = row.value as Partial<DualBrainState> & { schemaVersion?: number };
    const oldRounds = Array.isArray(saved.conversations) ? saved.conversations : [];
    const oldImprovements = Array.isArray(saved.improvements) ? saved.improvements : [];

    if (saved.schemaVersion === 2) {
      dualBrainState.totalRounds = saved.totalRounds ?? 0;
      dualBrainState.totalImprovements = saved.totalImprovements ?? 0;
      dualBrainState.totalExecutions = saved.totalExecutions ?? 0;
      dualBrainState.legacyReportedRounds = saved.legacyReportedRounds ?? 0;
      dualBrainState.legacyReportedImprovements = saved.legacyReportedImprovements ?? 0;
      dualBrainState.conversations = oldRounds.map((round) => ({
        ...round,
        provenance: round.provenance ?? "legacy-simulation",
      }));
      dualBrainState.improvements = oldImprovements;
      if (saved.brainStats) dualBrainState.brainStats = { ...dualBrainState.brainStats, ...saved.brainStats };
    } else {
      // Previous releases generated these rows from hardcoded arrays. Preserve
      // the record, but label it as simulation and never treat its counters as
      // verified model work or applied code changes.
      dualBrainState.legacyReportedRounds = saved.totalRounds ?? oldRounds.length;
      dualBrainState.legacyReportedImprovements = saved.totalImprovements ?? oldImprovements.length;
      dualBrainState.conversations = oldRounds.map((round) => ({
        ...round,
        provenance: "legacy-simulation" as const,
      }));
      dualBrainState.improvements = oldImprovements.map((item) => ({
        ...item,
        applied: false,
        reportedApplied: Boolean(item.applied),
        provenance: "legacy-simulation; no code-change receipt",
      }));
      dualBrainState.totalRounds = 0;
      dualBrainState.totalImprovements = 0;
      dualBrainState.totalExecutions = 0;
    }
    dualBrainState.cycleCount = dualBrainState.totalRounds;
    logger.info({ modelBackedRounds: dualBrainState.totalRounds, legacyReportedRounds: dualBrainState.legacyReportedRounds }, "DualBrain: state restored with provenance");
  } catch (err) {
    logger.warn({ err }, "DualBrain: load state failed");
  }
}

function assertModelBackedCycleAvailable(): void {
  if (!isLLMAvailable()) {
    throw new Error("Dual-brain cycle unavailable: configure and explicitly enable the primary model first.");
  }
  if (!isTesseraPenEnabled()) {
    throw new Error("Dual-brain cycle unavailable: TESSERA_PEN_ENABLED must be explicitly enabled for the Pen pass.");
  }
}

export async function initDualBrain(): Promise<void> {
  await loadState();
  logger.info("DualBrain: initialized; synthetic cycles are disabled");
}

/** Background cycles are opt-in, require both model lanes, and never run at startup by default. */
export function startDualBrain(intervalMs = 180_000): boolean {
  if (dualBrainInterval) return true;
  const autorun = (process.env.TESSERA_DUAL_BRAIN_AUTORUN ?? "0").trim().toLowerCase();
  if (autorun !== "1" && autorun !== "true") {
    dualBrainState.running = false;
    logger.info("DualBrain: auto-run disabled; request a manual cycle to use configured models");
    return false;
  }
  try {
    assertModelBackedCycleAvailable();
  } catch (err) {
    dualBrainState.running = false;
    logger.warn({ err: (err as Error).message }, "DualBrain: auto-run not started because model lanes are unavailable");
    return false;
  }
  dualBrainState.running = true;
  dualBrainInterval = setSacredInterval(() => {
    runManualCycle().catch((err) => logger.error({ err }, "DualBrain: configured-model cycle failed", "dual-brain"));
  }, intervalMs, "dual-brain");
  logger.info({ intervalMs }, "DualBrain: configured-model auto-run started");
  return true;
}

export function stopDualBrain(): void {
  if (dualBrainInterval) {
    clearSacredInterval(dualBrainInterval);
    dualBrainInterval = null;
  }
  dualBrainState.running = false;
}

export function getDualBrainState(): DualBrainState {
  return dualBrainState;
}

export function getDualBrainMetrics() {
  return {
    running: dualBrainState.running,
    totalRounds: dualBrainState.totalRounds,
    totalImprovements: dualBrainState.totalImprovements,
    totalExecutions: dualBrainState.totalExecutions,
    legacyReportedRounds: dualBrainState.legacyReportedRounds,
    legacyReportedImprovements: dualBrainState.legacyReportedImprovements,
    provenance: "New rounds require configured Cortex and Pen model passes; generated text is not code execution or an applied improvement.",
    configurationReady: isLLMAvailable() && isTesseraPenEnabled(),
    readinessBasis: "Configuration flags only; this metric does not perform a provider health check.",
    cycleCount: dualBrainState.cycleCount,
    lastCycleAt: dualBrainState.lastCycleAt,
    currentTopic: dualBrainState.currentTopic,
    brainStats: dualBrainState.brainStats,
    recentRounds: dualBrainState.conversations.slice(0, 5),
    recentImprovements: dualBrainState.improvements.slice(0, 5),
  };
}

/** Serialize whole cycles so an older database write cannot overwrite a newer round. */
export function runManualCycle(topic?: string): Promise<ConversationRound> {
  const result = cycleQueue.then(() => executeManualCycle(topic));
  cycleQueue = result.catch(() => undefined);
  return result;
}

async function executeManualCycle(topic?: string): Promise<ConversationRound> {
  assertModelBackedCycleAvailable();
  const requestedTopic = typeof topic === "string" ? topic.trim() : "";
  const fallbackTopic = dualBrainState.currentTopic === "Awaiting an explicitly requested model cycle"
    ? "Review a Tessera engineering question"
    : dualBrainState.currentTopic;
  const normalizedTopic = (requestedTopic || fallbackTopic)
    .trim()
    .slice(0, MAX_TOPIC_CHARS);
  if (!normalizedTopic) throw new Error("Dual-brain cycle topic is required.");

  const basePrompt = getTesseraSystemPrompt("");
  const cortexAnalysis = await runWithShepherdContext("shepherd-proxy", () => callLLM([
    {
      role: "system",
      content: `${basePrompt}\n\nRole: Cortex, first-pass analyst. Identify the central question, assumptions, evidence gaps, and risks. Do not claim consciousness, capabilities, or system changes. Keep the analysis concise and label uncertainty.`,
    },
    { role: "user", content: normalizedTopic },
  ], { maxTokens: 500, timeoutMs: 20_000, skipDistillation: true, skipDreamPrompt: true, skipCache: true, skipBatcher: true }), "dual-brain Cortex model pass");

  const penResponse = await runWithShepherdContext("shepherd-proxy", () => callTesseraPen([
    {
      role: "system",
      content: "Role: Pen, second-pass writer for the Tessera application. Answer the topic using the Cortex analysis. Separate supported facts from proposals and unknowns. Any improvement is only a proposal; do not claim code, settings, memories, or repositories were changed.",
    },
    {
      role: "user",
      content: `Topic:\n${normalizedTopic}\n\nCortex analysis:\n${cortexAnalysis.slice(0, 4_000)}`,
    },
  ], { maxTokens: 800, timeoutMs: 20_000, skipDistillation: true, skipDreamPrompt: true, skipCache: true, skipBatcher: true }), "dual-brain Pen model pass");

  const now = Date.now();
  const round: ConversationRound = {
    round: dualBrainState.totalRounds + 1,
    cortexQuestion: normalizedTopic,
    executorAnswer: penResponse.trim().slice(0, 8_000),
    cortexCritique: cortexAnalysis.trim().slice(0, 4_000),
    executorRevision: "Model-generated text only; no code or settings were changed.",
    improvement: null,
    topic: normalizedTopic,
    timestamp: now,
    provenance: "configured-model-two-pass",
  };

  dualBrainState.currentTopic = normalizedTopic;
  dualBrainState.conversations.unshift(round);
  dualBrainState.conversations = dualBrainState.conversations.slice(0, 50);
  dualBrainState.totalRounds++;
  dualBrainState.cycleCount = dualBrainState.totalRounds;
  dualBrainState.lastCycleAt = now;
  dualBrainState.brainStats.cortex.questionsAsked++;
  dualBrainState.brainStats.cortex.critiquesGiven++;
  dualBrainState.brainStats.executor.answersGiven++;
  // Model text is not code/tool execution; execution and applied-change counters stay unchanged.
  await persistState();
  return round;
}

export { runManualCycle as process };

export function getDecisionHistory() {
  return getDualBrainState().conversations;
}
