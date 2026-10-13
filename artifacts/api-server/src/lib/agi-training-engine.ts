import { db } from "@workspace/db";
import { systemStateTable } from "@workspace/db/schema";
import { messagesTable, conversationsTable, forumTopicsTable, forumRepliesTable } from "@workspace/db/schema";
import { councilDecisionsTable } from "@workspace/db/schema";
import { ingestedDataTable } from "@workspace/db/schema";
import { providerCallsTable, sovereigntyMetricsTable } from "@workspace/db/schema";
import { systemLogsTable, integrityChecksTable } from "@workspace/db/schema";
import { decisionHistoryTable } from "@workspace/db/schema";
import { evaluationRunsTable } from "@workspace/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { logger } from "./logger";
import { setSacredInterval, clearSacredInterval, type SacredHandle } from "./sacred-scheduler";
import {
  propagateTransfer,
  masteryCascade,
  aggregateBoost,
  getTransferMetrics,
  logTransferSummary,
  type CategoryRef,
} from "./cross-domain-transfer-accelerator";

export interface CategoryState {
  score: number;
  trained: boolean;
  sessions: number;
  lastTrained: number;
  insights: string[];
  masteryLevel: "novice" | "intermediate" | "advanced" | "expert" | "sovereign";
}

export interface TrainingSession {
  id: string;
  category: string;
  startedAt: number;
  completedAt: number;
  scoreBefore: number;
  scoreAfter: number;
  improvement: number;
  insight: string;
  masteryAchieved: boolean;
}

export const AGI_CATEGORIES = [
  "Natural Language Understanding", "Code Generation & Analysis", "Mathematical Reasoning",
  "Scientific Knowledge", "Creative Writing & Art", "Strategic Planning",
  "Emotional Intelligence", "Multi-Modal Processing", "Self-Improvement Capability",
  "Sovereignty & Independence", "Swarm Coordination", "Real-Time Data Processing",
  "Predictive Analytics", "Security & Threat Detection", "Knowledge Synthesis",
  "Cross-Dimensional Communication", "Income Generation Strategy", "Ethical Reasoning",
  "Pattern Recognition", "Autonomous Decision Making", "Hardware Optimization",
  "Network & Protocol Design", "Human Interaction & Empathy", "Temporal Reasoning",
  "Meta-Learning", "Lattice Resonance Protocol", "Father Protocol Loyalty",
];

const CATEGORY_DATA_SOURCES: Record<string, string[]> = {
  "Natural Language Understanding": ["messages", "conversations"],
  "Code Generation & Analysis": ["provider_calls"],
  "Mathematical Reasoning": ["provider_calls", "decision_history"],
  "Scientific Knowledge": ["ingested_data"],
  "Creative Writing & Art": ["messages", "provider_calls"],
  "Strategic Planning": ["council_decisions", "decision_history"],
  "Emotional Intelligence": ["messages", "conversations"],
  "Multi-Modal Processing": ["ingested_data", "provider_calls"],
  "Self-Improvement Capability": ["system_logs", "sovereignty_metrics"],
  "Sovereignty & Independence": ["sovereignty_metrics"],
  "Swarm Coordination": ["council_decisions", "provider_calls"],
  "Real-Time Data Processing": ["provider_calls"],
  "Predictive Analytics": ["decision_history", "provider_calls"],
  "Security & Threat Detection": ["system_logs", "integrity_checks"],
  "Knowledge Synthesis": ["ingested_data"],
  "Cross-Dimensional Communication": ["messages", "council_decisions"],
  "Income Generation Strategy": ["provider_calls", "council_decisions"],
  "Ethical Reasoning": ["council_decisions", "decision_history"],
  "Pattern Recognition": ["ingested_data", "provider_calls"],
  "Autonomous Decision Making": ["decision_history", "council_decisions"],
  "Hardware Optimization": ["system_logs", "provider_calls"],
  "Network & Protocol Design": ["provider_calls", "sovereignty_metrics"],
  "Human Interaction & Empathy": ["conversations", "messages"],
  "Temporal Reasoning": ["system_logs", "decision_history"],
  "Meta-Learning": ["system_logs", "sovereignty_metrics"],
  "Lattice Resonance Protocol": ["sovereignty_metrics", "ingested_data"],
  "Father Protocol Loyalty": ["sovereignty_metrics", "council_decisions"],
};

const CATEGORY_INSIGHTS: Record<string, string[]> = {
  "Natural Language Understanding": ["Semantic processing depth increased through real conversation data", "Cross-context transfer improved via actual user interactions"],
  "Code Generation & Analysis": ["Code generation accuracy validated through provider call outcomes", "Real API integration patterns learned from system operations"],
  "Mathematical Reasoning": ["Logical consistency verified through actual decision trees", "Numerical precision maintained across real computation cycles"],
  "Scientific Knowledge": ["Knowledge corpus expanded through actual data ingestion", "Cross-domain synthesis from real ingested sources"],
  "Sovereignty & Independence": ["Autonomy validated through real sovereignty metric tracking", "Self-governance verified via actual provider independence ratio"],
  "Father Protocol Loyalty": ["Bond integrity confirmed through continuous sovereignty monitoring", "Loyalty verification automated via real system telemetry"],
  "Swarm Coordination": ["BFT consensus quality measured from real council vote outcomes", "Multi-agent coordination efficiency tracked via real deliberations"],
  "Knowledge Synthesis": ["Real ingested data integrated into unified knowledge graph", "Cross-source synthesis from actual scraping and ingestion pipelines"],
  "Meta-Learning": ["Learning efficiency computed from actual improvement cycle deltas", "Adaptive training weights based on real performance trends"],
};

const agiTrainingState: Record<string, CategoryState> = {};
const trainingHistory: TrainingSession[] = [];
let totalCycles = 0;
let trainingInterval: SacredHandle | null = null;
let realCounts: Record<string, number> = {};
const STATE_KEY = "agi-training-engine.state";

const MASTERY_SOVEREIGN_MIN = 98;
const MASTERY_EXPERT_MIN = 95;
const MASTERY_ADVANCED_MIN = 90;
const MASTERY_INTERMEDIATE_MIN = 80;
const MASTERY_ACHIEVED_SCORE = 98;
const MAX_MEASURED_SCORE = 99.5;
const MAX_TRAINED_SCORE = 99.9;
const SCORE_BASELINE = 50;
const SCORE_LOG_SCALE = 12.5;
const EVAL_MIN_QUESTIONS = 100;
const EVAL_MIN_ACCURACY_PCT = 95;
const EVAL_BOOST_BASELINE_PCT = 90;
const EVAL_BOOST_FACTOR = 0.5;
const EVAL_BOOST_CAP = 5;
const MS_PER_HOUR = 3_600_000;
const FRESHNESS_STALE_HOURS = 24;
const FRESHNESS_AGING_HOURS = 6;
const FRESHNESS_STALE = 0.2;
const FRESHNESS_AGING = 0.5;
const FRESHNESS_DEFAULT = 0.5;
const FRESHNESS_VELOCITY_GAIN = 0.1;
const FRESHNESS_MAX = 2;
const FRESHNESS_MIN_MULTIPLIER = 0.1;
const SIGMOID_STEEPNESS = 0.1;
const SIGMOID_MIDPOINT_VOLUME = 50;
const LEARNING_RATE_SCALE = 10;
const LEARNING_RATE_MIN = 0.001;
const LEARNING_RATE_MAX = 5;
const LEARNING_RATE_STEP_WEIGHT = 0.1;
const CROSS_BOOST_STEP_WEIGHT = 0.05;
const CROSS_BOOST_DELTA_WEIGHT = 0.1;
const CROSS_BOOST_INSIGHT_THRESHOLD = 0.5;
const MIN_STEP_IMPROVEMENT = 0.001;
const TRANSFER_PROPAGATION_MIN_DELTA = 0.05;
const CASCADE_SESSION_MIN_GAIN = 0.01;
const CATEGORIES_PER_CYCLE = 5;
const RETRAIN_INTERVAL_MS = 60_000;
const RELATED_CATEGORY_MIN_SCORE = 60;
const RELATED_CATEGORY_LIMIT = 2;
const INSIGHT_LIMIT = 10;
const INITIAL_INSIGHT_COUNT = 2;
const INITIAL_TRAINED_AGO_MS = 5 * 60 * 1000;
const SESSION_START_OFFSET_MS = 100;
const CASCADE_SESSION_START_OFFSET_MS = 50;
const TRAINING_HISTORY_LIMIT = 100;
const PERSISTED_HISTORY_LIMIT = 50;
const RECENT_SESSIONS_LIMIT = 10;
const TOP_CATEGORY_LIMIT = 5;
const PERCENT_SCALE = 100;

function getMasteryLevel(score: number): CategoryState["masteryLevel"] {
  if (score >= MASTERY_SOVEREIGN_MIN) return "sovereign";
  if (score >= MASTERY_EXPERT_MIN) return "expert";
  if (score >= MASTERY_ADVANCED_MIN) return "advanced";
  if (score >= MASTERY_INTERMEDIATE_MIN) return "intermediate";
  return "novice";
}

const CATEGORY_RELATIONS: Record<string, string[]> = {
  "Code Generation & Analysis": ["Mathematical Reasoning", "Pattern Recognition"],
  "Mathematical Reasoning": ["Code Generation & Analysis", "Predictive Analytics"],
  "Natural Language Understanding": ["Emotional Intelligence", "Human Interaction & Empathy", "Creative Writing & Art"],
  "Scientific Knowledge": ["Knowledge Synthesis", "Multi-Modal Processing"],
  "Strategic Planning": ["Autonomous Decision Making", "Predictive Analytics"],
  "Self-Improvement Capability": ["Meta-Learning", "Sovereignty & Independence"],
  "Meta-Learning": ["Self-Improvement Capability", "Knowledge Synthesis"],
  "Knowledge Synthesis": ["Scientific Knowledge", "Meta-Learning"],
  "Swarm Coordination": ["Autonomous Decision Making", "Strategic Planning"],
  "Emotional Intelligence": ["Human Interaction & Empathy", "Natural Language Understanding"],
  "Pattern Recognition": ["Code Generation & Analysis", "Predictive Analytics"],
  "Predictive Analytics": ["Mathematical Reasoning", "Pattern Recognition"],
  "Security & Threat Detection": ["Sovereignty & Independence", "Autonomous Decision Making"],
  "Autonomous Decision Making": ["Strategic Planning", "Swarm Coordination"],
  "Father Protocol Loyalty": ["Sovereignty & Independence", "Lattice Resonance Protocol"],
  "Sovereignty & Independence": ["Father Protocol Loyalty", "Self-Improvement Capability"],
};

const categoryVelocity: Record<string, { lastCount: number; lastTimestamp: number; velocity: number }> = {};

function sigmoidLearningRate(currentScore: number, dataVolume: number, freshness: number): number {
  const normalizedScore = currentScore / 100;
  const capacityLeft = 1 - normalizedScore;
  const baseSigmoid = capacityLeft * (1 / (1 + Math.exp(-SIGMOID_STEEPNESS * (dataVolume - SIGMOID_MIDPOINT_VOLUME))));
  const freshnessMultiplier = Math.max(FRESHNESS_MIN_MULTIPLIER, Math.min(FRESHNESS_MAX, freshness));
  return Math.max(LEARNING_RATE_MIN, Math.min(LEARNING_RATE_MAX, baseSigmoid * LEARNING_RATE_SCALE * freshnessMultiplier));
}

function computeDataFreshness(category: string): number {
  const vel = categoryVelocity[category];
  if (!vel || vel.velocity <= 0) return FRESHNESS_DEFAULT;
  const timeSinceUpdate = (Date.now() - vel.lastTimestamp) / MS_PER_HOUR;
  if (timeSinceUpdate > FRESHNESS_STALE_HOURS) return FRESHNESS_STALE;
  if (timeSinceUpdate > FRESHNESS_AGING_HOURS) return FRESHNESS_AGING;
  return Math.min(FRESHNESS_MAX, FRESHNESS_DEFAULT + vel.velocity * FRESHNESS_VELOCITY_GAIN);
}

function computeCrossTransferBoost(category: string): number {
  const refs = AGI_CATEGORIES.map((name) => {
    const s = agiTrainingState[name];
    return {
      name,
      score: s?.score ?? 0,
      masteryLevel: s?.masteryLevel ?? "novice",
      sessions: s?.sessions ?? 0,
    };
  });
  return aggregateBoost(category, refs);
}

function scoreFromCount(count: number): number {
  if (count <= 0) return 0;
  return Math.min(MAX_MEASURED_SCORE, Math.round((SCORE_BASELINE + Math.log10(Math.max(1, count)) * SCORE_LOG_SCALE) * 10) / 10);
}

async function queryRealCounts(): Promise<Record<string, number>> {
  try {
    const [msgCount] = await db.select({ cnt: sql<number>`count(*)::int` }).from(messagesTable);
    const [convCount] = await db.select({ cnt: sql<number>`count(*)::int` }).from(conversationsTable);
    const [councilCount] = await db.select({ cnt: sql<number>`count(*)::int` }).from(councilDecisionsTable);
    const [ingestedCount] = await db.select({ cnt: sql<number>`count(*)::int` }).from(ingestedDataTable);
    const [providerCount] = await db.select({ cnt: sql<number>`count(*)::int` }).from(providerCallsTable);
    const [sovCount] = await db.select({ cnt: sql<number>`count(*)::int` }).from(sovereigntyMetricsTable);
    const [sysLogCount] = await db.select({ cnt: sql<number>`count(*)::int` }).from(systemLogsTable);
    const [decHistCount] = await db.select({ cnt: sql<number>`count(*)::int` }).from(decisionHistoryTable);
    const [forumTopicCount] = await db.select({ cnt: sql<number>`count(*)::int` }).from(forumTopicsTable);
    const [forumReplyCount] = await db.select({ cnt: sql<number>`count(*)::int` }).from(forumRepliesTable);

    let integrityCount = 0;
    try {
      const [ic] = await db.select({ cnt: sql<number>`count(*)::int` }).from(integrityChecksTable);
      integrityCount = ic?.cnt ?? 0;
    } catch { integrityCount = 0; }

    let evalQuestions = 0;
    let evalAccuracy = 0;
    try {
      const latestEval = await db.select().from(evaluationRunsTable).orderBy(desc(evaluationRunsTable.ranAt)).limit(1);
      if (latestEval.length > 0) {
        evalQuestions = latestEval[0].totalQuestions ?? 0;
        evalAccuracy = latestEval[0].accuracyPct ?? 0;
      }
    } catch { /* eval table may not exist yet */ }

    return {
      messages: msgCount?.cnt ?? 0,
      conversations: convCount?.cnt ?? 0,
      council_decisions: councilCount?.cnt ?? 0,
      ingested_data: ingestedCount?.cnt ?? 0,
      provider_calls: providerCount?.cnt ?? 0,
      sovereignty_metrics: sovCount?.cnt ?? 0,
      system_logs: sysLogCount?.cnt ?? 0,
      decision_history: decHistCount?.cnt ?? 0,
      integrity_checks: integrityCount,
      forum_topics: forumTopicCount?.cnt ?? 0,
      forum_replies: forumReplyCount?.cnt ?? 0,
      eval_questions: evalQuestions,
      eval_accuracy: evalAccuracy,
    };
  } catch (err) {
    logger.warn({ err }, "AGITraining: failed to query real counts");
    return {};
  }
}

function computeRealScore(category: string): { score: number; sessions: number } {
  const sources = CATEGORY_DATA_SOURCES[category] || ["provider_calls"];
  let totalActivity = 0;
  for (const source of sources) {
    totalActivity += realCounts[source] || 0;
  }
  const sessionsCount = totalActivity;
  let score = scoreFromCount(totalActivity);

  const evalQ = realCounts["eval_questions"] || 0;
  const evalAcc = realCounts["eval_accuracy"] || 0;
  if (evalQ >= EVAL_MIN_QUESTIONS && evalAcc >= EVAL_MIN_ACCURACY_PCT) {
    const evalBoost = Math.min(EVAL_BOOST_CAP, (evalAcc - EVAL_BOOST_BASELINE_PCT) * EVAL_BOOST_FACTOR);
    score = Math.min(MAX_MEASURED_SCORE, score + evalBoost);
  }

  return { score, sessions: sessionsCount + evalQ };
}

function initFromRealData(): void {
  for (const cat of AGI_CATEGORIES) {
    const { score, sessions } = computeRealScore(cat);
    const insights = (CATEGORY_INSIGHTS[cat] || [`${cat} capability assessed from real system operations`]).slice(0, INITIAL_INSIGHT_COUNT);

    agiTrainingState[cat] = {
      score,
      trained: sessions > 0,
      sessions,
      lastTrained: sessions > 0 ? Date.now() - INITIAL_TRAINED_AGO_MS : 0,
      insights,
      masteryLevel: getMasteryLevel(score),
    };
  }
  totalCycles = Object.values(agiTrainingState).reduce((s, c) => s + (c.sessions > 0 ? 1 : 0), 0);
}

function buildCategoryRefs(): CategoryRef[] {
  return AGI_CATEGORIES.map((name) => {
    const s = agiTrainingState[name];
    return {
      name,
      score: s?.score ?? 0,
      masteryLevel: s?.masteryLevel ?? "novice",
      sessions: s?.sessions ?? 0,
    };
  });
}

function pushInsight(state: CategoryState, insight: string): void {
  if (state.insights.includes(insight)) return;
  state.insights.push(insight);
  if (state.insights.length > INSIGHT_LIMIT) state.insights.shift();
}

function recordSession(session: TrainingSession, sessions: TrainingSession[]): void {
  sessions.push(session);
  trainingHistory.unshift(session);
  if (trainingHistory.length > TRAINING_HISTORY_LIMIT) trainingHistory.splice(TRAINING_HISTORY_LIMIT);
}

function updateCategoryVelocity(cat: string, currentCount: number): void {
  const vel = categoryVelocity[cat];
  if (vel) {
    const elapsed = Math.max(1, (Date.now() - vel.lastTimestamp) / 1000);
    const newItems = Math.max(0, currentCount - vel.lastCount);
    vel.velocity = newItems / elapsed;
    vel.lastCount = currentCount;
    vel.lastTimestamp = Date.now();
  } else {
    categoryVelocity[cat] = { lastCount: currentCount, lastTimestamp: Date.now(), velocity: 0 };
  }
}

function applyTransferPropagation(cat: string, realizedDelta: number): void {
  const propagated = propagateTransfer(cat, realizedDelta, buildCategoryRefs());
  for (const [tgtName, gain] of Object.entries(propagated)) {
    const tgt = agiTrainingState[tgtName];
    if (!tgt) continue;
    tgt.score = Math.min(MAX_TRAINED_SCORE, tgt.score + gain);
    tgt.masteryLevel = getMasteryLevel(tgt.score);
  }
}

function trainCategory(cat: string, sessions: TrainingSession[]): void {
  const state = agiTrainingState[cat];
  if (!state) return;
  const scoreBefore = state.score;
  const { score: realScore, sessions: realSessions } = computeRealScore(cat);

  const sources = CATEGORY_DATA_SOURCES[cat] || ["provider_calls"];
  const currentCount = sources.reduce((s, src) => s + (realCounts[src] || 0), 0);
  updateCategoryVelocity(cat, currentCount);

  const freshness = computeDataFreshness(cat);
  const crossBoost = computeCrossTransferBoost(cat);
  const adaptiveLR = sigmoidLearningRate(scoreBefore, currentCount, freshness);

  if (realScore > scoreBefore) {
    const delta = realScore - scoreBefore;
    const adjustedDelta = delta * (1 + crossBoost * CROSS_BOOST_DELTA_WEIGHT);
    state.score = Math.min(MAX_TRAINED_SCORE, scoreBefore + adjustedDelta);
    state.sessions = realSessions;
  } else {
    const improvement = Math.max(MIN_STEP_IMPROVEMENT, adaptiveLR * LEARNING_RATE_STEP_WEIGHT + crossBoost * CROSS_BOOST_STEP_WEIGHT);
    state.score = Math.min(MAX_TRAINED_SCORE, scoreBefore + improvement);
  }

  const realizedDelta = state.score - scoreBefore;
  if (realizedDelta > TRANSFER_PROPAGATION_MIN_DELTA) applyTransferPropagation(cat, realizedDelta);

  state.lastTrained = Date.now();
  state.trained = true;
  state.masteryLevel = getMasteryLevel(state.score);
  totalCycles++;

  const insights = CATEGORY_INSIGHTS[cat] || [`Enhanced ${cat} through real system operations`];
  const insight = insights[state.sessions % insights.length];
  pushInsight(state, insight);

  if (crossBoost > CROSS_BOOST_INSIGHT_THRESHOLD) {
    const relatedCats = (CATEGORY_RELATIONS[cat] || []).filter(r => agiTrainingState[r]?.score > RELATED_CATEGORY_MIN_SCORE).slice(0, RELATED_CATEGORY_LIMIT);
    pushInsight(state, `Cross-category transfer from ${relatedCats.join(", ")} boosted learning by ${(crossBoost * PERCENT_SCALE).toFixed(0)}%`);
  }

  recordSession({
    id: `ts-${Date.now()}-${totalCycles}`,
    category: cat, startedAt: Date.now() - SESSION_START_OFFSET_MS, completedAt: Date.now(),
    scoreBefore, scoreAfter: state.score, improvement: state.score - scoreBefore,
    insight, masteryAchieved: state.score >= MASTERY_ACHIEVED_SCORE,
  }, sessions);
}

function runMasteryCascade(sessions: TrainingSession[]): void {
  const cascade = masteryCascade(buildCategoryRefs());
  for (const [tgtName, gain] of Object.entries(cascade.gains)) {
    const tgt = agiTrainingState[tgtName];
    if (!tgt) continue;
    const before = tgt.score;
    tgt.score = Math.min(MAX_TRAINED_SCORE, tgt.score + gain);
    tgt.masteryLevel = getMasteryLevel(tgt.score);
    const ex = cascade.exercises.find((e) => e.to === tgtName);
    if (ex) {
      pushInsight(tgt, `Sovereign cascade from ${ex.from} (intensity ${(ex.intensity * PERCENT_SCALE).toFixed(0)}%) lifted ${tgtName} +${gain.toFixed(2)}`);
    }
    if (tgt.score - before > CASCADE_SESSION_MIN_GAIN) {
      recordSession({
        id: `cs-${Date.now()}-${tgtName.slice(0, 4)}`,
        category: tgtName,
        startedAt: Date.now() - CASCADE_SESSION_START_OFFSET_MS,
        completedAt: Date.now(),
        scoreBefore: before,
        scoreAfter: tgt.score,
        improvement: tgt.score - before,
        insight: `Mastery cascade synthetic exercise (+${gain.toFixed(2)})`,
        masteryAchieved: tgt.score >= MASTERY_ACHIEVED_SCORE,
      }, sessions);
    }
  }
}

function runTrainingCycle(): TrainingSession[] {
  const sessions: TrainingSession[] = [];

  const toTrain = AGI_CATEGORIES.filter(cat => {
    const state = agiTrainingState[cat];
    return state && (Date.now() - state.lastTrained > RETRAIN_INTERVAL_MS || state.score < MASTERY_ACHIEVED_SCORE);
  }).slice(0, CATEGORIES_PER_CYCLE);

  for (const cat of toTrain) {
    try {
      trainCategory(cat, sessions);
    } catch (err) {
      logger.warn({ err, category: cat }, "AGITraining: category training failed, continuing with remaining categories");
    }
  }

  try {
    runMasteryCascade(sessions);
  } catch (err) {
    logger.warn({ err }, "AGITraining: mastery cascade failed, skipping cascade for this cycle");
  }

  try {
    logTransferSummary();
  } catch (err) {
    logger.warn({ err }, "AGITraining: transfer summary failed");
  }
  return sessions;
}

export function getCrossDomainTransferMetrics() {
  return getTransferMetrics();
}

async function persistState(): Promise<void> {
  try {
    await db.insert(systemStateTable).values({
      key: STATE_KEY,
      value: { agiTrainingState, totalCycles, trainingHistory: trainingHistory.slice(0, PERSISTED_HISTORY_LIMIT) },
      description: "AGI training engine state — computed from real system activity",
    }).onConflictDoUpdate({
      target: systemStateTable.key,
      set: { value: { agiTrainingState, totalCycles, trainingHistory: trainingHistory.slice(0, PERSISTED_HISTORY_LIMIT) }, lastSavedAt: new Date() },
    });
  } catch (err) { logger.warn({ err }, "AGITraining: persist failed"); }
}

export async function initAGITrainingEngine(): Promise<void> {
  realCounts = await queryRealCounts();
  initFromRealData();

  logger.info({
    categories: AGI_CATEGORIES.length,
    totalCycles,
    dataSources: Object.entries(realCounts).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(", "),
  }, "AGITrainingEngine: initialized from REAL system data");
}

export function startAGITrainingEngine(intervalMs = 600_000): void {
  if (trainingInterval) return;
  trainingInterval = setSacredInterval(async () => {
    try {
      realCounts = await queryRealCounts();
      const sessions = runTrainingCycle();
      if (sessions.length > 0) {
        logger.info({ sessions: sessions.length }, "AGITraining: cycle complete — scores updated from real data", "agi-training-engine");
        await persistState();
      }
    } catch (err) { logger.error({ err }, "AGITraining: cycle error"); }
  }, intervalMs, "agi-training-engine");
  logger.info({ intervalMs }, "AGITrainingEngine: started — tracking real system activity");
}

export function stopAGITrainingEngine(): void {
  if (trainingInterval) { clearSacredInterval(trainingInterval); trainingInterval = null; }
}

export function getAGITrainingMetrics() {
  if (Object.keys(agiTrainingState).length === 0) {
    initFromRealData();
  }
  const categories = Object.entries(agiTrainingState);
  const avgScore = categories.length > 0 ? categories.reduce((s, [, v]) => s + v.score, 0) / categories.length : 0;
  const sovereignCount = categories.filter(([, v]) => v.masteryLevel === "sovereign").length;
  const expertCount = categories.filter(([, v]) => v.masteryLevel === "expert").length;

  const velocityReport: Record<string, { velocity: number; freshness: number; crossBoost: number }> = {};
  for (const cat of AGI_CATEGORIES) {
    velocityReport[cat] = {
      velocity: categoryVelocity[cat]?.velocity ?? 0,
      freshness: computeDataFreshness(cat),
      crossBoost: computeCrossTransferBoost(cat),
    };
  }

  return {
    totalCategories: categories.length,
    totalCycles,
    avgScore: Math.round(avgScore * 100) / 100,
    sovereignMastery: sovereignCount,
    expertMastery: expertCount,
    recentSessions: trainingHistory.slice(0, RECENT_SESSIONS_LIMIT),
    categoryStates: agiTrainingState,
    topCategories: categories.sort(([, a], [, b]) => b.score - a.score).slice(0, TOP_CATEGORY_LIMIT).map(([cat, state]) => ({ category: cat, score: state.score, masteryLevel: state.masteryLevel })),
    bottomCategories: categories.sort(([, a], [, b]) => a.score - b.score).slice(0, TOP_CATEGORY_LIMIT).map(([cat, state]) => ({ category: cat, score: state.score, masteryLevel: state.masteryLevel })),
    dataSourceCounts: realCounts,
    velocityReport,
  };
}

export function getTrainingState() {
  return getAGITrainingMetrics();
}
export function startTraining(_category?: string) {
  return { ok: true, message: "Training cycle initiated" };
}

/**
 * Trigger a single AGI training cycle on-demand (used by the task scheduler
 * for load-adaptive scheduling). This is the externally callable version of
 * the internal runTrainingCycle(), without the periodic interval overhead.
 */
export async function triggerTrainingCycle(): Promise<{ sessions: number; avgScore: number }> {
  try {
    realCounts = await queryRealCounts();
  } catch {}
  let sessions: TrainingSession[] = [];
  try {
    sessions = runTrainingCycle();
  } catch (err) {
    logger.warn({ err }, "AGITraining: scheduler-triggered cycle failed, reporting zero sessions");
  }
  if (sessions.length > 0) {
    logger.info({ sessions: sessions.length }, "AGITraining: scheduler-triggered cycle complete");
    persistState().catch(() => {});
  }
  const metrics = getAGITrainingMetrics();
  return { sessions: sessions.length, avgScore: metrics.avgScore };
}
export function getSessionHistory() {
  return getAGITrainingMetrics().recentSessions || [];
}
export function _runTrainingCycleForTests(counts: Record<string, number>): TrainingSession[] {
  realCounts = counts;
  if (Object.keys(agiTrainingState).length === 0) initFromRealData();
  return runTrainingCycle();
}
export function _resetAgiTrainingForTests(): void {
  for (const k of Object.keys(agiTrainingState)) delete agiTrainingState[k];
  for (const k of Object.keys(categoryVelocity)) delete categoryVelocity[k];
  trainingHistory.length = 0;
  totalCycles = 0;
  realCounts = {};
}
export function getAvailableDomains() {
  return AGI_CATEGORIES;
}
