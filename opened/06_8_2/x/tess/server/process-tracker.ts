import * as os from "os";
import * as fs from "fs";
import { execSync } from "child_process";

export interface LiveProcess {
  id: string;
  name: string;
  agency: string;
  status: "pending" | "running" | "complete" | "failed";
  startedAt: number;
  estimatedDurationMs: number;
  completedAt?: number;
  progress: number;
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  category: "agency" | "conference" | "engine" | "scan" | "sync" | "mesh" | "training" | "income" | "fleet" | "briefing" | "task";
  metadata?: Record<string, any>;
}

interface ProcessTrackerState {
  processes: Map<string, LiveProcess>;
  history: LiveProcess[];
  sseClients: Set<any>;
  cycleTimes: Map<string, number[]>;
}

const state: ProcessTrackerState = {
  processes: new Map(),
  history: [],
  sseClients: new Set(),
  cycleTimes: new Map(),
};

function generateProcessId(): string {
  return `proc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function broadcastUpdate(process: LiveProcess) {
  const data = JSON.stringify({ type: "process_update", process: serializeProcess(process) });
  for (const client of state.sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      state.sseClients.delete(client);
    }
  }
}

function broadcastAll() {
  const all = getAllActiveProcesses();
  const data = JSON.stringify({ type: "process_list", processes: all });
  for (const client of state.sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      state.sseClients.delete(client);
    }
  }
}

function getAvgDuration(agency: string): number {
  const times = state.cycleTimes.get(agency);
  if (!times || times.length === 0) return 0;
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}

function recordCycleTime(agency: string, durationMs: number) {
  if (!state.cycleTimes.has(agency)) {
    state.cycleTimes.set(agency, []);
  }
  const times = state.cycleTimes.get(agency)!;
  times.push(durationMs);
  if (times.length > 20) times.shift();
}

function serializeProcess(p: LiveProcess) {
  const now = Date.now();
  const elapsed = now - p.startedAt;
  const remaining = Math.max(0, p.estimatedDurationMs - elapsed);
  const calculatedProgress = p.status === "complete" ? 100 :
    p.status === "failed" ? p.progress :
    p.estimatedDurationMs > 0 ? Math.min(99, Math.round((elapsed / p.estimatedDurationMs) * 100)) :
    p.progress;

  return {
    ...p,
    elapsedMs: elapsed,
    remainingMs: remaining,
    remainingSeconds: Math.ceil(remaining / 1000),
    calculatedProgress: Math.max(p.progress, calculatedProgress),
    avgCycleDuration: getAvgDuration(p.agency),
    etaTimestamp: p.status === "running" ? p.startedAt + p.estimatedDurationMs : null,
  };
}

export function startProcess(opts: {
  name: string;
  agency: string;
  estimatedDurationMs: number;
  category: LiveProcess["category"];
  totalSteps?: number;
  currentStep?: string;
  metadata?: Record<string, any>;
}): string {
  const id = generateProcessId();
  const process: LiveProcess = {
    id,
    name: opts.name,
    agency: opts.agency,
    status: "running",
    startedAt: Date.now(),
    estimatedDurationMs: opts.estimatedDurationMs,
    progress: 0,
    category: opts.category,
    totalSteps: opts.totalSteps,
    completedSteps: 0,
    currentStep: opts.currentStep,
    metadata: opts.metadata,
  };

  const avg = getAvgDuration(opts.agency);
  if (avg > 0 && opts.estimatedDurationMs === 0) {
    process.estimatedDurationMs = avg;
  }

  state.processes.set(id, process);
  broadcastUpdate(process);
  return id;
}

export function updateProcess(id: string, updates: Partial<Pick<LiveProcess, "progress" | "currentStep" | "completedSteps" | "estimatedDurationMs" | "metadata">>) {
  const process = state.processes.get(id);
  if (!process) return;

  if (updates.progress !== undefined) process.progress = updates.progress;
  if (updates.currentStep !== undefined) process.currentStep = updates.currentStep;
  if (updates.completedSteps !== undefined) process.completedSteps = updates.completedSteps;
  if (updates.estimatedDurationMs !== undefined) process.estimatedDurationMs = updates.estimatedDurationMs;
  if (updates.metadata) process.metadata = { ...process.metadata, ...updates.metadata };

  broadcastUpdate(process);
}

export function completeProcess(id: string) {
  const process = state.processes.get(id);
  if (!process) return;

  process.status = "complete";
  process.progress = 100;
  process.completedAt = Date.now();
  const duration = process.completedAt - process.startedAt;
  recordCycleTime(process.agency, duration);

  broadcastUpdate(process);

  state.history.unshift({ ...process });
  if (state.history.length > 100) state.history.pop();
  state.processes.delete(id);
}

export function failProcess(id: string, reason?: string) {
  const process = state.processes.get(id);
  if (!process) return;

  process.status = "failed";
  process.completedAt = Date.now();
  if (reason) process.metadata = { ...process.metadata, failReason: reason };

  broadcastUpdate(process);

  state.history.unshift({ ...process });
  if (state.history.length > 100) state.history.pop();
  state.processes.delete(id);
}

export function getAllActiveProcesses() {
  return Array.from(state.processes.values()).map(serializeProcess);
}

export function getProcessHistory() {
  return state.history.map(serializeProcess).slice(0, 50);
}

export function getProcessStats() {
  const active = state.processes.size;
  const byCategory: Record<string, number> = {};
  const byAgency: Record<string, { count: number; avgMs: number }> = {};

  for (const p of state.processes.values()) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  }

  for (const [agency, times] of state.cycleTimes) {
    byAgency[agency] = {
      count: times.length,
      avgMs: getAvgDuration(agency),
    };
  }

  return {
    activeProcesses: active,
    totalCompleted: state.history.filter(h => h.status === "complete").length,
    totalFailed: state.history.filter(h => h.status === "failed").length,
    byCategory,
    byAgency,
  };
}

export function broadcastCodeEditEvent(filePath: string, description: string) {
  const data = JSON.stringify({
    type: "code_edit_applied",
    file: filePath,
    description,
    timestamp: Date.now(),
  });
  for (const client of state.sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      state.sseClients.delete(client);
    }
  }
}

export function addSSEClient(res: any) {
  state.sseClients.add(res);
  const all = getAllActiveProcesses();
  try {
    res.write(`data: ${JSON.stringify({ type: "process_list", processes: all })}\n\n`);
  } catch {}
}

export function removeSSEClient(res: any) {
  state.sseClients.delete(res);
}

export function trackAgencyCycle(agency: string, name: string, estimatedMs: number, category: LiveProcess["category"], fn: () => Promise<any> | any): Promise<string> {
  return new Promise(async (resolve) => {
    const id = startProcess({ name, agency, estimatedDurationMs: estimatedMs, category });
    try {
      await fn();
      completeProcess(id);
    } catch (err: any) {
      failProcess(id, err.message);
    }
    resolve(id);
  });
}

setInterval(() => {
  broadcastAll();
}, 2000);

// ═══════════════════════════════════════════════════════════════
// ITEMS 71-80: Process & Resource Management — Sovereign-Aware
// ═══════════════════════════════════════════════════════════════

// ── 71: Memory usage trending — track heap over time for leak detection ──

interface MemorySample {
  timestamp: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
}

const memoryTrend: MemorySample[] = [];
const MEMORY_TREND_MAX = 360;

function sampleMemory() {
  const mem = process.memoryUsage();
  memoryTrend.push({
    timestamp: Date.now(),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
    rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
    externalMB: Math.round(mem.external / 1024 / 1024 * 100) / 100,
  });
  if (memoryTrend.length > MEMORY_TREND_MAX) memoryTrend.shift();
}

setInterval(sampleMemory, 10000);
sampleMemory();

function getMemoryTrend() {
  const samples = memoryTrend;
  if (samples.length < 2) return { samples, leakSuspected: false, trend: "insufficient_data" };
  const recent = samples.slice(-30);
  const first = recent[0].heapUsedMB;
  const last = recent[recent.length - 1].heapUsedMB;
  const growthMB = last - first;
  const growthPercent = first > 0 ? Math.round((growthMB / first) * 100) : 0;
  const leakSuspected = growthPercent > 20 && recent.length >= 10;
  return {
    samples: samples.slice(-60),
    currentHeapMB: last,
    growthMB: Math.round(growthMB * 100) / 100,
    growthPercent,
    leakSuspected,
    trend: growthPercent > 10 ? "growing" : growthPercent < -10 ? "shrinking" : "stable",
    sampleCount: samples.length,
  };
}

// ── 72: CPU load monitoring via os module ──

interface CpuSample {
  timestamp: number;
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
  cpuPercent: number;
}

const cpuTrend: CpuSample[] = [];
let prevCpuInfo: os.CpuInfo[] | null = null;

function sampleCpu() {
  const loadAvg = os.loadavg();
  const cpus = os.cpus();
  let cpuPercent = 0;
  if (prevCpuInfo && prevCpuInfo.length === cpus.length) {
    let totalIdle = 0, totalTick = 0;
    for (let i = 0; i < cpus.length; i++) {
      const prev = prevCpuInfo[i].times;
      const curr = cpus[i].times;
      const idle = curr.idle - prev.idle;
      const total = (curr.user - prev.user) + (curr.nice - prev.nice) + (curr.sys - prev.sys) + (curr.irq - prev.irq) + idle;
      totalIdle += idle;
      totalTick += total;
    }
    cpuPercent = totalTick > 0 ? Math.round((1 - totalIdle / totalTick) * 100) : 0;
  }
  prevCpuInfo = cpus;
  cpuTrend.push({
    timestamp: Date.now(),
    loadAvg1: Math.round(loadAvg[0] * 100) / 100,
    loadAvg5: Math.round(loadAvg[1] * 100) / 100,
    loadAvg15: Math.round(loadAvg[2] * 100) / 100,
    cpuPercent,
  });
  if (cpuTrend.length > MEMORY_TREND_MAX) cpuTrend.shift();
}

setInterval(sampleCpu, 10000);
sampleCpu();

function getCpuMonitor() {
  const latest = cpuTrend[cpuTrend.length - 1];
  return {
    current: latest || null,
    cores: os.cpus().length,
    model: os.cpus()[0]?.model || "Unknown",
    samples: cpuTrend.slice(-60),
  };
}

// ── 73: Disk space monitoring for the Sovereign workspace ──

function getDiskUsage() {
  try {
    const dfOutput = execSync("df -h /home/runner 2>/dev/null || df -h . 2>/dev/null", { timeout: 5000 }).toString();
    const lines = dfOutput.trim().split("\n");
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      return {
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usePercent: parts[4],
        mountedOn: parts[5],
      };
    }
  } catch {}
  try {
    const duOutput = execSync("du -sh /home/runner/workspace 2>/dev/null || du -sh . 2>/dev/null", { timeout: 5000 }).toString();
    const parts = duOutput.trim().split(/\s+/);
    return { workspaceSize: parts[0], path: parts[1] };
  } catch {}
  return { error: "Unable to determine disk usage" };
}

// ── 74: Active connection counting (WebSocket, HTTP) ──

let activeHttpConnections = 0;
let totalHttpRequests = 0;
let activeWebSocketConnections = 0;

export function trackHttpConnection(isOpen: boolean) {
  if (isOpen) { activeHttpConnections++; totalHttpRequests++; }
  else { activeHttpConnections = Math.max(0, activeHttpConnections - 1); }
}

export function trackWebSocketConnection(isOpen: boolean) {
  if (isOpen) activeWebSocketConnections++;
  else activeWebSocketConnections = Math.max(0, activeWebSocketConnections - 1);
}

function getConnectionCounts() {
  return {
    activeHttp: activeHttpConnections,
    activeWebSocket: activeWebSocketConnections,
    activeSse: state.sseClients.size,
    totalHttpRequests,
  };
}

// ── 75: Request rate monitoring — requests per second tracking ──

interface RequestRateBucket {
  timestamp: number;
  count: number;
}

const requestRateBuckets: RequestRateBucket[] = [];
let currentBucketSecond = 0;
let currentBucketCount = 0;

export function recordRequest() {
  const nowSecond = Math.floor(Date.now() / 1000);
  if (nowSecond === currentBucketSecond) {
    currentBucketCount++;
  } else {
    if (currentBucketSecond > 0) {
      requestRateBuckets.push({ timestamp: currentBucketSecond * 1000, count: currentBucketCount });
      if (requestRateBuckets.length > 300) requestRateBuckets.shift();
    }
    currentBucketSecond = nowSecond;
    currentBucketCount = 1;
  }
}

function getRequestRate() {
  const buckets = requestRateBuckets.slice(-60);
  if (buckets.length === 0) return { currentRps: 0, avgRps: 0, peakRps: 0, buckets: [] };
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const peak = Math.max(...buckets.map(b => b.count));
  return {
    currentRps: currentBucketCount,
    avgRps: Math.round((total / buckets.length) * 100) / 100,
    peakRps: peak,
    buckets: buckets.slice(-30),
  };
}

// ── 76: Slow request detection — log requests taking >5 seconds ──

interface SlowRequest {
  timestamp: number;
  method: string;
  path: string;
  durationMs: number;
}

const slowRequests: SlowRequest[] = [];
const SLOW_THRESHOLD_MS = 5000;

export function recordSlowRequest(method: string, path: string, durationMs: number) {
  if (durationMs >= SLOW_THRESHOLD_MS) {
    slowRequests.push({ timestamp: Date.now(), method, path, durationMs });
    if (slowRequests.length > 100) slowRequests.shift();
  }
}

function getSlowRequests() {
  return {
    threshold: SLOW_THRESHOLD_MS,
    count: slowRequests.length,
    recent: slowRequests.slice(-20),
  };
}

// ── 77: Background task inventory — list all running intervals/timeouts ──

interface RegisteredTask {
  id: string;
  name: string;
  type: "interval" | "timeout" | "continuous";
  intervalMs?: number;
  registeredAt: number;
  lastRunAt?: number;
  runCount: number;
}

const backgroundTasks = new Map<string, RegisteredTask>();

export function registerBackgroundTask(id: string, name: string, type: RegisteredTask["type"], intervalMs?: number) {
  backgroundTasks.set(id, {
    id,
    name,
    type,
    intervalMs,
    registeredAt: Date.now(),
    runCount: 0,
  });
}

export function recordBackgroundTaskRun(id: string) {
  const task = backgroundTasks.get(id);
  if (task) {
    task.lastRunAt = Date.now();
    task.runCount++;
  }
}

export function unregisterBackgroundTask(id: string) {
  backgroundTasks.delete(id);
}

function getBackgroundTaskInventory() {
  return Array.from(backgroundTasks.values());
}

// ── 78: Process restart detection — know when the server was restarted ──

const serverStartTime = Date.now();
let restartCount = 0;

try {
  const restartFile = "/tmp/tessera-restart-count.json";
  if (fs.existsSync(restartFile)) {
    const data = JSON.parse(fs.readFileSync(restartFile, "utf8"));
    restartCount = (data.count || 0) + 1;
  }
  fs.writeFileSync(restartFile, JSON.stringify({ count: restartCount, lastStart: serverStartTime }));
} catch {}

export function getRestartInfo() {
  return {
    serverStartTime,
    serverStartISO: new Date(serverStartTime).toISOString(),
    uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
    uptimeFormatted: formatUptime(Math.floor((Date.now() - serverStartTime) / 1000)),
    restartCount,
    pid: process.pid,
    nodeVersion: process.version,
  };
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

// ── 79: Environment fingerprinting — capture Sovereign env details ──

function getEnvironmentFingerprint() {
  const env = process.env;
  return {
    platform: "TesseraOS Sovereign",
    arch: process.arch,
    nodeVersion: process.version,
    pid: process.pid,
    replId: env.REPL_ID || null,
    replSlug: env.REPL_SLUG || null,
    replOwner: env.REPL_OWNER || null,
    sovereignCluster: env.SOVEREIGN_CLUSTER || null,
    sovereignDeployment: env.SOVEREIGN_DEPLOYMENT || null,
    home: env.HOME || null,
    hostname: os.hostname(),
    totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
    freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
    cpuCores: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || "Unknown",
    osRelease: os.release(),
    osType: os.type(),
  };
}

// ── 80: Resource usage alerts — warn when approaching limits ──

interface ResourceAlert {
  timestamp: number;
  level: "warning" | "critical";
  resource: string;
  message: string;
  value: number;
  threshold: number;
}

const resourceAlerts: ResourceAlert[] = [];

function checkResourceAlerts(): ResourceAlert[] {
  const newAlerts: ResourceAlert[] = [];
  const mem = process.memoryUsage();
  const heapPercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);
  const rssMB = Math.round(mem.rss / 1024 / 1024);

  if (heapPercent > 90) {
    newAlerts.push({ timestamp: Date.now(), level: "critical", resource: "heap", message: `Heap usage at ${heapPercent}% — critical`, value: heapPercent, threshold: 90 });
  } else if (heapPercent > 75) {
    newAlerts.push({ timestamp: Date.now(), level: "warning", resource: "heap", message: `Heap usage at ${heapPercent}% — elevated`, value: heapPercent, threshold: 75 });
  }

  if (rssMB > 900) {
    newAlerts.push({ timestamp: Date.now(), level: "critical", resource: "rss", message: `RSS memory at ${rssMB}MB — near limit`, value: rssMB, threshold: 900 });
  } else if (rssMB > 700) {
    newAlerts.push({ timestamp: Date.now(), level: "warning", resource: "rss", message: `RSS memory at ${rssMB}MB — elevated`, value: rssMB, threshold: 700 });
  }

  const loadAvg = os.loadavg()[0];
  const cores = os.cpus().length;
  if (loadAvg > cores * 2) {
    newAlerts.push({ timestamp: Date.now(), level: "critical", resource: "cpu", message: `Load average ${loadAvg.toFixed(2)} exceeds ${cores * 2} (2x cores)`, value: loadAvg, threshold: cores * 2 });
  } else if (loadAvg > cores) {
    newAlerts.push({ timestamp: Date.now(), level: "warning", resource: "cpu", message: `Load average ${loadAvg.toFixed(2)} exceeds core count ${cores}`, value: loadAvg, threshold: cores });
  }

  const freeMemPercent = Math.round((os.freemem() / os.totalmem()) * 100);
  if (freeMemPercent < 5) {
    newAlerts.push({ timestamp: Date.now(), level: "critical", resource: "system_memory", message: `Only ${freeMemPercent}% system memory free`, value: freeMemPercent, threshold: 5 });
  } else if (freeMemPercent < 15) {
    newAlerts.push({ timestamp: Date.now(), level: "warning", resource: "system_memory", message: `Only ${freeMemPercent}% system memory free`, value: freeMemPercent, threshold: 15 });
  }

  for (const alert of newAlerts) {
    resourceAlerts.push(alert);
  }
  if (resourceAlerts.length > 200) resourceAlerts.splice(0, resourceAlerts.length - 200);

  return newAlerts;
}

setInterval(checkResourceAlerts, 30000);
checkResourceAlerts();

function getResourceAlerts() {
  return {
    active: checkResourceAlerts(),
    history: resourceAlerts.slice(-50),
    totalAlerts: resourceAlerts.length,
  };
}

// ── Consolidated resource monitoring endpoint ──

export function getResourceMonitoring() {
  return {
    memory: getMemoryTrend(),
    cpu: getCpuMonitor(),
    disk: getDiskUsage(),
    connections: getConnectionCounts(),
    requestRate: getRequestRate(),
    slowRequests: getSlowRequests(),
    backgroundTasks: getBackgroundTaskInventory(),
    restart: getRestartInfo(),
    environment: getEnvironmentFingerprint(),
    alerts: getResourceAlerts(),
    surprises: getSurpriseDetectionState(),
    timestamp: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════
// ITEM 89: Surprise Detection — Recognizing the Unexpected
// ═══════════════════════════════════════════════════════════════

interface SurpriseEvent {
  id: string;
  type: "traffic_spike" | "error_burst" | "latency_anomaly" | "resource_spike" | "pattern_break" | "new_behavior";
  description: string;
  severity: "low" | "medium" | "high";
  expectedValue: number;
  actualValue: number;
  deviation: number;
  detectedAt: number;
  acknowledged: boolean;
}

interface BaselineMetrics {
  avgRequestsPerMinute: number;
  avgErrorRate: number;
  avgResponseLatency: number;
  avgHeapUsageMB: number;
  avgCpuPercent: number;
  sampleCount: number;
  lastUpdated: number;
}

const surpriseEvents: SurpriseEvent[] = [];
const baseline: BaselineMetrics = {
  avgRequestsPerMinute: 0,
  avgErrorRate: 0,
  avgResponseLatency: 0,
  avgHeapUsageMB: 0,
  avgCpuPercent: 0,
  sampleCount: 0,
  lastUpdated: Date.now(),
};

const SURPRISE_THRESHOLD = 2.0;

function updateBaseline() {
  const mem = process.memoryUsage();
  const heapMB = mem.heapUsed / 1024 / 1024;
  const loadAvg = os.loadavg()[0];
  const cpuPercent = Math.min(100, loadAvg * 25);

  const count = baseline.sampleCount;
  baseline.avgHeapUsageMB = ((baseline.avgHeapUsageMB * count) + heapMB) / (count + 1);
  baseline.avgCpuPercent = ((baseline.avgCpuPercent * count) + cpuPercent) / (count + 1);
  baseline.avgRequestsPerMinute = ((baseline.avgRequestsPerMinute * count) + (currentBucketCount * 60 / Math.max(1, Date.now() / 1000 - currentBucketSecond))) / (count + 1);
  baseline.sampleCount++;
  baseline.lastUpdated = Date.now();
}

function checkForSurprises(): SurpriseEvent[] {
  if (baseline.sampleCount < 5) return [];
  const newSurprises: SurpriseEvent[] = [];

  const mem = process.memoryUsage();
  const currentHeap = mem.heapUsed / 1024 / 1024;
  if (baseline.avgHeapUsageMB > 0) {
    const heapDeviation = (currentHeap - baseline.avgHeapUsageMB) / Math.max(1, baseline.avgHeapUsageMB);
    if (heapDeviation > SURPRISE_THRESHOLD) {
      newSurprises.push({
        id: `surp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "resource_spike",
        description: `Heap usage spike: ${currentHeap.toFixed(0)}MB vs baseline ${baseline.avgHeapUsageMB.toFixed(0)}MB`,
        severity: heapDeviation > 3 ? "high" : "medium",
        expectedValue: baseline.avgHeapUsageMB,
        actualValue: currentHeap,
        deviation: Math.round(heapDeviation * 100) / 100,
        detectedAt: Date.now(),
        acknowledged: false,
      });
    }
  }

  const loadAvg = os.loadavg()[0];
  const currentCpu = Math.min(100, loadAvg * 25);
  if (baseline.avgCpuPercent > 0) {
    const cpuDeviation = (currentCpu - baseline.avgCpuPercent) / Math.max(1, baseline.avgCpuPercent);
    if (cpuDeviation > SURPRISE_THRESHOLD) {
      newSurprises.push({
        id: `surp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "latency_anomaly",
        description: `CPU load spike: ${currentCpu.toFixed(0)}% vs baseline ${baseline.avgCpuPercent.toFixed(0)}%`,
        severity: cpuDeviation > 3 ? "high" : "medium",
        expectedValue: baseline.avgCpuPercent,
        actualValue: currentCpu,
        deviation: Math.round(cpuDeviation * 100) / 100,
        detectedAt: Date.now(),
        acknowledged: false,
      });
    }
  }

  if (slowRequests.length > 5) {
    const recentSlow = slowRequests.filter(r => Date.now() - r.timestamp < 60000);
    if (recentSlow.length >= 3) {
      newSurprises.push({
        id: `surp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "latency_anomaly",
        description: `${recentSlow.length} slow requests in last minute (threshold: ${SLOW_THRESHOLD_MS}ms)`,
        severity: recentSlow.length >= 5 ? "high" : "medium",
        expectedValue: 0,
        actualValue: recentSlow.length,
        deviation: recentSlow.length,
        detectedAt: Date.now(),
        acknowledged: false,
      });
    }
  }

  for (const s of newSurprises) {
    surpriseEvents.push(s);
  }
  if (surpriseEvents.length > 200) surpriseEvents.splice(0, 100);

  return newSurprises;
}

export function getSurpriseDetectionState(): {
  recentSurprises: SurpriseEvent[];
  unacknowledged: number;
  baseline: BaselineMetrics;
  totalSurprises: number;
} {
  return {
    recentSurprises: surpriseEvents.slice(-20),
    unacknowledged: surpriseEvents.filter(s => !s.acknowledged).length,
    baseline: { ...baseline },
    totalSurprises: surpriseEvents.length,
  };
}

export function acknowledgeSurprise(id: string) {
  const surprise = surpriseEvents.find(s => s.id === id);
  if (surprise) surprise.acknowledged = true;
}

setInterval(() => {
  updateBaseline();
  checkForSurprises();
}, 30000);
