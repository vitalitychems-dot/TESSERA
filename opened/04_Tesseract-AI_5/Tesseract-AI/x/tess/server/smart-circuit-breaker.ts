import { emitAlert } from "./knowledge-infra-archive";

interface ProviderState {
  name: string;
  state: "closed" | "open" | "half-open";
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailure: number;
  lastSuccess: number;
  lastResponseTimeMs: number;
  avgResponseTimeMs: number;
  responseTimeSamples: number[];
  openUntil: number;
  healthScore: number;
  cooldownMs: number;
  consecutiveSuccesses: number;
  healthTrend: number[];
  requestTimestamps: number[];
  failureTimestamps: number[];
  predictedDegradation: number;
  costPerRequest: number;
  qualityScore: number;
}

const providers = new Map<string, ProviderState>();
const MAX_SAMPLES = 50;
const BASE_COOLDOWN_MS = 15_000;
const MAX_COOLDOWN_MS = 600_000;
const FAILURE_THRESHOLD = 3;
const HALF_OPEN_SUCCESS_THRESHOLD = 2;
const HEALTH_DECAY_RATE = 0.95;

const PROVIDER_COSTS: Record<string, number> = {
  "groq": 0, "cerebras": 0, "sambanova": 0, "pollinations": 0,
  "openrouter": 0.1, "huggingface": 0, "github-models": 0, "puter": 0,
  "deepseek": 0.5, "mistral": 1, "together-ai": 1,
  "openai": 5, "anthropic": 5, "google-gemini": 3,
};

function getOrCreate(name: string): ProviderState {
  if (!providers.has(name)) {
    providers.set(name, {
      name,
      state: "closed",
      failures: 0,
      successes: 0,
      totalRequests: 0,
      lastFailure: 0,
      lastSuccess: 0,
      lastResponseTimeMs: 0,
      avgResponseTimeMs: 0,
      responseTimeSamples: [],
      openUntil: 0,
      healthScore: 100,
      cooldownMs: BASE_COOLDOWN_MS,
      consecutiveSuccesses: 0,
      healthTrend: [],
      requestTimestamps: [],
      failureTimestamps: [],
      predictedDegradation: 0,
      costPerRequest: PROVIDER_COSTS[name] ?? 1,
      qualityScore: 80,
    });
  }
  return providers.get(name)!;
}

export function recordSuccess(name: string, responseTimeMs: number): void {
  const provider = getOrCreate(name);
  provider.successes++;
  provider.totalRequests++;
  provider.lastSuccess = Date.now();
  provider.lastResponseTimeMs = responseTimeMs;
  provider.consecutiveSuccesses++;
  provider.failures = Math.max(0, provider.failures - 1);

  provider.responseTimeSamples.push(responseTimeMs);
  if (provider.responseTimeSamples.length > MAX_SAMPLES) {
    provider.responseTimeSamples.shift();
  }
  provider.avgResponseTimeMs = Math.round(
    provider.responseTimeSamples.reduce((a, b) => a + b, 0) / provider.responseTimeSamples.length
  );

  provider.healthScore = Math.min(100, provider.healthScore + 5);

  provider.healthTrend.push(provider.healthScore);
  if (provider.healthTrend.length > 20) provider.healthTrend.shift();

  provider.requestTimestamps.push(Date.now());
  if (provider.requestTimestamps.length > 100) provider.requestTimestamps.shift();

  provider.predictedDegradation = predictDegradation(provider);

  if (responseTimeMs < provider.avgResponseTimeMs * 0.8) {
    provider.qualityScore = Math.min(100, provider.qualityScore + 2);
  } else if (responseTimeMs > provider.avgResponseTimeMs * 2) {
    provider.qualityScore = Math.max(0, provider.qualityScore - 5);
  }

  if (provider.state === "half-open" && provider.consecutiveSuccesses >= HALF_OPEN_SUCCESS_THRESHOLD) {
    provider.state = "closed";
    provider.cooldownMs = BASE_COOLDOWN_MS;
    provider.failures = 0;
  }
}

export function recordFailure(name: string, error?: string): void {
  const provider = getOrCreate(name);
  provider.failures++;
  provider.totalRequests++;
  provider.lastFailure = Date.now();
  provider.consecutiveSuccesses = 0;

  provider.healthScore = Math.max(0, provider.healthScore - 15);
  provider.qualityScore = Math.max(0, provider.qualityScore - 10);

  provider.healthTrend.push(provider.healthScore);
  if (provider.healthTrend.length > 20) provider.healthTrend.shift();

  provider.failureTimestamps.push(Date.now());
  if (provider.failureTimestamps.length > 50) provider.failureTimestamps.shift();

  provider.predictedDegradation = predictDegradation(provider);

  const isRateLimit = error?.includes("429") || error?.toLowerCase().includes("rate limit");
  const isPayment = error?.toLowerCase().includes("payment") || error?.toLowerCase().includes("credits");

  if (provider.failures >= FAILURE_THRESHOLD) {
    provider.state = "open";

    if (isPayment) {
      provider.cooldownMs = MAX_COOLDOWN_MS;
    } else if (isRateLimit) {
      provider.cooldownMs = Math.min(provider.cooldownMs * 2, MAX_COOLDOWN_MS / 2);
    } else {
      provider.cooldownMs = Math.min(provider.cooldownMs * 1.5, MAX_COOLDOWN_MS / 4);
    }

    provider.openUntil = Date.now() + provider.cooldownMs;

    const reason = isPayment ? "payment/credits exhausted" : isRateLimit ? "rate limited (429)" : error?.slice(0, 100) || "repeated errors";
    emitAlert({
      severity: isPayment ? "critical" : "warning",
      component: `LLM:${name}`,
      title: `LLM provider "${name}" circuit breaker OPEN`,
      message: `Provider ${name} triggered circuit breaker after ${provider.failures} failures. Reason: ${reason}. Cooldown: ${Math.round(provider.cooldownMs / 1000)}s. Traffic re-routed automatically.`,
      recommendedAction: isPayment
        ? `Check API credits/billing for ${name}. Add funds or rotate to a different provider.`
        : `Provider ${name} will be retried in ${Math.round(provider.cooldownMs / 1000)}s. Monitor error rate.`,
      metadata: { provider: name, failures: provider.failures, cooldownMs: provider.cooldownMs, reason, healthScore: provider.healthScore },
    });
  } else if (provider.predictedDegradation > 50 && provider.state === "closed") {
    emitAlert({
      severity: "warning",
      component: `LLM:${name}`,
      title: `LLM provider "${name}" degrading — pre-routing recommended`,
      message: `Provider ${name} shows predicted degradation score of ${provider.predictedDegradation}%. Health score: ${provider.healthScore}/100. Pre-routing traffic away before failure.`,
      recommendedAction: `Provider ${name} is degrading. The system is pre-routing traffic to healthier providers. No action needed unless this persists.`,
      metadata: { provider: name, predictedDegradation: provider.predictedDegradation, healthScore: provider.healthScore },
    });
  }
}

export function isAvailable(name: string): boolean {
  const provider = getOrCreate(name);

  if (provider.state === "closed") return true;

  if (provider.state === "open" && Date.now() >= provider.openUntil) {
    provider.state = "half-open";
    provider.consecutiveSuccesses = 0;
    return true;
  }

  return provider.state === "half-open";
}

export function getBestProvider(candidates: string[]): string | null {
  const available = candidates
    .filter(name => isAvailable(name))
    .map(name => ({ name, state: getOrCreate(name) }))
    .sort((a, b) => {
      if (a.state.healthScore !== b.state.healthScore) {
        return b.state.healthScore - a.state.healthScore;
      }
      return a.state.avgResponseTimeMs - b.state.avgResponseTimeMs;
    });

  return available.length > 0 ? available[0].name : null;
}

export function getProviderHealth(): Array<{
  name: string;
  state: string;
  healthScore: number;
  avgResponseMs: number;
  successRate: number;
  failures: number;
  cooldownRemaining: number;
}> {
  return Array.from(providers.values())
    .map(p => ({
      name: p.name,
      state: p.state,
      healthScore: p.healthScore,
      avgResponseMs: p.avgResponseTimeMs,
      successRate: p.totalRequests > 0 ? Math.round((p.successes / p.totalRequests) * 100) : 100,
      failures: p.failures,
      cooldownRemaining: p.state === "open" ? Math.max(0, p.openUntil - Date.now()) : 0,
    }))
    .sort((a, b) => b.healthScore - a.healthScore);
}

export function resetProvider(name: string): boolean {
  const provider = providers.get(name);
  if (provider) {
    provider.state = "closed";
    provider.failures = 0;
    provider.cooldownMs = BASE_COOLDOWN_MS;
    provider.openUntil = 0;
    provider.healthScore = 50;
    provider.consecutiveSuccesses = 0;
    return true;
  }
  return false;
}

export function resetAllProviders(): void {
  for (const [name] of providers) {
    resetProvider(name);
  }
}

export function seedProviders(): void {
  const knownProviders = [
    "openai",
    "anthropic",
    "google-gemini",
    "groq",
    "deepseek",
    "mistral",
    "together-ai",
    "openrouter",
  ];
  for (const name of knownProviders) {
    getOrCreate(name);
  }
}

function predictDegradation(provider: ProviderState): number {
  const trend = provider.healthTrend;
  if (trend.length < 5) return 0;

  const recent = trend.slice(-5);
  let totalSlope = 0;
  for (let i = 1; i < recent.length; i++) {
    totalSlope += recent[i] - recent[i - 1];
  }
  const avgSlope = totalSlope / (recent.length - 1);

  const recentFailures = provider.failureTimestamps.filter(
    t => Date.now() - t < 300000
  ).length;

  const failureAcceleration = recentFailures > 3 ? recentFailures * 5 : 0;

  const degradation = Math.max(0, Math.min(100, (-avgSlope * 10) + failureAcceleration));
  return Math.round(degradation);
}

export function getBestProviderPredictive(candidates: string[]): string | null {
  const scored = candidates
    .filter(name => isAvailable(name))
    .map(name => {
      const s = getOrCreate(name);
      const healthWeight = s.healthScore * 0.3;
      const trendWeight = (100 - s.predictedDegradation) * 0.25;
      const speedWeight = Math.max(0, 100 - (s.avgResponseTimeMs / 50)) * 0.15;
      const costWeight = (100 - s.costPerRequest * 10) * 0.15;
      const qualityWeight = s.qualityScore * 0.15;
      const compositeScore = healthWeight + trendWeight + speedWeight + costWeight + qualityWeight;
      return { name, compositeScore, health: s.healthScore, predicted: s.predictedDegradation, cost: s.costPerRequest };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore);

  return scored.length > 0 ? scored[0].name : null;
}

export function getProviderPredictions(): Array<{
  name: string;
  healthScore: number;
  predictedDegradation: number;
  trend: string;
  costPerRequest: number;
  qualityScore: number;
  recommendedAction: string;
}> {
  return Array.from(providers.values()).map(p => {
    const deg = p.predictedDegradation;
    let trend: string;
    let recommendedAction: string;

    if (deg > 60) {
      trend = "rapidly-declining";
      recommendedAction = "preemptive-reroute";
    } else if (deg > 30) {
      trend = "declining";
      recommendedAction = "reduce-traffic";
    } else if (deg > 10) {
      trend = "slightly-declining";
      recommendedAction = "monitor-closely";
    } else {
      trend = "stable";
      recommendedAction = "normal-routing";
    }

    return {
      name: p.name,
      healthScore: p.healthScore,
      predictedDegradation: deg,
      trend,
      costPerRequest: p.costPerRequest,
      qualityScore: p.qualityScore,
      recommendedAction,
    };
  }).sort((a, b) => b.healthScore - a.healthScore);
}

export function getCircuitBreakerSummary(): {
  totalProviders: number;
  healthy: number;
  degraded: number;
  down: number;
  avgHealthScore: number;
  predictiveAlerts: number;
} {
  const all = Array.from(providers.values());
  const healthy = all.filter(p => p.state === "closed" && p.healthScore > 70).length;
  const degraded = all.filter(p => p.state === "half-open" || (p.state === "closed" && p.healthScore <= 70)).length;
  const down = all.filter(p => p.state === "open").length;
  const avgHealth = all.length > 0
    ? Math.round(all.reduce((s, p) => s + p.healthScore, 0) / all.length)
    : 100;
  const predictiveAlerts = all.filter(p => p.predictedDegradation > 30).length;

  return {
    totalProviders: all.length,
    healthy,
    degraded,
    down,
    avgHealthScore: avgHealth,
    predictiveAlerts,
  };
}
