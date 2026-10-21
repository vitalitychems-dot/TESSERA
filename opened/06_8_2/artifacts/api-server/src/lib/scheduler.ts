const LOG_PREFIX = "[Scheduler]";

interface ScheduledTask {
  id: string;
  label: string;
  intervalMs: number;
  fn: () => void | Promise<void>;
  timer: ReturnType<typeof setInterval> | null;
  lastRun: number;
  runCount: number;
  errors: number;
}

const tasks = new Map<string, ScheduledTask>();
let started = false;

export function registerTask(
  id: string,
  label: string,
  intervalMs: number,
  fn: () => void | Promise<void>,
): void {
  if (tasks.has(id)) {
    console.warn(`${LOG_PREFIX} Task "${id}" already registered — skipping duplicate`);
    return;
  }
  tasks.set(id, { id, label, intervalMs, fn, timer: null, lastRun: 0, runCount: 0, errors: 0 });
}

export function startTask(id: string): void {
  const task = tasks.get(id);
  if (!task) {
    console.warn(`${LOG_PREFIX} Task "${id}" not found`);
    return;
  }
  if (task.timer !== null) return;
  task.timer = setInterval(async () => {
    task.lastRun = Date.now();
    task.runCount++;
    try {
      await task.fn();
    } catch (err: unknown) {
      task.errors++;
      console.error(`${LOG_PREFIX} Task "${task.id}" error:`, err instanceof Error ? err.message : String(err));
    }
  }, task.intervalMs);
}

export function stopTask(id: string): void {
  const task = tasks.get(id);
  if (!task || task.timer === null) return;
  clearInterval(task.timer);
  task.timer = null;
}

export function startAll(): void {
  if (started) return;
  started = true;
  for (const id of tasks.keys()) {
    startTask(id);
  }
  console.log(`${LOG_PREFIX} Started ${tasks.size} scheduled tasks`);
}

export function stopAll(): void {
  for (const id of tasks.keys()) {
    stopTask(id);
  }
  started = false;
  console.log(`${LOG_PREFIX} All scheduled tasks stopped`);
}

export function getStatus(): Array<{
  id: string;
  label: string;
  intervalMs: number;
  running: boolean;
  lastRun: number;
  runCount: number;
  errors: number;
}> {
  return Array.from(tasks.values()).map(t => ({
    id: t.id,
    label: t.label,
    intervalMs: t.intervalMs,
    running: t.timer !== null,
    lastRun: t.lastRun,
    runCount: t.runCount,
    errors: t.errors,
  }));
}
