import os from "os";
import { appendAuditLog } from "./pg-audit-trail";

const zlog = (msg: string) => console.log(`[ZScoreMonitor] ${msg}`);

interface MetricSample {
  value: number;
  timestamp: number;
}

interface MetricWindow {
  samples: MetricSample[];
  maxSamples: number;
}

const Z_SCORE_THRESHOLD = 2.5;
const MIN_SAMPLES_FOR_DETECTION = 10;
const COLLECTION_INTERVAL_MS = 30 * 1000;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

type MetricKey = "cpuLoad" | "memUsedPct" | "heapUsedMB" | "requestRate" | "errorRate";

const metrics: Record<MetricKey, MetricWindow> = {
  cpuLoad:     { samples: [], maxSamples: 120 },
  memUsedPct:  { samples: [], maxSamples: 120 },
  heapUsedMB:  { samples: [], maxSamples: 120 },
  requestRate: { samples: [], maxSamples: 60 },
  errorRate:   { samples: [], maxSamples: 60 },
};

const lastAlertTime: Record<MetricKey, number> = {
  cpuLoad: 0, memUsedPct: 0, heapUsedMB: 0, requestRate: 0, errorRate: 0,
};

let requestCounter = 0;
let errorCounter = 0;
let lastRateWindowStart = Date.now();
let monitorInterval: NodeJS.Timeout | null = null;

export function incrementRequestCounter() { requestCounter++; }
export function incrementErrorCounter() { errorCounter++; }

function addSample(key: MetricKey, value: number) {
  const window = metrics[key];
  window.samples.push({ value, timestamp: Date.now() });
  if (window.samples.length > window.maxSamples) {
    window.samples.shift();
  }
}

function computeStats(samples: MetricSample[]): { mean: number; stddev: number } {
  if (samples.length === 0) return { mean: 0, stddev: 0 };
  const values = samples.map(s => s.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return { mean, stddev: Math.sqrt(variance) };
}

function zScore(value: number, mean: number, stddev: number): number {
  if (stddev === 0) return 0;
  return Math.abs((value - mean) / stddev);
}

function getCpuLoad(): number {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const [, time] of Object.entries(cpu.times)) {
      totalTick += time;
    }
    totalIdle += cpu.times.idle;
  }
  return 100 - (100 * totalIdle / totalTick);
}

function checkAnomaly(key: MetricKey, currentValue: number, label: string, unit: string, threshold?: number): void {
  addSample(key, currentValue);
  const window = metrics[key];

  if (window.samples.length < MIN_SAMPLES_FOR_DETECTION) return;

  const historical = window.samples.slice(0, -1);
  const { mean, stddev } = computeStats(historical);
  const z = zScore(currentValue, mean, stddev);

  const isStatisticalAnomaly = z >= Z_SCORE_THRESHOLD;
  const isThresholdBreach = threshold !== undefined && currentValue > threshold;

  if (!isStatisticalAnomaly && !isThresholdBreach) return;

  const now = Date.now();
  if (now - lastAlertTime[key] < ALERT_COOLDOWN_MS) return;
  lastAlertTime[key] = now;

  const reason = isStatisticalAnomaly && isThresholdBreach
    ? `z-score=${z.toFixed(2)} AND threshold breach`
    : isStatisticalAnomaly
    ? `z-score=${z.toFixed(2)} (threshold=${Z_SCORE_THRESHOLD})`
    : `threshold breach (>${threshold}${unit})`;

  const severity = (isThresholdBreach && threshold! > 90) || (isStatisticalAnomaly && z > 4)
    ? "CRITICAL"
    : "HIGH";

  const message = `[${severity}] ${label} anomaly: current=${currentValue.toFixed(2)}${unit}, mean=${mean.toFixed(2)}${unit}, stddev=${stddev.toFixed(2)} — ${reason}`;
  console.error(`[ZScoreMonitor] ${message}`);

  appendAuditLog("anomaly_alert", "zscore_monitor", label, "anomaly_detected", {
    metric: key,
    current: currentValue,
    mean: mean.toFixed(2),
    stddev: stddev.toFixed(2),
    zScore: z.toFixed(2),
    severity,
    reason,
  }).catch(() => {});
}

function collectMetrics(): void {
  const mem = process.memoryUsage();
  const heapMB = mem.heapUsed / 1024 / 1024;
  const totalMemMB = os.totalmem() / 1024 / 1024;
  const freeMemMB = os.freemem() / 1024 / 1024;
  const memUsedPct = ((totalMemMB - freeMemMB) / totalMemMB) * 100;
  const cpuLoad = getCpuLoad();

  const now = Date.now();
  const windowSec = (now - lastRateWindowStart) / 1000;

  const currentReqRate = windowSec > 0 ? requestCounter / windowSec : 0;
  const currentErrRate = requestCounter > 0 ? (errorCounter / requestCounter) * 100 : 0;

  checkAnomaly("cpuLoad",    cpuLoad,      "CPU Load",       "%",  85);
  checkAnomaly("memUsedPct", memUsedPct,   "Memory Usage",   "%",  90);
  checkAnomaly("heapUsedMB", heapMB,       "Heap Memory",    "MB", 800);
  checkAnomaly("requestRate", currentReqRate, "Request Rate", "req/s");
  checkAnomaly("errorRate",  currentErrRate, "Error Rate",   "%",  10);

  if (windowSec >= 60) {
    requestCounter = 0;
    errorCounter = 0;
    lastRateWindowStart = now;
  }
}

export function startZScoreMonitor(): void {
  if (monitorInterval) return;
  monitorInterval = setInterval(collectMetrics, COLLECTION_INTERVAL_MS);
  zlog(`Z-score anomaly monitor started — collecting every ${COLLECTION_INTERVAL_MS / 1000}s, threshold z=${Z_SCORE_THRESHOLD}`);
}

export function stopZScoreMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    zlog("Z-score monitor stopped");
  }
}

export function getZScoreMetricStatus(): {
  metrics: Record<string, { current: number; mean: number; stddev: number; zScore: number; sampleCount: number }>;
  thresholds: Record<MetricKey, number | null>;
  alertCooldownMs: number;
} {
  const result: Record<string, { current: number; mean: number; stddev: number; zScore: number; sampleCount: number }> = {};

  for (const [key, window] of Object.entries(metrics) as [MetricKey, MetricWindow][]) {
    if (window.samples.length === 0) {
      result[key] = { current: 0, mean: 0, stddev: 0, zScore: 0, sampleCount: 0 };
      continue;
    }
    const current = window.samples[window.samples.length - 1].value;
    const historical = window.samples.slice(0, -1);
    const { mean, stddev } = computeStats(historical);
    result[key] = {
      current: parseFloat(current.toFixed(3)),
      mean: parseFloat(mean.toFixed(3)),
      stddev: parseFloat(stddev.toFixed(3)),
      zScore: parseFloat(zScore(current, mean, stddev).toFixed(3)),
      sampleCount: window.samples.length,
    };
  }

  return {
    metrics: result,
    thresholds: { cpuLoad: 85, memUsedPct: 90, heapUsedMB: 800, requestRate: null, errorRate: 10 },
    alertCooldownMs: ALERT_COOLDOWN_MS,
  };
}
