import os from "os";

interface ManagedTask {
  name: string;
  priority: number;
  fn: () => Promise<void> | void;
  intervalMs: number;
  lastRun: number;
  running: boolean;
  enabled: boolean;
  failures: number;
  maxFailures: number;
  memoryThresholdMB: number;
  category: "critical" | "important" | "background" | "optional";
}

interface ResourceState {
  memoryUsedMB: number;
  memoryTotalMB: number;
  memoryPercent: number;
  cpuLoad: number[];
  uptime: number;
  activeTasks: number;
  totalTasks: number;
  taskStats: Record<string, { runs: number; failures: number; avgDurationMs: number; lastRun: number }>;
  healthScore: number;
}

const MEMORY_CRITICAL_THRESHOLD = 93;
const MEMORY_HIGH_THRESHOLD = 88;
const MEMORY_NORMAL_THRESHOLD = 75;
const MAX_CONCURRENT_TASKS = 4;
const HEALTH_CHECK_INTERVAL = 60_000;

const tasks: Map<string, ManagedTask> = new Map();
const taskStats: Map<string, { runs: number; failures: number; totalDurationMs: number; lastRun: number }> = new Map();
let activeTaskCount = 0;
let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let startTime = Date.now();

function getMemoryUsage(): { usedMB: number; totalMB: number; percent: number } {
  const used = process.memoryUsage();
  const usedMB = Math.round(used.heapUsed / 1024 / 1024);
  const totalMB = Math.round(used.heapTotal / 1024 / 1024);
  const percent = Math.round((usedMB / totalMB) * 100);
  return { usedMB, totalMB, percent };
}

function canRunTask(task: ManagedTask): boolean {
  const mem = getMemoryUsage();

  if (task.category === "critical") return true;

  if (mem.percent >= MEMORY_CRITICAL_THRESHOLD) {
    return task.category === "critical";
  }

  if (mem.percent >= MEMORY_HIGH_THRESHOLD) {
    return task.category === "important" && activeTaskCount < 2;
  }

  if (activeTaskCount >= MAX_CONCURRENT_TASKS) {
    return false;
  }

  if (mem.percent >= task.memoryThresholdMB) {
    return false;
  }

  return true;
}

function calculateHealthScore(): number {
  const mem = getMemoryUsage();
  let score = 100;

  if (mem.percent > 90) score -= 40;
  else if (mem.percent > 80) score -= 25;
  else if (mem.percent > 70) score -= 15;
  else if (mem.percent > 60) score -= 5;

  let totalFailRate = 0;
  let taskCount = 0;
  for (const [, stats] of taskStats) {
    if (stats.runs > 0) {
      totalFailRate += stats.failures / stats.runs;
      taskCount++;
    }
  }
  if (taskCount > 0) {
    const avgFailRate = totalFailRate / taskCount;
    score -= Math.round(avgFailRate * 30);
  }

  const disabledCount = Array.from(tasks.values()).filter(t => !t.enabled).length;
  score -= disabledCount * 2;

  return Math.max(0, Math.min(100, score));
}

async function runTask(task: ManagedTask): Promise<void> {
  if (task.running || !task.enabled) return;
  if (!canRunTask(task)) return;

  const now = Date.now();
  if (now - task.lastRun < task.intervalMs) return;

  task.running = true;
  activeTaskCount++;
  const startTime = Date.now();

  try {
    await Promise.resolve(task.fn());
    task.failures = 0;

    const stats = taskStats.get(task.name) || { runs: 0, failures: 0, totalDurationMs: 0, lastRun: 0 };
    stats.runs++;
    stats.totalDurationMs += Date.now() - startTime;
    stats.lastRun = now;
    taskStats.set(task.name, stats);
  } catch (e: any) {
    task.failures++;
    const stats = taskStats.get(task.name) || { runs: 0, failures: 0, totalDurationMs: 0, lastRun: 0 };
    stats.failures++;
    stats.lastRun = now;
    taskStats.set(task.name, stats);

    if (task.failures >= task.maxFailures) {
      task.enabled = false;
      console.log(`[ResourceManager] Disabled task "${task.name}" after ${task.failures} consecutive failures`);
    }
  } finally {
    task.running = false;
    task.lastRun = Date.now();
    activeTaskCount--;
  }
}

function schedulerTick(): void {
  const mem = getMemoryUsage();

  if (mem.percent >= MEMORY_CRITICAL_THRESHOLD) {
    if (global.gc) {
      try { global.gc(); } catch {}
    }

    for (const [, task] of tasks) {
      if (task.category === "optional") {
        task.enabled = false;
      }
    }
    return;
  }

  const sortedTasks = Array.from(tasks.values())
    .filter(t => t.enabled && !t.running)
    .sort((a, b) => {
      if (a.category !== b.category) {
        const order = { critical: 0, important: 1, background: 2, optional: 3 };
        return order[a.category] - order[b.category];
      }
      return b.priority - a.priority;
    });

  for (const task of sortedTasks) {
    if (activeTaskCount < MAX_CONCURRENT_TASKS) {
      runTask(task).catch(() => {});
    }
  }
}

export function registerManagedTask(
  name: string,
  fn: () => Promise<void> | void,
  options: {
    priority?: number;
    intervalMs?: number;
    category?: "critical" | "important" | "background" | "optional";
    maxFailures?: number;
    memoryThresholdMB?: number;
  } = {}
): void {
  const task: ManagedTask = {
    name,
    fn,
    priority: options.priority || 5,
    intervalMs: options.intervalMs || 60_000,
    category: options.category || "background",
    maxFailures: options.maxFailures || 5,
    memoryThresholdMB: options.memoryThresholdMB || MEMORY_HIGH_THRESHOLD,
    lastRun: 0,
    running: false,
    enabled: true,
    failures: 0,
  };

  tasks.set(name, task);
  taskStats.set(name, { runs: 0, failures: 0, totalDurationMs: 0, lastRun: 0 });
}

export function getResourceState(): ResourceState {
  const mem = getMemoryUsage();
  const stats: Record<string, { runs: number; failures: number; avgDurationMs: number; lastRun: number }> = {};

  for (const [name, s] of taskStats) {
    stats[name] = {
      runs: s.runs,
      failures: s.failures,
      avgDurationMs: s.runs > 0 ? Math.round(s.totalDurationMs / s.runs) : 0,
      lastRun: s.lastRun,
    };
  }

  return {
    memoryUsedMB: mem.usedMB,
    memoryTotalMB: mem.totalMB,
    memoryPercent: mem.percent,
    cpuLoad: os.loadavg(),
    uptime: Math.round((Date.now() - startTime) / 1000),
    activeTasks: activeTaskCount,
    totalTasks: tasks.size,
    taskStats: stats,
    healthScore: calculateHealthScore(),
  };
}

export function getTaskList(): Array<{
  name: string;
  category: string;
  enabled: boolean;
  running: boolean;
  failures: number;
  lastRun: number;
  intervalMs: number;
}> {
  return Array.from(tasks.values()).map(t => ({
    name: t.name,
    category: t.category,
    enabled: t.enabled,
    running: t.running,
    failures: t.failures,
    lastRun: t.lastRun,
    intervalMs: t.intervalMs,
  }));
}

export function enableTask(name: string): boolean {
  const task = tasks.get(name);
  if (task) {
    task.enabled = true;
    task.failures = 0;
    return true;
  }
  return false;
}

export function disableTask(name: string): boolean {
  const task = tasks.get(name);
  if (task) {
    task.enabled = false;
    return true;
  }
  return false;
}

export function startResourceManager(): void {
  startTime = Date.now();

  if (schedulerInterval) clearInterval(schedulerInterval);
  if (healthCheckInterval) clearInterval(healthCheckInterval);

  schedulerInterval = setInterval(schedulerTick, 8_000);
  healthCheckInterval = setInterval(() => {
    const state = getResourceState();
    if (state.memoryPercent >= MEMORY_CRITICAL_THRESHOLD) {
      console.log(`[ResourceManager] CRITICAL MEMORY: ${state.memoryUsedMB}MB / ${state.memoryTotalMB}MB (${state.memoryPercent}%) — Health: ${state.healthScore}/100`);
    }
  }, HEALTH_CHECK_INTERVAL);

  console.log(`[ResourceManager] Started — managing ${tasks.size} tasks, memory-aware scheduling active`);
}

export function stopResourceManager(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

export function forceGC(): { before: number; after: number } {
  const before = getMemoryUsage().usedMB;
  if (global.gc) {
    try { global.gc(); } catch {}
  }
  const after = getMemoryUsage().usedMB;
  return { before, after };
}
