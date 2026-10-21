import { trackSuspiciousActivity } from "./security-fortress";
import { logThreat } from "./security";

const adLog = (msg: string) => console.log(`[AnomalyDetection] ${msg}`);

interface AnomalyEvent {
  id: string;
  timestamp: number;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: string;
  source: string;
  metadata?: Record<string, any>;
}

const anomalyLog: AnomalyEvent[] = [];

function recordAnomaly(type: string, severity: AnomalyEvent["severity"], details: string, source: string, metadata?: Record<string, any>): void {
  const event: AnomalyEvent = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    timestamp: Date.now(),
    type,
    severity,
    details,
    source,
    metadata,
  };
  anomalyLog.unshift(event);
  if (anomalyLog.length > 500) anomalyLog.length = 500;
  adLog(`[${severity}] ${type}: ${details} (source: ${source})`);
  trackSuspiciousActivity(source, type, type, severity);
  if (severity === "HIGH" || severity === "CRITICAL") {
    logThreat(type, details, source, severity === "CRITICAL" ? "critical" : "high", "anomaly_detected");
  }
}

const ipEndpointMap = new Map<string, { endpoints: string[]; timestamps: number[] }>();
const IP_SCAN_WINDOW_MS = 30000;
const IP_SCAN_THRESHOLD = 20;

export function detectEndpointScanning(ip: string, endpoint: string): void {
  if (!ip || ip === "0.0.0.0" || ip === "::1" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) return;

  const now = Date.now();
  const entry = ipEndpointMap.get(ip) || { endpoints: [], timestamps: [] };

  entry.endpoints.push(endpoint);
  entry.timestamps.push(now);

  const cutoff = now - IP_SCAN_WINDOW_MS;
  const validIdx = entry.timestamps.findIndex(t => t >= cutoff);
  if (validIdx > 0) {
    entry.endpoints = entry.endpoints.slice(validIdx);
    entry.timestamps = entry.timestamps.slice(validIdx);
  }

  ipEndpointMap.set(ip, entry);

  const recentEndpoints = new Set(entry.endpoints);
  if (recentEndpoints.size >= IP_SCAN_THRESHOLD) {
    recordAnomaly(
      "endpoint-scan",
      "HIGH",
      `IP ${ip} accessed ${recentEndpoints.size} unique endpoints in ${IP_SCAN_WINDOW_MS / 1000}s`,
      ip,
      { uniqueEndpoints: recentEndpoints.size, window: IP_SCAN_WINDOW_MS }
    );
    ipEndpointMap.delete(ip);
  }
}

const failedAuthTracker = new Map<string, { count: number; firstSeen: number; lastSeen: number }>();
const FAILED_AUTH_WINDOW_MS = 5 * 60 * 1000;
const FAILED_AUTH_SPIKE_THRESHOLD = 10;
let globalFailedAuthCount = 0;
let globalFailedAuthWindowStart = Date.now();
const GLOBAL_AUTH_SPIKE_THRESHOLD = 50;
const GLOBAL_AUTH_WINDOW_MS = 60 * 1000;

export function detectFailedAuthSpike(ip: string, endpoint: string): void {
  const now = Date.now();

  const entry = failedAuthTracker.get(ip) || { count: 0, firstSeen: now, lastSeen: now };
  if (now - entry.firstSeen > FAILED_AUTH_WINDOW_MS) {
    entry.count = 1;
    entry.firstSeen = now;
  } else {
    entry.count++;
  }
  entry.lastSeen = now;
  failedAuthTracker.set(ip, entry);

  if (entry.count === FAILED_AUTH_SPIKE_THRESHOLD) {
    recordAnomaly(
      "failed-auth-spike",
      "CRITICAL",
      `IP ${ip} had ${entry.count} failed auth attempts in ${FAILED_AUTH_WINDOW_MS / 1000}s on ${endpoint}`,
      ip,
      { endpoint, count: entry.count }
    );
  }

  if (now - globalFailedAuthWindowStart > GLOBAL_AUTH_WINDOW_MS) {
    globalFailedAuthCount = 0;
    globalFailedAuthWindowStart = now;
  }
  globalFailedAuthCount++;
  if (globalFailedAuthCount === GLOBAL_AUTH_SPIKE_THRESHOLD) {
    recordAnomaly(
      "global-auth-spike",
      "CRITICAL",
      `Global failed auth spike: ${globalFailedAuthCount} failures in ${GLOBAL_AUTH_WINDOW_MS / 1000}s`,
      "global",
      { count: globalFailedAuthCount }
    );
  }
}

const unusualHoursAccessMap = new Map<string, number[]>();
const UNUSUAL_HOUR_THRESHOLD = 5;

export function detectUnusualAccessPattern(ip: string, endpoint: string, userAgent: string): void {
  if (!ip || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) return;

  const hour = new Date().getUTCHours();
  const isUnusualHour = hour >= 1 && hour <= 5;

  if (isUnusualHour && !userAgent.includes("Mozilla") && !userAgent.includes("Chrome") && !userAgent.includes("Safari")) {
    const hours = unusualHoursAccessMap.get(ip) || [];
    hours.push(Date.now());
    const recent = hours.filter(t => Date.now() - t < 15 * 60 * 1000);
    unusualHoursAccessMap.set(ip, recent);

    if (recent.length === UNUSUAL_HOUR_THRESHOLD) {
      recordAnomaly(
        "unusual-access-pattern",
        "MEDIUM",
        `Non-browser IP ${ip} accessing at unusual hour (${hour}:00 UTC), endpoint: ${endpoint}`,
        ip,
        { hour, userAgent: userAgent.slice(0, 80), endpoint }
      );
    }
  }

  if (
    /bot|crawler|spider|scan|scrape|harvest|python-requests|go-http|java|libwww|curl\/[0-7]|wget/i.test(userAgent) &&
    endpoint.startsWith("/api/")
  ) {
    recordAnomaly(
      "automated-api-access",
      "LOW",
      `Automated tool accessing API: UA="${userAgent.slice(0, 60)}", endpoint=${endpoint}`,
      ip,
      { userAgent: userAgent.slice(0, 80), endpoint }
    );
  }
}

const largePayloadTracker = new Map<string, number[]>();
const LARGE_PAYLOAD_THRESHOLD_BYTES = 100 * 1024;
const LARGE_PAYLOAD_COUNT_THRESHOLD = 5;

export function detectLargePayloadAnomaly(ip: string, endpoint: string, payloadSize: number): void {
  if (payloadSize < LARGE_PAYLOAD_THRESHOLD_BYTES) return;

  const sizes = largePayloadTracker.get(ip) || [];
  sizes.push(payloadSize);
  if (sizes.length > 20) sizes.splice(0, sizes.length - 20);
  largePayloadTracker.set(ip, sizes);

  const recentLarge = sizes.filter(s => s >= LARGE_PAYLOAD_THRESHOLD_BYTES);
  if (recentLarge.length >= LARGE_PAYLOAD_COUNT_THRESHOLD) {
    recordAnomaly(
      "large-payload-flood",
      "HIGH",
      `IP ${ip} sent ${recentLarge.length} large payloads (avg ${Math.round(recentLarge.reduce((a, b) => a + b, 0) / recentLarge.length / 1024)}KB) to ${endpoint}`,
      ip,
      { endpoint, count: recentLarge.length, avgKB: Math.round(recentLarge.reduce((a, b) => a + b, 0) / recentLarge.length / 1024) }
    );
    largePayloadTracker.delete(ip);
  }
}

const methodAnomalyTracker = new Map<string, string[]>();
const UNUSUAL_METHODS = ["TRACE", "TRACK", "DEBUG", "CONNECT", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK", "SEARCH"];

export function detectUnusualHttpMethod(ip: string, method: string, endpoint: string): void {
  if (UNUSUAL_METHODS.includes(method.toUpperCase())) {
    recordAnomaly(
      "unusual-http-method",
      "MEDIUM",
      `Unusual HTTP method ${method} from ${ip} on ${endpoint}`,
      ip,
      { method, endpoint }
    );
  }

  const methods = methodAnomalyTracker.get(ip) || [];
  methods.push(method);
  if (methods.length > 50) methods.splice(0, methods.length - 50);
  methodAnomalyTracker.set(ip, methods);

  const recent = methods.slice(-10);
  const uniqueMethods = new Set(recent);
  if (uniqueMethods.size >= 5) {
    recordAnomaly(
      "method-probing",
      "MEDIUM",
      `IP ${ip} using ${uniqueMethods.size} different HTTP methods — possible scanner`,
      ip,
      { methods: [...uniqueMethods] }
    );
    methodAnomalyTracker.delete(ip);
  }
}

const processAnomalyCounters = { checkCount: 0, lastMemoryMB: 0, highMemoryAlerts: 0 };

export function detectProcessBehaviorAnomaly(): void {
  processAnomalyCounters.checkCount++;
  const mem = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);

  if (heapMB > 800) {
    processAnomalyCounters.highMemoryAlerts++;
    recordAnomaly(
      "high-memory-usage",
      "HIGH",
      `Process heap at ${heapMB}MB (RSS: ${rssMB}MB) — potential memory leak or DoS`,
      "process",
      { heapMB, rssMB }
    );
  }

  const growth = heapMB - processAnomalyCounters.lastMemoryMB;
  if (processAnomalyCounters.lastMemoryMB > 0 && growth > 100) {
    recordAnomaly(
      "memory-spike",
      "MEDIUM",
      `Memory grew ${growth}MB in one check interval (now ${heapMB}MB)`,
      "process",
      { previousMB: processAnomalyCounters.lastMemoryMB, currentMB: heapMB, growthMB: growth }
    );
  }

  processAnomalyCounters.lastMemoryMB = heapMB;
}

let processMonitorInterval: NodeJS.Timeout | null = null;

export function startAnomalyDetection(): void {
  if (processMonitorInterval) return;
  processMonitorInterval = setInterval(detectProcessBehaviorAnomaly, 60 * 1000);
  adLog("Enhanced anomaly detection active — endpoint scanning, failed-auth spikes, unusual patterns, process behavior");
}

export function stopAnomalyDetection(): void {
  if (processMonitorInterval) {
    clearInterval(processMonitorInterval);
    processMonitorInterval = null;
  }
}

export function getAnomalyStats(): {
  total: number;
  last24h: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  recent: AnomalyEvent[];
} {
  const now = Date.now();
  const last24h = anomalyLog.filter(a => now - a.timestamp < 86400000);
  const bySeverity: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const a of last24h) {
    bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
    byType[a.type] = (byType[a.type] || 0) + 1;
  }
  return {
    total: anomalyLog.length,
    last24h: last24h.length,
    bySeverity,
    byType,
    recent: anomalyLog.slice(0, 20),
  };
}
