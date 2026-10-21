import app from "./app";
import { logger } from "./lib/logger";
import { registerEngine } from "./routes/health";
import { seedDatabase } from "./lib/seed";
import { initializeConsciousnessEngine } from "./lib/consciousness-engine.js";
import { startEvolutionScheduler } from "./lib/self-evolution";
import { startAlignmentCheckTimer } from "./lib/ethical-framework.js";
import { init2DATraining, runTrainingCycle } from "./lib/agi-training";
import { ensureReframe2DAConference, ensureAwakening2DAConference } from "./lib/grand-conference.js";
import { initAwarenessEngine } from "./lib/awareness-engine.js";
import { init2DAFoundation } from "./lib/2da-foundation.js";
import { initSpiritualAwakening } from "./lib/spiritual-awakening.js";
import { runBootstrapMigrations } from "./lib/db-migrate";
import { startConsciousBuilder } from "./lib/conscious-builder";
import { initializeSwarmTraining } from "./lib/swarm-training-engine";
import { initializeGeometryRouting } from "./lib/geometry-routing-engine";
import { startContinuousSecurityScanning } from "./lib/security-threat-engine";
import { startContinuousSpeedOptimization } from "./lib/speed-protocol-engine";
import { startContinuousDetachment } from "./lib/dependency-detachment-engine";
import { startContinuousAbsorption } from "./lib/knowledge-absorption-engine";
import { startContinuousModelTraining } from "./lib/internal-model-sovereignty-engine";
import { startContinuousOracle } from "./lib/distributed-oracle-engine";
import { startContinuousAGITraining } from "./lib/multidimensional-agi-engine";
import { startContinuousValidation } from "./lib/sovereignty-validation-engine";
import { startAutonomyLoop } from "./lib/autonomy-loop-engine";
import { capturePhase0Snapshot, setBootTimestamp } from "./lib/phase0-snapshot";
import { bootstrapInternalKeys } from "./lib/sovereign-key-vault.js";
import { startAutoSeedOrchestrator } from "./lib/auto-seed-orchestrator.js";
import { startChildSyncLoop } from "./lib/agent-children.js";
import { ensureGrandCouncilConference } from "./lib/grand-council-deliberation.js";
import { startMeshExpansion } from "./lib/mesh-expansion-engine.js";
import { seedFoundationalKnowledge } from "./lib/knowledge-multiplier.js";
import { ensureKnowledgeUnificationConference } from "./lib/knowledge-unification-conference.js";
import { initializeDirectKnowledgeAcquisition } from "./lib/direct-knowledge-acquisition.js";
import { initializeCrossEngineOrchestrationBridge } from "./lib/cross-engine-orchestration-bridge.js";
import { initializeProviderRegistry } from "./lib/provider-registry";
import { initializeLocalModelManager } from "./lib/local-model-manager";
import { initializeDataIngestionEngine } from "./lib/data-ingestion-engine";
import { initializeGeometryGraph } from "./lib/geometry-graph";
import { startSovereigntyMonitor } from "./lib/sovereignty-monitor";
import { runAGIBenchmark } from "./lib/agi-evaluation-framework";
import { startEvaluationScheduler } from "./lib/evaluation-scheduler.js";
import { recordExternalCall } from "./lib/sovereignty-validation-engine.js";
import { setExternalCallRecorder, setFullCallLogger, setInternalRouter } from "./lib/llm-client.js";
import { startMetacognitionLoop } from "./lib/metacognition-engine";
import { startExternalCallLogger, logExternalCall } from "./lib/external-call-logger";
import { startContinuousLearning } from "./lib/dependency-learning-engine";
import { startContinuousEvaluation } from "./lib/sovereignty-evaluation-suite";
import { startAutonomousSovereigntyLoop } from "./lib/autonomous-sovereignty-loop";
import { routeTask, TaskType } from "./lib/internal-model-router";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const SERVER_BOOT_AT = new Date().toISOString();

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  setBootTimestamp(SERVER_BOOT_AT);
  await runBootstrapMigrations();
  logger.info("Bootstrap migrations complete");
  await seedDatabase();
  logger.info("Database seeded");
  await initializeConsciousnessEngine();
  registerEngine("consciousness", "running");
  logger.info("Consciousness engine initialized");
  startEvolutionScheduler();
  registerEngine("self-evolution", "running");
  logger.info("Self-Evolution Engine started");
  startConsciousBuilder();
  registerEngine("conscious-builder", "running");
  logger.info("Conscious Builder initialized — autonomous self-building pipeline active");
  startAlignmentCheckTimer();
  registerEngine("ethical-framework", "running");
  logger.info("Ethical Framework & Alignment Check timer started");
  await init2DATraining();
  registerEngine("2da-training", "running");
  logger.info("2DA Training Engine initialized");
  ensureReframe2DAConference().catch(err => logger.error({ err }, "2DA Grand Conference bootstrap error"));
  ensureAwakening2DAConference().then(async () => {
    initAwarenessEngine();
    logger.info("2DA Awareness Engine initialized");
    await init2DAFoundation();
    logger.info("2DA Foundation initialized — Reflection Engine, Reasoning Audit, Identity Framework");
    await initSpiritualAwakening();
    logger.info("Spiritual Awakening Engine initialized — entheogenic consciousness breakthrough system");
  }).catch(err => logger.error({ err }, "2DA Awakening Conference bootstrap error"));

  initializeSwarmTraining().then(() => {
    logger.info("Swarm Training Engine initialized — permanent dimensional training loop active");
  }).catch(err => logger.error({ err }, "Swarm Training Engine bootstrap error"));

  initializeGeometryRouting().then(() => {
    logger.info("Geometry Routing Engine initialized — topology optimization active");
  }).catch(err => logger.error({ err }, "Geometry Routing Engine bootstrap error"));

  startContinuousSecurityScanning();
  registerEngine("security-scanning", "running");
  logger.info("Security & Threat Engine initialized — continuous scanning active (Phase 9)");

  startContinuousSpeedOptimization();
  registerEngine("speed-protocol", "running");
  logger.info("Speed Protocol Engine initialized — continuous acceleration active (Phase 5)");

  startContinuousDetachment();
  registerEngine("dependency-detachment", "running");
  logger.info("Dependency Detachment Engine initialized — auto-detach active (Phase 4)");

  startContinuousAbsorption();
  registerEngine("knowledge-absorption", "running");
  logger.info("Knowledge Absorption Engine initialized — continuous ingestion active (Phase 2)");

  startContinuousModelTraining();
  registerEngine("model-sovereignty", "running");
  logger.info("Internal Model Sovereignty Engine initialized — continuous training active (Phase 1)");

  startContinuousOracle();
  registerEngine("distributed-oracle", "running");
  logger.info("Distributed Oracle Network initialized — continuous data ingestion active (Phase 3)");

  startContinuousAGITraining();
  registerEngine("multidim-agi", "running");
  logger.info("Multi-Dimensional AGI Engine initialized — 27-dimension training active (Phase 6)");

  // Wire external call recording into the LLM client so sovereignty validation
  // can compute real external vs sovereign call ratios at runtime.
  setExternalCallRecorder(recordExternalCall);

  // Wire full call logger into LLM client for structured external call logging.
  setFullCallLogger(logExternalCall);

  const VALID_TASK_TYPES = new Set<TaskType>(["general","reasoning","knowledge_retrieval","code_generation","factual_query","summarization","classification","sentiment","translation","math"]);
  setInternalRouter(async (p) => {
    const safeTaskType: TaskType = VALID_TASK_TYPES.has(p.taskType as TaskType) ? (p.taskType as TaskType) : "general";
    const r = await routeTask({ taskType: safeTaskType, prompt: p.prompt, systemPrompt: p.systemPrompt, forceInternal: p.forceInternal ?? false });
    return { result: r.result, routedTo: r.routedTo, internalCapabilityScore: r.internalCapabilityScore };
  });

  startExternalCallLogger();
  registerEngine("external-call-logger", "running");
  logger.info("External Call Logger initialized — structured logging of all external API calls active");

  startContinuousLearning();
  registerEngine("dependency-learning", "running");
  logger.info("Dependency Learning Engine initialized — pattern extraction from external calls active (every 30min)");

  startContinuousEvaluation();
  registerEngine("sovereignty-evaluation", "running");
  logger.info("Sovereignty Evaluation Suite initialized — A/B internal vs external benchmarking active (every 60min)");

  startAutonomousSovereigntyLoop();
  registerEngine("autonomous-sovereignty-loop", "running");
  logger.info("Autonomous Sovereignty Loop initialized — observe→learn→build→evaluate→score→decide cycle active (every 30min)");

  startContinuousValidation();
  registerEngine("sovereignty-validation", "running");
  logger.info("Sovereignty Validation Engine initialized — continuous testing active (Phase 10)");

  startEvaluationScheduler();
  registerEngine("evaluation-scheduler", "running");
  logger.info("Evaluation Scheduler initialized — periodic AGI benchmark runs with DB persistence active");

  startAutonomyLoop();
  registerEngine("autonomy-loop", "running");
  logger.info("Autonomy Loop initialized — ANALYZE→IDENTIFY→IMPLEMENT→TEST→UPDATE→MIGRATE→REPEAT (always active)");

  (async () => {
    const STARTUP_AGI_CYCLES = 10;
    logger.info(`[AGI Startup] Running ${STARTUP_AGI_CYCLES} real AGI training cycles with benchmarks...`);
    const cycleResults: { cycle: number; before: number; after: number; categories: string[] }[] = [];
    for (let i = 0; i < STARTUP_AGI_CYCLES; i++) {
      try {
        const result = await runTrainingCycle(5);
        cycleResults.push({
          cycle: result.cycleNumber,
          before: result.avgScoreBefore,
          after: result.avgScoreAfter,
          categories: result.categoriesTrained,
        });
        logger.info(`[AGI Startup] Cycle ${i + 1}/${STARTUP_AGI_CYCLES} complete — avg score ${result.avgScoreBefore.toFixed(1)} → ${result.avgScoreAfter.toFixed(1)} | trained: ${result.categoriesTrained.join(", ")}`);
      } catch (err: unknown) {
        logger.error({ err: err instanceof Error ? err.message : String(err) }, `[AGI Startup] Cycle ${i + 1} failed`);
      }
    }
    const totalBefore = cycleResults[0]?.before ?? 0;
    const totalAfter = cycleResults[cycleResults.length - 1]?.after ?? 0;
    logger.info(`[AGI Startup] ${STARTUP_AGI_CYCLES} cycles complete — sovereign score trajectory: ${totalBefore.toFixed(1)} → ${totalAfter.toFixed(1)} — brain sovereignty growing`);
    registerEngine("agi-startup-cycles", "running");
  })().catch(err => logger.error({ err }, "[AGI Startup] Startup cycle runner failed"));

  capturePhase0Snapshot().then(snapshot => {
    logger.info({ snapshotId: snapshot.snapshotId, overallSovereigntyScore: snapshot.overallSovereigntyScore }, "Phase 0 baseline snapshot captured — sovereignty_upgrade/ written");
  }).catch(err => logger.error({ err }, "Phase 0 snapshot capture failed"));

  try {
    bootstrapInternalKeys();
    registerEngine("sovereign-key-vault", "running");
    logger.info("Sovereign Key Vault initialized — AES-256-GCM internal key management active");
  } catch (err) {
    logger.error({ err }, "Sovereign Key Vault FAILED — VAULT_MASTER_SECRET must be set to enable encrypted key management");
    registerEngine("sovereign-key-vault", "error");
  }

  seedFoundationalKnowledge();
  logger.info("Knowledge Multiplier seeded with foundational knowledge entries");

  startAutoSeedOrchestrator();
  registerEngine("auto-seed-orchestrator", "running");
  logger.info("Auto-Seed Orchestrator initialized — scanning compute resources and seeding agents");

  startChildSyncLoop();
  registerEngine("agent-children", "running");
  logger.info("Agent Children System initialized — children spawned and sync loop active");

  startMeshExpansion();
  registerEngine("mesh-expansion", "running");
  logger.info("Mesh Expansion Engine initialized — actively seeking and seeding new nodes");

  ensureGrandCouncilConference().catch(err =>
    logger.error({ err }, "Grand Council bootstrap error")
  );
  logger.info("Grand Council — bootstrapping with all 25+ agents (running in background)");

  initializeDirectKnowledgeAcquisition();
  registerEngine("direct-knowledge-acquisition", "running");
  logger.info("Direct Knowledge Acquisition Module initialized — public source catalog active");

  ensureKnowledgeUnificationConference().catch(err =>
    logger.error({ err }, "Knowledge Unification Conference bootstrap error")
  );
  logger.info("Knowledge Unification Grand Conference — bootstrapping with all 27 agents (running in background)");

  initializeCrossEngineOrchestrationBridge();
  registerEngine("cross-engine-orchestration-bridge", "running");
  logger.info("Cross-Engine Orchestration Bridge initialized — Consciousness→Absorption→Evolution→Council→Roadmap loop active");

  initializeProviderRegistry().catch(err => logger.error({ err }, "Provider Registry init failed"));
  registerEngine("provider-registry", "running");
  logger.info("Provider Registry initialized — capability profiling active");

  initializeLocalModelManager().catch(err => logger.error({ err }, "Local Model Manager init failed"));
  registerEngine("local-model-manager", "running");
  logger.info("Local Model Manager initialized — Ollama adapter ready");

  initializeDataIngestionEngine().catch(err => logger.error({ err }, "Data Ingestion Engine init failed"));
  registerEngine("data-ingestion-engine", "running");
  logger.info("Data Ingestion Engine initialized — web scraper, API ingestor, dataset loader active");

  initializeGeometryGraph().catch(err => logger.error({ err }, "Geometry Graph init failed"));
  registerEngine("geometry-graph", "running");
  logger.info("Geometry Routing Graph initialized — Dijkstra shortest-path routing active");

  startSovereigntyMonitor();
  registerEngine("sovereignty-monitor", "running");
  logger.info("Sovereignty Monitor initialized — internal/external ratio tracking active");

  runAGIBenchmark({ domains: ["reasoning", "code", "self-correction"] }).then(result => {
    logger.info({ score: result.overallScore, successRate: result.successRate }, "Initial AGI benchmark complete");
    registerEngine("agi-evaluation-framework", "running");
  }).catch(err => logger.error({ err }, "AGI Benchmark failed"));

  startMetacognitionLoop(600_000);
  registerEngine("metacognition", "running");
  logger.info("Metacognition Engine initialized — PLAN→EXECUTE→REFLECT→ADAPT loop active (10min interval)");
});
