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
}

const providers = new Map<string, ProviderState>();
const MAX_SAMPLES = 50;
const BASE_COOLDOWN_MS = 15_000;
const MAX_COOLDOWN_MS = 600_000;
const FAILURE_THRESHOLD = 3;
const HALF_OPEN_SUCCESS_THRESHOLD = 2;
const HEALTH_DECAY_RATE = 0.95;

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

export function getCircuitBreakerSummary(): {
  totalProviders: number;
  healthy: number;
  degraded: number;
  down: number;
  avgHealthScore: number;
} {
  const all = Array.from(providers.values());
  const healthy = all.filter(p => p.state === "closed" && p.healthScore > 70).length;
  const degraded = all.filter(p => p.state === "half-open" || (p.state === "closed" && p.healthScore <= 70)).length;
  const down = all.filter(p => p.state === "open").length;
  const avgHealth = all.length > 0
    ? Math.round(all.reduce((s, p) => s + p.healthScore, 0) / all.length)
    : 100;

  return {
    totalProviders: all.length,
    healthy,
    degraded,
    down,
    avgHealthScore: avgHealth,
  };
}
