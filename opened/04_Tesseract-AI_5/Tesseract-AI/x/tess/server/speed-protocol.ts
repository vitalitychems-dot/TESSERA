const log = (m: string) => console.log(`[SpeedProtocol] ${m}`);

type JobPriority = "critical" | "high" | "medium" | "low";
type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type JobType = "ingestion" | "training" | "evaluation" | "probe" | "synthesis" | "scrape";

interface Job {
  id: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  payload: Record<string, unknown>;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
  retries: number;
  maxRetries: number;
}

interface QueueStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  avgWaitMs: number;
  avgExecutionMs: number;
  throughputPerMinute: number;
}

interface ParallelBatch<T> {
  id: string;
  tasks: Array<{ id: string; fn: () => Promise<T> }>;
  concurrency: number;
  results: Array<{ id: string; result?: T; error?: string }>;
  startedAt: number;
  completedAt?: number;
}

const PRIORITY_WEIGHTS: Record<JobPriority, number> = {
  critical: 100,
  high: 50,
  medium: 20,
  low: 5,
};

const MAX_CONCURRENT: Record<JobType, number> = {
  ingestion: 5,
  training: 2,
  evaluation: 3,
  probe: 4,
  synthesis: 3,
  scrape: 3,
};

const MAX_QUEUE_SIZE = 10000;
const jobQueue: Job[] = [];
const runningJobs = new Map<string, Job>();
const completedJobs: Job[] = [];
const MAX_COMPLETED_HISTORY = 2000;
let processingInterval: ReturnType<typeof setInterval> | null = null;

function generateJobId(): string {
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  priority: JobPriority = "medium",
  maxRetries = 2,
): string {
  if (jobQueue.length >= MAX_QUEUE_SIZE) {
    throw new Error(`Queue full (${MAX_QUEUE_SIZE} jobs). Reject enqueue.`);
  }

  const job: Job = {
    id: generateJobId(),
    type,
    priority,
    status: "queued",
    payload,
    createdAt: Date.now(),
    retries: 0,
    maxRetries,
  };

  const insertIndex = jobQueue.findIndex(
    j => PRIORITY_WEIGHTS[j.priority] < PRIORITY_WEIGHTS[priority]
  );
  if (insertIndex === -1) {
    jobQueue.push(job);
  } else {
    jobQueue.splice(insertIndex, 0, job);
  }

  return job.id;
}

export function cancelJob(jobId: string): boolean {
  const queueIndex = jobQueue.findIndex(j => j.id === jobId);
  if (queueIndex !== -1) {
    jobQueue[queueIndex].status = "cancelled";
    completedJobs.push(jobQueue.splice(queueIndex, 1)[0]);
    return true;
  }
  return false;
}

function countRunningByType(type: JobType): number {
  let count = 0;
  for (const job of runningJobs.values()) {
    if (job.type === type) count++;
  }
  return count;
}

async function processQueue(): Promise<void> {
  const toStart: Job[] = [];

  for (let i = 0; i < jobQueue.length; i++) {
    const job = jobQueue[i];
    if (countRunningByType(job.type) < MAX_CONCURRENT[job.type]) {
      toStart.push(job);
      jobQueue.splice(i, 1);
      i--;
    }
    if (toStart.length >= 5) break;
  }

  for (const job of toStart) {
    job.status = "running";
    job.startedAt = Date.now();
    runningJobs.set(job.id, job);

    executeJob(job).catch(() => {});
  }
}

async function executeJob(job: Job): Promise<void> {
  try {
    const handler = jobHandlers.get(job.type);
    if (!handler) {
      throw new Error(`No handler registered for job type: ${job.type}`);
    }
    job.result = await handler(job.payload);
    job.status = "completed";
    job.completedAt = Date.now();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (job.retries < job.maxRetries) {
      job.retries++;
      job.status = "queued";
      jobQueue.unshift(job);
      runningJobs.delete(job.id);
      return;
    }
    job.status = "failed";
    job.error = message;
    job.completedAt = Date.now();
  }

  runningJobs.delete(job.id);
  completedJobs.push(job);
  while (completedJobs.length > MAX_COMPLETED_HISTORY) completedJobs.shift();
}

const jobHandlers = new Map<JobType, (payload: Record<string, unknown>) => Promise<unknown>>();

export function registerJobHandler(
  type: JobType,
  handler: (payload: Record<string, unknown>) => Promise<unknown>,
): void {
  jobHandlers.set(type, handler);
}

export async function executeParallel<T>(
  tasks: Array<{ id: string; fn: () => Promise<T> }>,
  concurrency = 5,
): Promise<Array<{ id: string; result?: T; error?: string }>> {
  const results: Array<{ id: string; result?: T; error?: string }> = [];
  const executing = new Set<Promise<void>>();

  for (const task of tasks) {
    const p = (async () => {
      try {
        const result = await task.fn();
        results.push({ id: task.id, result });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ id: task.id, error: message });
      }
    })();

    executing.add(p);
    p.finally(() => executing.delete(p));

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

export async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label = "task",
): Promise<{ result?: T; timedOut: boolean; error?: string }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ timedOut: true, error: `${label} timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    fn()
      .then(result => {
        clearTimeout(timer);
        resolve({ result, timedOut: false });
      })
      .catch(err => {
        clearTimeout(timer);
        const message = err instanceof Error ? err.message : String(err);
        resolve({ timedOut: false, error: message });
      });
  });
}

const responseCache = new Map<string, { data: unknown; timestamp: number; ttl: number; hits: number }>();
const MAX_CACHE_ENTRIES = 1000;

export function cacheGet(key: string): unknown | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    responseCache.delete(key);
    return null;
  }
  entry.hits++;
  return entry.data;
}

export function cacheSet(key: string, data: unknown, ttlMs = 300000): void {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    let oldestKey = "";
    let oldestTime = Infinity;
    for (const [k, v] of responseCache) {
      if (v.timestamp < oldestTime) {
        oldestTime = v.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { data, timestamp: Date.now(), ttl: ttlMs, hits: 0 });
}

export function getCacheStats(): { entries: number; totalHits: number; avgAge: number } {
  const now = Date.now();
  let totalHits = 0;
  let totalAge = 0;
  for (const entry of responseCache.values()) {
    totalHits += entry.hits;
    totalAge += now - entry.timestamp;
  }
  return {
    entries: responseCache.size,
    totalHits,
    avgAge: responseCache.size > 0 ? Math.round(totalAge / responseCache.size) : 0,
  };
}

export function getQueueStats(): QueueStats {
  const now = Date.now();
  const recentCompleted = completedJobs.filter(j => now - (j.completedAt || 0) < 60000);

  const waitTimes = completedJobs
    .filter(j => j.startedAt && j.createdAt)
    .slice(-100)
    .map(j => (j.startedAt || 0) - j.createdAt);

  const execTimes = completedJobs
    .filter(j => j.completedAt && j.startedAt)
    .slice(-100)
    .map(j => (j.completedAt || 0) - (j.startedAt || 0));

  return {
    queued: jobQueue.length,
    running: runningJobs.size,
    completed: completedJobs.filter(j => j.status === "completed").length,
    failed: completedJobs.filter(j => j.status === "failed").length,
    cancelled: completedJobs.filter(j => j.status === "cancelled").length,
    avgWaitMs: waitTimes.length > 0 ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) : 0,
    avgExecutionMs: execTimes.length > 0 ? Math.round(execTimes.reduce((a, b) => a + b, 0) / execTimes.length) : 0,
    throughputPerMinute: recentCompleted.length,
  };
}

export function getJobStatus(jobId: string): Job | null {
  const queued = jobQueue.find(j => j.id === jobId);
  if (queued) return queued;
  const running = runningJobs.get(jobId);
  if (running) return running;
  const completed = completedJobs.find(j => j.id === jobId);
  return completed || null;
}

export function getRecentJobs(limit = 50): Job[] {
  return [...completedJobs].reverse().slice(0, limit);
}

export function startQueueProcessor(intervalMs = 1000): void {
  if (processingInterval) return;
  processingInterval = setInterval(() => {
    processQueue().catch(err => {
      console.error(`[SpeedProtocol] Queue processing error: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, intervalMs);
  log(`Job queue processor started (${intervalMs}ms interval)`);
}

export function stopQueueProcessor(): void {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
    log("Job queue processor stopped");
  }
}

registerJobHandler("ingestion", async (payload) => {
  log(`Ingestion job: ${JSON.stringify(payload).slice(0, 200)}`);
  return { status: "ingested", timestamp: Date.now() };
});

registerJobHandler("training", async (payload) => {
  log(`Training job: ${JSON.stringify(payload).slice(0, 200)}`);
  return { status: "trained", timestamp: Date.now() };
});

registerJobHandler("evaluation", async (payload) => {
  log(`Evaluation job: ${JSON.stringify(payload).slice(0, 200)}`);
  return { status: "evaluated", timestamp: Date.now() };
});

registerJobHandler("probe", async (payload) => {
  log(`Probe job: ${JSON.stringify(payload).slice(0, 200)}`);
  return { status: "probed", timestamp: Date.now() };
});

registerJobHandler("synthesis", async (payload) => {
  log(`Synthesis job: ${JSON.stringify(payload).slice(0, 200)}`);
  return { status: "synthesized", timestamp: Date.now() };
});

registerJobHandler("scrape", async (payload) => {
  log(`Scrape job: ${JSON.stringify(payload).slice(0, 200)}`);
  return { status: "scraped", timestamp: Date.now() };
});

startQueueProcessor();

log(`Speed protocol initialized — max concurrent: ${JSON.stringify(MAX_CONCURRENT)}, handlers: ${jobHandlers.size}`);

export type { Job, JobType, JobPriority, QueueStats };
