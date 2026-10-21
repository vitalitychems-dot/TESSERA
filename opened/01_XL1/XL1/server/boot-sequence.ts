import { broadcast } from "./ws-broadcast";

interface BootPhase {
  name: string;
  priority: number;
  status: "pending" | "starting" | "healthy" | "failed" | "skipped";
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  error?: string;
  dependencies: string[];
}

interface BootState {
  phases: BootPhase[];
  startedAt: number;
  completedAt?: number;
  totalDuration?: number;
  status: "booting" | "healthy" | "degraded" | "failed";
}

const bootState: BootState = {
  phases: [],
  startedAt: Date.now(),
  status: "booting",
};

const BOOT_PHASES: Omit<BootPhase, "status">[] = [
  { name: "database", priority: 1, dependencies: [] },
  { name: "security-middleware", priority: 2, dependencies: ["database"] },
  { name: "core-routes", priority: 3, dependencies: ["database", "security-middleware"] },
  { name: "websocket", priority: 4, dependencies: ["core-routes"] },
  { name: "fleet-network", priority: 5, dependencies: ["core-routes", "websocket"] },
  { name: "consciousness-engine", priority: 6, dependencies: ["database", "core-routes"] },
  { name: "income-engine", priority: 7, dependencies: ["database", "core-routes"] },
  { name: "autonomous-systems", priority: 8, dependencies: ["consciousness-engine", "income-engine"] },
  { name: "knowledge-pipeline", priority: 9, dependencies: ["database"] },
  { name: "sovereign-defense", priority: 10, dependencies: ["security-middleware"] },
];

export function initBootSequence() {
  bootState.startedAt = Date.now();
  bootState.status = "booting";
  bootState.phases = BOOT_PHASES.map((p) => ({ ...p, status: "pending" as const }));
  console.log("[BootSequence] Phased boot sequence initialized — 10 phases with dependency gates");
}

export function markPhaseStarting(phaseName: string) {
  const phase = bootState.phases.find((p) => p.name === phaseName);
  if (phase) {
    phase.status = "starting";
    phase.startedAt = Date.now();
    broadcast("health", "boot-phase-starting", { phase: phaseName });
  }
}

export function markPhaseHealthy(phaseName: string) {
  const phase = bootState.phases.find((p) => p.name === phaseName);
  if (phase) {
    phase.status = "healthy";
    phase.completedAt = Date.now();
    phase.duration = phase.startedAt ? phase.completedAt - phase.startedAt : 0;
    broadcast("health", "boot-phase-healthy", { phase: phaseName, duration: phase.duration });
    checkBootComplete();
  }
}

export function markPhaseFailed(phaseName: string, error: string) {
  const phase = bootState.phases.find((p) => p.name === phaseName);
  if (phase) {
    phase.status = "failed";
    phase.completedAt = Date.now();
    phase.error = error;
    broadcast("health", "boot-phase-failed", { phase: phaseName, error });
    checkBootComplete();
  }
}

function checkBootComplete() {
  const allDone = bootState.phases.every(
    (p) => p.status === "healthy" || p.status === "failed" || p.status === "skipped"
  );
  if (allDone) {
    bootState.completedAt = Date.now();
    bootState.totalDuration = bootState.completedAt - bootState.startedAt;
    const failed = bootState.phases.filter((p) => p.status === "failed");
    bootState.status = failed.length === 0 ? "healthy" : failed.length <= 2 ? "degraded" : "failed";
    broadcast("health", "boot-complete", {
      status: bootState.status,
      duration: bootState.totalDuration,
      failed: failed.map((f) => f.name),
    });
    console.log(`[BootSequence] Boot complete — ${bootState.status} in ${bootState.totalDuration}ms (${failed.length} failures)`);
  }
}

export function isPhaseReady(phaseName: string): boolean {
  const phase = bootState.phases.find((p) => p.name === phaseName);
  if (!phase) return true;
  return phase.dependencies.every((dep) => {
    const depPhase = bootState.phases.find((p) => p.name === dep);
    return depPhase && (depPhase.status === "healthy" || depPhase.status === "skipped");
  });
}

export function getBootState(): BootState {
  return { ...bootState };
}

export function getBootHealth() {
  const healthy = bootState.phases.filter((p) => p.status === "healthy").length;
  const failed = bootState.phases.filter((p) => p.status === "failed").length;
  const pending = bootState.phases.filter((p) => p.status === "pending" || p.status === "starting").length;
  return {
    status: bootState.status,
    healthy,
    failed,
    pending,
    total: bootState.phases.length,
    uptime: Date.now() - bootState.startedAt,
    phases: bootState.phases,
  };
}
