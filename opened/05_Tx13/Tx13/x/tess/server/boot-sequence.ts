import fs from "fs";
import { broadcast } from "./ws-broadcast";
import { logSystemAction } from "./decision-history";

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
    const healthy = bootState.phases.filter((p) => p.status === "healthy");
    bootState.status = failed.length === 0 ? "healthy" : failed.length <= 2 ? "degraded" : "failed";

    broadcast("health", "boot-complete", {
      status: bootState.status,
      duration: bootState.totalDuration,
      failed: failed.map((f) => f.name),
      healthy: healthy.map((h) => h.name),
      summary: generateBootReport(),
    });

    console.log(`[BootSequence] Boot complete — ${bootState.status} in ${bootState.totalDuration}ms`);
    console.log(`[BootSequence] Healthy: ${healthy.length}/${bootState.phases.length} phases`);
    if (failed.length > 0) {
      console.warn(`[BootSequence] FAILED phases: ${failed.map(f => `${f.name} (${f.error})`).join(", ")}`);
    }

    logSystemAction(
      "BootSequence",
      `System Boot — ${bootState.status}`,
      `Boot completed in ${bootState.totalDuration}ms. ${healthy.length}/${bootState.phases.length} phases healthy. ${failed.length > 0 ? `Failed: ${failed.map(f => f.name).join(", ")}` : "All critical phases passed."}`,
      bootState.status === "healthy" ? "executed" : bootState.status === "degraded" ? "modified" : "failed",
      {
        duration: bootState.totalDuration,
        healthyPhases: healthy.map(h => h.name),
        failedPhases: failed.map(f => ({ name: f.name, error: f.error })),
        phaseSummary: bootState.phases.map(p => ({ name: p.name, status: p.status, duration: p.duration })),
      }
    );
  }
}

export function generateBootReport(): string {
  const lines: string[] = [];
  lines.push(`Boot Status: ${bootState.status.toUpperCase()}`);
  lines.push(`Duration: ${bootState.totalDuration ?? "in progress"}ms`);
  lines.push(`Phases (${bootState.phases.length} total):`);
  for (const phase of bootState.phases) {
    const icon = phase.status === "healthy" ? "✓" : phase.status === "failed" ? "✗" : phase.status === "starting" ? "⟳" : phase.status === "skipped" ? "○" : "·";
    const dur = phase.duration ? ` (${phase.duration}ms)` : "";
    const err = phase.error ? ` — ERROR: ${phase.error}` : "";
    lines.push(`  ${icon} [${phase.priority}] ${phase.name}: ${phase.status}${dur}${err}`);
  }
  return lines.join("\n");
}

export function verifyModuleIntegrity(): { passed: boolean; checks: { module: string; status: "ok" | "missing" | "error"; detail: string }[] } {
  const CRITICAL_MODULES = [
    "knowledge-engine",
    "memory-compress",
    "vector-index",
    "decision-history",
    "sovereign-council-engine",
    "llm-helper",
    "ws-broadcast",
  ];

  const checks: { module: string; status: "ok" | "missing" | "error"; detail: string }[] = [];
  const serverDir = `${process.cwd()}/server`;

  for (const mod of CRITICAL_MODULES) {
    const tsPath = `${serverDir}/${mod}.ts`;
    const jsPath = `${serverDir}/${mod}.js`;
    const exists = fs.existsSync(tsPath) || fs.existsSync(jsPath);
    if (exists) {
      checks.push({ module: mod, status: "ok", detail: "Module file found on disk" });
    } else {
      checks.push({ module: mod, status: "missing", detail: "Module file not found on disk" });
    }
  }

  const passed = checks.every(c => c.status === "ok");
  if (!passed) {
    const missing = checks.filter(c => c.status !== "ok");
    console.warn(`[BootSequence] Module integrity check: ${missing.length} issues — ${missing.map(m => m.module).join(", ")}`);
  } else {
    console.log(`[BootSequence] Module integrity check: all ${checks.length} critical modules verified`);
  }

  return { passed, checks };
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
