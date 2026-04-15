import { logger } from "./logger";

type Priority = "critical" | "high" | "normal" | "low";

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

interface ScheduledTask {
  id: string;
  name: string;
  fn: () => Promise<void> | void;
  intervalMs: number;
  priority: Priority;
  lastRunAt: number;
  nextRunAt: number;
  running: boolean;
  runCount: number;
  errorCount: number;
  lastError: string | null;
  lastDurationMs: number;
  enabled: boolean;
}

const tasks = new Map<string, ScheduledTask>();
let tickInterval: ReturnType<typeof setInterval> | null = null;
let ticking = false;
const TICK_MS = 5_000;

export function registerTask(opts: {
  id: string;
  name: string;
  fn: () => Promise<void> | void;
  intervalMs: number;
  priority?: Priority;
  enabled?: boolean;
  runImmediately?: boolean;
}): void {
  if (tasks.has(opts.id)) {
    const existing = tasks.get(opts.id)!;
    existing.fn = opts.fn;
    existing.intervalMs = opts.intervalMs;
    existing.priority = opts.priority || existing.priority;
    existing.enabled = opts.enabled ?? existing.enabled;
    return;
  }

  const now = Date.now();
  const task: ScheduledTask = {
    id: opts.id,
    name: opts.name,
    fn: opts.fn,
    intervalMs: opts.intervalMs,
    priority: opts.priority || "normal",
    lastRunAt: 0,
    nextRunAt: opts.runImmediately ? now : now + opts.intervalMs,
    running: false,
    runCount: 0,
    errorCount: 0,
    lastError: null,
    lastDurationMs: 0,
    enabled: opts.enabled ?? true,
  };

  tasks.set(opts.id, task);
  logger.info({ taskId: opts.id, name: opts.name, intervalMs: opts.intervalMs, priority: opts.priority }, "TaskScheduler: registered");
}

export function unregisterTask(id: string): void {
  tasks.delete(id);
}

export function enableTask(id: string): void {
  const task = tasks.get(id);
  if (task) {
    task.enabled = true;
    task.nextRunAt = Date.now();
  }
}

export function disableTask(id: string): void {
  const task = tasks.get(id);
  if (task) task.enabled = false;
}

async function runTask(task: ScheduledTask): Promise<void> {
  if (task.running || !task.enabled) return;
  task.running = true;
  const start = Date.now();

  try {
    await task.fn();
    task.runCount++;
    task.lastError = null;
  } catch (err) {
    task.errorCount++;
    task.lastError = err instanceof Error ? err.message : String(err);
    logger.warn({ taskId: task.id, name: task.name, err: task.lastError }, "TaskScheduler: task error");
  } finally {
    task.running = false;
    task.lastRunAt = Date.now();
    task.lastDurationMs = Date.now() - start;
    task.nextRunAt = Date.now() + task.intervalMs;
  }
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;

  try {
    const now = Date.now();
    const dueTasks = Array.from(tasks.values())
      .filter(t => t.enabled && !t.running && t.nextRunAt <= now)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    const MAX_CONCURRENT = 3;
    let running = Array.from(tasks.values()).filter(t => t.running).length;

    for (const task of dueTasks) {
      if (running >= MAX_CONCURRENT) break;
      runTask(task);
      running++;
    }
  } finally {
    ticking = false;
  }
}

export function startScheduler(): void {
  if (tickInterval) return;
  tickInterval = setInterval(tick, TICK_MS);
  tick();
  logger.info({ taskCount: tasks.size }, "TaskScheduler: started");
}

export function stopScheduler(): void {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  logger.info("TaskScheduler: stopped");
}

export function getSchedulerMetrics() {
  const taskList = Array.from(tasks.values()).map(t => ({
    id: t.id,
    name: t.name,
    priority: t.priority,
    intervalMs: t.intervalMs,
    enabled: t.enabled,
    running: t.running,
    runCount: t.runCount,
    errorCount: t.errorCount,
    lastError: t.lastError,
    lastRunAt: t.lastRunAt,
    lastDurationMs: t.lastDurationMs,
    nextRunAt: t.nextRunAt,
    successRate: t.runCount + t.errorCount > 0
      ? Math.round((t.runCount / (t.runCount + t.errorCount)) * 100)
      : 100,
  }));

  return {
    running: tickInterval !== null,
    totalTasks: tasks.size,
    activeTasks: taskList.filter(t => t.enabled).length,
    runningNow: taskList.filter(t => t.running).length,
    tasks: taskList.sort((a, b) => PRIORITY_ORDER[a.priority as Priority] - PRIORITY_ORDER[b.priority as Priority]),
  };
}
