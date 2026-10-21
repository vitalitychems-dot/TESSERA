import { PROVIDER_REGISTRY, type ProviderSpec } from "./knowledge-infra-archive";

interface ProviderCallRecord {
  providerId: string;
  timestamp: number;
  success: boolean;
  statusCode: number;
  latencyMs: number;
  tokensUsed: number;
}

interface ErrorBreakdown {
  count429: number;
  count402: number;
  count400: number;
  count404: number;
  count401: number;
  count500: number;
  countOther: number;
}

interface ProviderHealth {
  providerId: string;
  totalCalls: number;
  successRate: number;
  avgLatency: number;
  last429: number;
  last401: number;
  last402: number;
  last404: number;
  last400: number;
  cooldownUntil: number;
  cooldownReason: string;
  callsThisMinute: number;
  callsThisHour: number;
  tokensThisMinute: number;
  optimalRPM: number;
  optimalTPM: number;
  backoffMultiplier: number;
  consecutive429s: number;
  consecutive401s: number;
  consecutive400s: number;
  velocityPerSecond: number;
  predictedThrottleAt: number;
  lastSuccessAt: number;
  errorBreakdown: ErrorBreakdown;
  healthScore: number;
}

const healthMap = new Map<string, ProviderHealth>();
const callHistory: ProviderCallRecord[] = [];
const MAX_HISTORY = 5000;
const requestQueue: Array<{ providerId: string; resolve: (ok: boolean) => void; enqueuedAt: number }> = [];

const healthScoreHistory = new Map<string, Array<{ timestamp: number; score: number }>>();
const MAX_HEALTH_HISTORY = 60;

function recordHealthSnapshot(providerId: string, score: number) {
  if (!healthScoreHistory.has(providerId)) healthScoreHistory.set(providerId, []);
  const history = healthScoreHistory.get(providerId)!;
  history.push({ timestamp: Date.now(), score });
  if (history.length > MAX_HEALTH_HISTORY) history.splice(0, history.length - MAX_HEALTH_HISTORY);
}

export function getProviderHealthHistory(providerId: string) {
  return healthScoreHistory.get(providerId) || [];
}

let totalPrevented429s = 0;
let totalPredictions = 0;

function getHealth(id: string): ProviderHealth {
  if (!healthMap.has(id)) {
    const spec = PROVIDER_REGISTRY.find(p => p.id === id);
    healthMap.set(id, {
      providerId: id,
      totalCalls: 0,
      successRate: 1.0,
      avgLatency: 500,
      last429: 0,
      last401: 0,
      last402: 0,
      last404: 0,
      last400: 0,
      cooldownUntil: 0,
      cooldownReason: "",
      callsThisMinute: 0,
      callsThisHour: 0,
      tokensThisMinute: 0,
      optimalRPM: spec?.rateLimit?.requestsPerMinute || 10,
      optimalTPM: spec?.rateLimit?.tokensPerMinute || 100000,
      backoffMultiplier: 1.0,
      consecutive429s: 0,
      consecutive401s: 0,
      consecutive400s: 0,
      velocityPerSecond: 0,
      predictedThrottleAt: 0,
      lastSuccessAt: 0,
      errorBreakdown: { count429: 0, count402: 0, count400: 0, count404: 0, count401: 0, count500: 0, countOther: 0 },
      healthScore: 100,
    });
  }
  return healthMap.get(id)!;
}

function computeVelocity(providerId: string): number {
  const now = Date.now();
  const last10s = callHistory.filter(c => c.providerId === providerId && c.timestamp > now - 10000);
  return last10s.length / 10;
}

function predictThrottle(providerId: string): number {
  const health = getHealth(providerId);
  const velocity = health.velocityPerSecond;
  if (velocity <= 0) return 0;

  const remainingCapacity = Math.max(0, health.optimalRPM - health.callsThisMinute);
  if (remainingCapacity <= 0) return Date.now();

  const secondsUntilFull = remainingCapacity / velocity;
  return Date.now() + secondsUntilFull * 1000;
}

function computeHealthScore(health: ProviderHealth): number {
  let score = 100;
  score -= (1 - health.successRate) * 40;
  score -= health.consecutive429s * 8;
  score -= health.consecutive401s * 12;
  score -= health.consecutive400s * 5;
  if (Date.now() < health.cooldownUntil) score -= 20;
  if (health.avgLatency > 5000) score -= 10;
  else if (health.avgLatency > 2000) score -= 5;
  const totalErrors = health.errorBreakdown.count429 + health.errorBreakdown.count402 + health.errorBreakdown.count400 + health.errorBreakdown.count404 + health.errorBreakdown.count401 + health.errorBreakdown.count500 + health.errorBreakdown.countOther;
  if (health.totalCalls > 0) {
    const errorRate = totalErrors / health.totalCalls;
    score -= errorRate * 30;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function computeSafetyMargin(health: ProviderHealth): number {
  if (health.consecutive429s >= 3) return 0.5;
  if (health.consecutive429s >= 1) return 0.7;
  if (health.successRate < 0.5) return 0.6;
  if (health.successRate < 0.8) return 0.8;
  return 0.9;
}

export function recordApiCall(providerId: string, success: boolean, statusCode: number, latencyMs: number, tokensUsed: number = 0) {
  const record: ProviderCallRecord = { providerId, timestamp: Date.now(), success, statusCode, latencyMs, tokensUsed };
  callHistory.push(record);
  if (callHistory.length > MAX_HISTORY) callHistory.splice(0, callHistory.length - MAX_HISTORY);

  const health = getHealth(providerId);
  health.totalCalls++;

  const now = Date.now();
  const recentCalls = callHistory.filter(c => c.providerId === providerId && c.timestamp > now - 300000);
  health.successRate = recentCalls.length > 0
    ? recentCalls.filter(c => c.success).length / recentCalls.length
    : 1.0;
  health.avgLatency = recentCalls.length > 0
    ? recentCalls.reduce((s, c) => s + c.latencyMs, 0) / recentCalls.length
    : 500;

  const oneMinAgo = now - 60000;
  const oneHourAgo = now - 3600000;
  const minuteCalls = callHistory.filter(c => c.providerId === providerId && c.timestamp > oneMinAgo);
  health.callsThisMinute = minuteCalls.length;
  health.callsThisHour = callHistory.filter(c => c.providerId === providerId && c.timestamp > oneHourAgo).length;
  health.tokensThisMinute = minuteCalls.reduce((sum, c) => sum + c.tokensUsed, 0);
  health.velocityPerSecond = computeVelocity(providerId);
  health.predictedThrottleAt = predictThrottle(providerId);

  if (statusCode === 429) {
    health.last429 = now;
    health.consecutive429s++;
    health.errorBreakdown.count429++;
    health.backoffMultiplier = Math.min(health.backoffMultiplier * 2, 32);
    const cooldownMs = Math.min(60000 * health.backoffMultiplier, 1800000);
    health.cooldownUntil = now + cooldownMs;
    health.cooldownReason = "rate-limited-429";
    health.optimalRPM = Math.max(1, Math.floor(health.optimalRPM * 0.5));
    console.log(`[RateLimitOpt] ${providerId} hit 429 (#${health.consecutive429s}) — cooldown ${Math.round(cooldownMs / 1000)}s, RPM→${health.optimalRPM}`);
  } else if (statusCode === 400) {
    health.last400 = now;
    health.consecutive400s++;
    health.errorBreakdown.count400++;
    const cooldownMs = health.consecutive400s >= 5 ? 3600000 : health.consecutive400s >= 3 ? 600000 : 120000;
    health.cooldownUntil = now + cooldownMs;
    health.cooldownReason = "bad-request-400";
    console.log(`[RateLimitOpt] ${providerId} got 400 (#${health.consecutive400s}) — cooldown ${Math.round(cooldownMs / 1000)}s`);
  } else if (statusCode === 402) {
    health.last402 = now;
    health.errorBreakdown.count402++;
    health.cooldownUntil = now + 7200000;
    health.cooldownReason = "payment-required-402";
    console.log(`[RateLimitOpt] ${providerId} got 402 (payment required) — disabled 2h`);
  } else if (statusCode === 401 || statusCode === 403) {
    health.last401 = now;
    health.consecutive401s++;
    health.errorBreakdown.count401++;
    const cooldownMs = health.consecutive401s >= 3 ? 86400000 : 3600000;
    health.cooldownUntil = now + cooldownMs;
    health.cooldownReason = `auth-failed-${statusCode}`;
    console.log(`[RateLimitOpt] ${providerId} got ${statusCode} (#${health.consecutive401s}) — disabled ${cooldownMs / 3600000}h`);
  } else if (statusCode === 404) {
    health.last404 = now;
    health.errorBreakdown.count404++;
    health.cooldownUntil = now + 7200000;
    health.cooldownReason = "not-found-404";
    console.log(`[RateLimitOpt] ${providerId} got 404 — disabled 2h`);
  } else if (statusCode >= 500) {
    health.errorBreakdown.count500++;
    health.cooldownUntil = now + 300000;
    health.cooldownReason = `server-error-${statusCode}`;
    console.log(`[RateLimitOpt] ${providerId} got ${statusCode} — cooldown 5min`);
  } else if (!success && statusCode > 0) {
    health.errorBreakdown.countOther++;
  } else if (success) {
    health.consecutive429s = 0;
    health.consecutive401s = 0;
    health.consecutive400s = 0;
    health.lastSuccessAt = now;
    health.backoffMultiplier = Math.max(1.0, health.backoffMultiplier * 0.85);
    const spec = PROVIDER_REGISTRY.find(p => p.id === providerId);
    if (spec) {
      health.optimalRPM = Math.min(
        spec.rateLimit?.requestsPerMinute || 60,
        Math.ceil(health.optimalRPM * 1.03)
      );
    }
  }

  health.healthScore = computeHealthScore(health);
  recordHealthSnapshot(health.providerId, health.healthScore);
}

export function canCallProvider(providerId: string): boolean {
  const health = getHealth(providerId);
  const now = Date.now();

  if (now < health.cooldownUntil) return false;

  const safetyMargin = computeSafetyMargin(health);
  const effectiveLimit = Math.floor(health.optimalRPM * safetyMargin);
  if (health.callsThisMinute >= effectiveLimit) {
    totalPredictions++;
    totalPrevented429s++;
    return false;
  }

  const spec = PROVIDER_REGISTRY.find(p => p.id === providerId);
  if (spec?.rateLimit?.tokensPerMinute) {
    if (health.tokensThisMinute >= spec.rateLimit.tokensPerMinute * safetyMargin) {
      totalPredictions++;
      totalPrevented429s++;
      return false;
    }
  }

  if (health.predictedThrottleAt > 0 && health.predictedThrottleAt < now + 2000) {
    totalPredictions++;
    return false;
  }

  return true;
}

export function shouldThrottlePreemptively(providerId: string): { throttle: boolean; waitMs: number; reason: string } {
  const health = getHealth(providerId);
  const now = Date.now();

  if (now < health.cooldownUntil) {
    return { throttle: true, waitMs: health.cooldownUntil - now, reason: "in-cooldown" };
  }

  const safetyMargin = computeSafetyMargin(health);
  const effectiveLimit = Math.floor(health.optimalRPM * safetyMargin);
  const utilization = health.callsThisMinute / Math.max(1, effectiveLimit);

  if (utilization >= 0.95) {
    const oldestInWindow = callHistory
      .filter(c => c.providerId === providerId && c.timestamp > now - 60000)
      .sort((a, b) => a.timestamp - b.timestamp)[0];
    const waitMs = oldestInWindow ? (oldestInWindow.timestamp + 60000) - now : 5000;
    return { throttle: true, waitMs: Math.max(1000, waitMs), reason: "near-limit" };
  }

  if (utilization >= 0.8 && health.velocityPerSecond > effectiveLimit / 60) {
    return { throttle: true, waitMs: 3000, reason: "velocity-spike" };
  }

  if (health.consecutive429s >= 2 && now - health.last429 < 120000) {
    return { throttle: true, waitMs: 10000, reason: "recent-429-burst" };
  }

  return { throttle: false, waitMs: 0, reason: "ok" };
}

export function getSmartDelay(providerId: string): number {
  const result = shouldThrottlePreemptively(providerId);
  return result.throttle ? result.waitMs : 0;
}

export async function waitForSlot(providerId: string, timeoutMs: number = 30000): Promise<boolean> {
  if (canCallProvider(providerId)) return true;

  const delay = getSmartDelay(providerId);
  if (delay <= 0 || delay > timeoutMs) return false;

  await new Promise(r => setTimeout(r, delay));
  return canCallProvider(providerId);
}

export function getBestProviderForTask(dimension: string, excludeIds: string[] = []): ProviderSpec | null {
  const candidates = PROVIDER_REGISTRY.filter(spec => {
    if (excludeIds.includes(spec.id)) return false;
    const isPrimary = spec.primary.includes(dimension as any);
    const isSecondary = spec.secondary.includes(dimension as any);
    if (!isPrimary && !isSecondary) return false;
    return canCallProvider(spec.id);
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const hA = getHealth(a.id);
    const hB = getHealth(b.id);
    const costWeight = (a.costTier - b.costTier) * 20;
    const successWeight = (hB.successRate - hA.successRate) * 100;
    const latencyWeight = (hA.avgLatency - hB.avgLatency) / 100;
    const primaryWeight = (a.primary.includes(dimension as any) ? 50 : 0) - (b.primary.includes(dimension as any) ? 50 : 0);
    const headroomA = 1 - (hA.callsThisMinute / Math.max(1, hA.optimalRPM));
    const headroomB = 1 - (hB.callsThisMinute / Math.max(1, hB.optimalRPM));
    const headroomWeight = (headroomB - headroomA) * 30;
    return costWeight + successWeight + latencyWeight - primaryWeight + headroomWeight;
  });

  return candidates[0];
}

export function getOptimalCallSchedule(): Array<{ providerId: string; nextCallIn: number; rpm: number; status: string; headroom: number }> {
  const schedule: Array<{ providerId: string; nextCallIn: number; rpm: number; status: string; headroom: number }> = [];

  for (const spec of PROVIDER_REGISTRY) {
    const health = getHealth(spec.id);
    let status = "ready";
    let nextCallIn = 0;
    const safetyMargin = computeSafetyMargin(health);
    const effectiveLimit = Math.floor(health.optimalRPM * safetyMargin);
    const headroom = Math.max(0, 1 - health.callsThisMinute / Math.max(1, effectiveLimit));

    if (Date.now() < health.cooldownUntil) {
      status = "cooldown";
      nextCallIn = health.cooldownUntil - Date.now();
    } else if (health.callsThisMinute >= effectiveLimit) {
      status = "at-limit";
      const oldestInWindow = callHistory
        .filter(c => c.providerId === spec.id && c.timestamp > Date.now() - 60000)
        .sort((a, b) => a.timestamp - b.timestamp)[0];
      nextCallIn = oldestInWindow ? (oldestInWindow.timestamp + 60000) - Date.now() : 5000;
    } else if (health.successRate < 0.3) {
      status = "degraded";
    } else if (headroom < 0.15) {
      status = "throttled";
    }

    schedule.push({
      providerId: spec.id,
      nextCallIn: Math.max(0, nextCallIn),
      rpm: health.optimalRPM,
      status,
      headroom: Math.round(headroom * 100),
    });
  }

  return schedule.sort((a, b) => {
    if (a.status === "ready" && b.status !== "ready") return -1;
    if (a.status !== "ready" && b.status === "ready") return 1;
    return a.nextCallIn - b.nextCallIn;
  });
}

export function getProviderHealthReport(): Record<string, any> {
  const report: Record<string, any> = {};
  for (const [id, health] of healthMap) {
    const safetyMargin = computeSafetyMargin(health);
    const now = Date.now();
    report[id] = {
      ...health,
      status: now < health.cooldownUntil ? "cooldown" : health.successRate < 0.3 ? "degraded" : health.healthScore < 50 ? "warning" : "healthy",
      cooldownRemaining: Math.max(0, health.cooldownUntil - now),
      safetyMargin,
      effectiveRPM: Math.floor(health.optimalRPM * safetyMargin),
      headroomPct: Math.round((1 - health.callsThisMinute / Math.max(1, Math.floor(health.optimalRPM * safetyMargin))) * 100),
      healthScore: health.healthScore,
      errorBreakdown: health.errorBreakdown,
      cooldownReason: health.cooldownReason,
      healthHistory: getProviderHealthHistory(id),
    };
  }
  return report;
}

export function getRateLimitStats() {
  return {
    totalPrevented429s,
    totalPredictions,
    activeProviders: getActiveProviderCount(),
    totalProviders: PROVIDER_REGISTRY.length,
    providersInCooldown: PROVIDER_REGISTRY.filter(spec => Date.now() < getHealth(spec.id).cooldownUntil).length,
    providersDegraded: PROVIDER_REGISTRY.filter(spec => getHealth(spec.id).successRate < 0.3).length,
  };
}

export function getActiveProviderCount(): number {
  return PROVIDER_REGISTRY.filter(spec => {
    const health = getHealth(spec.id);
    return Date.now() >= health.cooldownUntil && health.successRate >= 0.3;
  }).length;
}

export function getFreeProviderRotation(dimension: string, count: number = 5): ProviderSpec[] {
  const providers: ProviderSpec[] = [];
  const excluded: string[] = [];
  for (let i = 0; i < count; i++) {
    const p = getBestProviderForTask(dimension, excluded);
    if (!p) break;
    providers.push(p);
    excluded.push(p.id);
  }
  return providers;
}

setInterval(() => {
  const now = Date.now();
  const oneMinAgo = now - 60000;
  const oneHourAgo = now - 3600000;
  for (const [, health] of healthMap) {
    const minuteCalls = callHistory.filter(c => c.providerId === health.providerId && c.timestamp > oneMinAgo);
    health.callsThisMinute = minuteCalls.length;
    health.callsThisHour = callHistory.filter(c => c.providerId === health.providerId && c.timestamp > oneHourAgo).length;
    health.tokensThisMinute = minuteCalls.reduce((sum, c) => sum + c.tokensUsed, 0);
    health.velocityPerSecond = computeVelocity(health.providerId);
    health.predictedThrottleAt = predictThrottle(health.providerId);
  }

  if (callHistory.length > MAX_HISTORY * 0.9) {
    callHistory.splice(0, Math.floor(callHistory.length * 0.3));
  }
}, 10000);

setInterval(() => {
  while (requestQueue.length > 0) {
    const item = requestQueue[0];
    if (Date.now() - item.enqueuedAt > 30000) {
      requestQueue.shift();
      item.resolve(false);
      continue;
    }
    if (canCallProvider(item.providerId)) {
      requestQueue.shift();
      item.resolve(true);
    } else {
      break;
    }
  }
}, 1000);

setTimeout(() => console.log(`[RateLimitOpt] Smart Rate Limiter v2 initialized — tracking ${PROVIDER_REGISTRY.length} providers, predictive throttling + velocity analysis active`), 0);
