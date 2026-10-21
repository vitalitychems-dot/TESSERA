const log = (m: string) => console.log(`[SovereigntyMonitor] ${m}`);

type DisconnectMode = "normal" | "dry-run" | "hard-disconnect";

interface SovereigntyMetrics {
  sovereignCalls: number;
  externalCalls: number;
  sovereignRatio: number;
  localModelsAvailable: number;
  localModelsActive: number;
  performanceParity: Record<string, { local: number; external: number; parity: number }>;
  reliabilityInternal: number;
  reliabilityExternal: number;
  costSaved: number;
  disconnectMode: DisconnectMode;
  disconnectThreshold: number;
  readyForDisconnect: boolean;
  lastEvaluated: number;
}

interface CallRecord {
  providerId: string;
  isSovereign: boolean;
  latencyMs: number;
  success: boolean;
  timestamp: number;
  domain?: string;
}

const SOVEREIGN_PATTERNS = [
  /localhost/i, /127\.0\.0\.1/, /ollama/i, /lmstudio|lm.studio/i,
  /llama\.cpp/i, /vllm/i, /text-generation/i, /local/i,
];

let disconnectMode: DisconnectMode = "normal";
let disconnectThreshold = 0.7;
const callHistory: CallRecord[] = [];
const MAX_CALL_HISTORY = 50000;
const performanceByDomain = new Map<string, { localLatencies: number[]; externalLatencies: number[] }>();

export function recordCall(
  providerId: string,
  providerUrl: string,
  latencyMs: number,
  success: boolean,
  domain?: string,
): void {
  const isSovereign = SOVEREIGN_PATTERNS.some(p => p.test(providerUrl) || p.test(providerId));

  const record: CallRecord = { providerId, isSovereign, latencyMs, success, timestamp: Date.now(), domain };
  callHistory.push(record);

  while (callHistory.length > MAX_CALL_HISTORY) callHistory.shift();

  if (domain) {
    const domainStats = performanceByDomain.get(domain) || { localLatencies: [], externalLatencies: [] };
    if (isSovereign) {
      domainStats.localLatencies.push(latencyMs);
      if (domainStats.localLatencies.length > 500) domainStats.localLatencies.shift();
    } else {
      domainStats.externalLatencies.push(latencyMs);
      if (domainStats.externalLatencies.length > 500) domainStats.externalLatencies.shift();
    }
    performanceByDomain.set(domain, domainStats);
  }
}

export function shouldBlockExternal(providerId: string, providerUrl: string): { blocked: boolean; reason?: string } {
  if (disconnectMode === "normal") return { blocked: false };

  const isSovereign = SOVEREIGN_PATTERNS.some(p => p.test(providerUrl) || p.test(providerId));
  if (isSovereign) return { blocked: false };

  if (disconnectMode === "hard-disconnect") {
    return { blocked: true, reason: "Hard disconnect mode active — all external providers blocked" };
  }

  if (disconnectMode === "dry-run") {
    log(`[DRY-RUN] Would block external provider: ${providerId} (${providerUrl})`);
    return { blocked: false, reason: "Dry-run: would be blocked in hard-disconnect mode" };
  }

  return { blocked: false };
}

export function setDisconnectMode(mode: DisconnectMode): void {
  const previous = disconnectMode;
  disconnectMode = mode;
  log(`Disconnect mode changed: ${previous} → ${mode}`);
}

export function setDisconnectThreshold(threshold: number): void {
  disconnectThreshold = Math.max(0, Math.min(1, threshold));
  log(`Disconnect threshold set to ${(disconnectThreshold * 100).toFixed(0)}%`);
}

export function getDisconnectMode(): DisconnectMode {
  return disconnectMode;
}

function computePerformanceParity(): Record<string, { local: number; external: number; parity: number }> {
  const parity: Record<string, { local: number; external: number; parity: number }> = {};

  for (const [domain, stats] of performanceByDomain) {
    const localAvg = stats.localLatencies.length > 0
      ? stats.localLatencies.reduce((a, b) => a + b, 0) / stats.localLatencies.length
      : 0;
    const externalAvg = stats.externalLatencies.length > 0
      ? stats.externalLatencies.reduce((a, b) => a + b, 0) / stats.externalLatencies.length
      : 0;

    const parityScore = externalAvg > 0 && localAvg > 0
      ? Math.min(1, externalAvg / localAvg)
      : 0;

    parity[domain] = {
      local: Math.round(localAvg),
      external: Math.round(externalAvg),
      parity: Math.round(parityScore * 100) / 100,
    };
  }

  return parity;
}

export function evaluateSovereignty(): SovereigntyMetrics {
  const now = Date.now();
  const recentWindow = 30 * 60 * 1000;
  const recent = callHistory.filter(c => now - c.timestamp < recentWindow);

  const sovereignCalls = recent.filter(c => c.isSovereign).length;
  const externalCalls = recent.filter(c => !c.isSovereign).length;
  const total = sovereignCalls + externalCalls;
  const sovereignRatio = total > 0 ? sovereignCalls / total : 0;

  const sovereignSuccesses = recent.filter(c => c.isSovereign && c.success).length;
  const sovereignTotal = recent.filter(c => c.isSovereign).length;
  const externalSuccesses = recent.filter(c => !c.isSovereign && c.success).length;
  const externalTotal = recent.filter(c => !c.isSovereign).length;

  const reliabilityInternal = sovereignTotal > 0 ? sovereignSuccesses / sovereignTotal : 0;
  const reliabilityExternal = externalTotal > 0 ? externalSuccesses / externalTotal : 0;

  const estimatedCostPerExternalCall = 0.001;
  const costSaved = sovereignCalls * estimatedCostPerExternalCall;

  const performanceParity = computePerformanceParity();

  const localModelsAvailable = 2;
  const localModelsActive = recent.filter(c => c.isSovereign).length > 0 ? 1 : 0;

  const readyForDisconnect = sovereignRatio >= disconnectThreshold
    && reliabilityInternal >= 0.9
    && Object.values(performanceParity).filter(p => p.parity >= 0.8).length > 0;

  return {
    sovereignCalls,
    externalCalls,
    sovereignRatio: Math.round(sovereignRatio * 1000) / 1000,
    localModelsAvailable,
    localModelsActive,
    performanceParity,
    reliabilityInternal: Math.round(reliabilityInternal * 1000) / 1000,
    reliabilityExternal: Math.round(reliabilityExternal * 1000) / 1000,
    costSaved: Math.round(costSaved * 100) / 100,
    disconnectMode,
    disconnectThreshold,
    readyForDisconnect,
    lastEvaluated: now,
  };
}

export function getSovereigntyHistory(minutes = 60): Array<{
  window: string;
  sovereignRatio: number;
  totalCalls: number;
}> {
  const now = Date.now();
  const windowSize = 5 * 60 * 1000;
  const windows: Array<{ window: string; sovereignRatio: number; totalCalls: number }> = [];

  for (let i = 0; i < Math.ceil(minutes / 5); i++) {
    const windowEnd = now - i * windowSize;
    const windowStart = windowEnd - windowSize;
    const windowCalls = callHistory.filter(c => c.timestamp >= windowStart && c.timestamp < windowEnd);
    const sovereign = windowCalls.filter(c => c.isSovereign).length;
    const total = windowCalls.length;

    windows.push({
      window: new Date(windowStart).toISOString(),
      sovereignRatio: total > 0 ? Math.round((sovereign / total) * 1000) / 1000 : 0,
      totalCalls: total,
    });
  }

  return windows.reverse();
}

log(`Sovereignty monitor active — mode: ${disconnectMode}, threshold: ${(disconnectThreshold * 100).toFixed(0)}%`);

export type { SovereigntyMetrics, DisconnectMode, CallRecord };
