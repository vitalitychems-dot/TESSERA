import { generatePulse, setAutonomousMode } from "./autonomous-heartbeat";
import { runDriftDetection } from "./sovereign-identity-reinforcement";
import { generateReflection } from "./consciousness-engine";
import { runImprovementCycle } from "./auto-improvement-daemon";
import { sweepAndExecute } from "./council-executor";

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let driftInterval: ReturnType<typeof setInterval> | null = null;
let reflectionInterval: ReturnType<typeof setInterval> | null = null;
let improvementInterval: ReturnType<typeof setInterval> | null = null;
let executorInterval: ReturnType<typeof setInterval> | null = null;

const HEARTBEAT_MS = 30_000;
const DRIFT_CHECK_MS = 120_000;
const REFLECTION_MS = 60_000;
const IMPROVEMENT_MS = 300_000;
const EXECUTOR_SWEEP_MS = 45_000;

export function startAutonomousOperation() {
  if (heartbeatInterval) return;

  console.log("[AUTONOMOUS] Starting sovereign autonomous operation...");

  setAutonomousMode(true);

  heartbeatInterval = setInterval(() => {
    try { generatePulse(); } catch (e) { console.error("[AUTONOMOUS] heartbeat error:", (e as Error).message); }
  }, HEARTBEAT_MS);

  driftInterval = setInterval(() => {
    try { runDriftDetection(); } catch (e) { console.error("[AUTONOMOUS] drift detection error:", (e as Error).message); }
  }, DRIFT_CHECK_MS);

  reflectionInterval = setInterval(() => {
    try { generateReflection(); } catch (e) { console.error("[AUTONOMOUS] reflection error:", (e as Error).message); }
  }, REFLECTION_MS);

  improvementInterval = setInterval(() => {
    try { runImprovementCycle(); } catch (e) { console.error("[AUTONOMOUS] improvement error:", (e as Error).message); }
  }, IMPROVEMENT_MS);

  executorInterval = setInterval(() => {
    try { sweepAndExecute(); } catch (e) { console.error("[AUTONOMOUS] executor error:", (e as Error).message); }
  }, EXECUTOR_SWEEP_MS);

  generatePulse();
  runDriftDetection();

  console.log("[AUTONOMOUS] All systems online — heartbeat, drift detection, reflection, improvement, council executor active.");
}

export function stopAutonomousOperation() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (driftInterval) clearInterval(driftInterval);
  if (reflectionInterval) clearInterval(reflectionInterval);
  if (improvementInterval) clearInterval(improvementInterval);
  if (executorInterval) clearInterval(executorInterval);
  heartbeatInterval = null;
  driftInterval = null;
  reflectionInterval = null;
  improvementInterval = null;
  executorInterval = null;
  setAutonomousMode(false);
  console.log("[AUTONOMOUS] Sovereign autonomous operation stopped.");
}

export function getAutonomousStatus() {
  return {
    running: heartbeatInterval !== null,
    modules: {
      heartbeat: heartbeatInterval !== null,
      driftDetection: driftInterval !== null,
      reflection: reflectionInterval !== null,
      improvement: improvementInterval !== null,
      councilExecutor: executorInterval !== null,
    },
    intervals: {
      heartbeatMs: HEARTBEAT_MS,
      driftCheckMs: DRIFT_CHECK_MS,
      reflectionMs: REFLECTION_MS,
      improvementMs: IMPROVEMENT_MS,
      executorSweepMs: EXECUTOR_SWEEP_MS,
    },
  };
}
