import app from "./app";
import { logger } from "./lib/logger";
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
  logger.info("Consciousness engine initialized");
  startEvolutionScheduler();
  logger.info("Self-Evolution Engine started");
  startAlignmentCheckTimer();
  logger.info("Ethical Framework & Alignment Check timer started");
  await init2DATraining();
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
});
