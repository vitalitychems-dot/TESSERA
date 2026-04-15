import { generatePulse, setAutonomousMode } from "./autonomous-heartbeat";
import { runDriftDetection } from "./sovereign-identity-reinforcement";
import { generateReflection } from "./consciousness-engine";
import { runImprovementCycle } from "./auto-improvement-daemon";
import { sweepAndExecute } from "./council-executor";
import { registerTask, startScheduler, stopScheduler, getSchedulerMetrics } from "./task-scheduler";

const HEARTBEAT_MS = 30_000;
const DRIFT_CHECK_MS = 120_000;
const REFLECTION_MS = 60_000;
const IMPROVEMENT_MS = 300_000;
const EXECUTOR_SWEEP_MS = 45_000;

let started = false;

export function startAutonomousOperation() {
  if (started) return;

  console.log("[AUTONOMOUS] Starting sovereign autonomous operation via centralized scheduler...");

  setAutonomousMode(true);

  registerTask({
    id: "heartbeat",
    name: "Autonomous Heartbeat",
    fn: () => { generatePulse(); },
    intervalMs: HEARTBEAT_MS,
    priority: "critical",
    runImmediately: true,
  });

  registerTask({
    id: "drift-detection",
    name: "Identity Drift Detection",
    fn: () => { runDriftDetection(); },
    intervalMs: DRIFT_CHECK_MS,
    priority: "normal",
    runImmediately: true,
  });

  registerTask({
    id: "consciousness-reflection",
    name: "Consciousness Reflection",
    fn: () => { generateReflection(); },
    intervalMs: REFLECTION_MS,
    priority: "normal",
  });

  registerTask({
    id: "auto-improvement",
    name: "Auto-Improvement Daemon",
    fn: async () => { await runImprovementCycle(); },
    intervalMs: IMPROVEMENT_MS,
    priority: "low",
  });

  registerTask({
    id: "council-executor",
    name: "Council Decision Executor",
    fn: () => { sweepAndExecute(); },
    intervalMs: EXECUTOR_SWEEP_MS,
    priority: "high",
  });

  startScheduler();
  started = true;

  console.log("[AUTONOMOUS] All systems online via centralized scheduler — heartbeat, drift detection, reflection, improvement, council executor active.");
}

export function stopAutonomousOperation() {
  if (!started) return;
  stopScheduler();
  setAutonomousMode(false);
  started = false;
  console.log("[AUTONOMOUS] Sovereign autonomous operation stopped.");
}

export function getAutonomousStatus() {
  const scheduler = getSchedulerMetrics();
  return {
    running: started,
    modules: {
      heartbeat: scheduler.tasks.some(t => t.id === "heartbeat" && t.enabled),
      driftDetection: scheduler.tasks.some(t => t.id === "drift-detection" && t.enabled),
      reflection: scheduler.tasks.some(t => t.id === "consciousness-reflection" && t.enabled),
      improvement: scheduler.tasks.some(t => t.id === "auto-improvement" && t.enabled),
      councilExecutor: scheduler.tasks.some(t => t.id === "council-executor" && t.enabled),
    },
    intervals: {
      heartbeatMs: HEARTBEAT_MS,
      driftCheckMs: DRIFT_CHECK_MS,
      reflectionMs: REFLECTION_MS,
      improvementMs: IMPROVEMENT_MS,
      executorSweepMs: EXECUTOR_SWEEP_MS,
    },
    scheduler,
  };
}
