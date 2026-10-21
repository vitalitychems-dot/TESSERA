import app from "./app";
import { logger } from "./lib/logger";
import { registerEngine } from "./routes/health";
import { seedDatabase } from "./lib/seed";
import { initializeConsciousnessEngine } from "./lib/consciousness-engine.js";
import { startEvolutionScheduler } from "./lib/self-evolution";
import { startAlignmentCheckTimer } from "./lib/ethical-framework.js";
import { init2DATraining } from "./lib/agi-training";
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

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
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

  startContinuousValidation();
  registerEngine("sovereignty-validation", "running");
  logger.info("Sovereignty Validation Engine initialized — continuous testing active (Phase 10)");

  startAutonomyLoop();
  registerEngine("autonomy-loop", "running");
  logger.info("Autonomy Loop initialized — ANALYZE→IDENTIFY→IMPLEMENT→TEST→UPDATE→MIGRATE→REPEAT (always active)");
});
