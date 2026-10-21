interface CacheEntry {
  key: string;
  data: any;
  hits: number;
  similarity: number;
  created: number;
  ttl: number;
}

interface CircuitBreaker {
  endpoint: string;
  state: "closed" | "open" | "half-open";
  failures: number;
  lastFailure: number;
  threshold: number;
  resetTimeout: number;
}

const responseCache = new Map<string, CacheEntry>();
const requestDedup = new Map<string, Promise<any>>();
const circuitBreakers = new Map<string, CircuitBreaker>();
const endpointTimings = new Map<string, number[]>();
let cacheLookups = 0;
let cacheHits = 0;
let dedupSaved = 0;
let retryCount = 0;

export function deduplicateRequest<T>(key: string, executor: () => Promise<T>): Promise<T> {
  const existing = requestDedup.get(key);
  if (existing) {
    dedupSaved++;
    return existing as Promise<T>;
  }
  const promise = executor().finally(() => {
    setTimeout(() => requestDedup.delete(key), 100);
  });
  requestDedup.set(key, promise);
  return promise;
}

export function semanticCacheGet(query: string): any | null {
  cacheLookups++;
  const directHit = responseCache.get(query);
  if (directHit && Date.now() - directHit.created < directHit.ttl) {
    directHit.hits++;
    cacheHits++;
    return directHit.data;
  }
  const queryWords = new Set(query.toLowerCase().split(/\s+/));
  for (const [key, entry] of responseCache) {
    if (Date.now() - entry.created > entry.ttl) continue;
    const keyWords = key.toLowerCase().split(/\s+/);
    const overlap = keyWords.filter(w => queryWords.has(w)).length;
    const similarity = overlap / Math.max(queryWords.size, keyWords.length);
    if (similarity > 0.7) {
      entry.hits++;
      entry.similarity = similarity;
      cacheHits++;
      return entry.data;
    }
  }
  return null;
}

export function semanticCacheSet(key: string, data: any, ttlMs = 60000): void {
  responseCache.set(key, { key, data, hits: 0, similarity: 1, created: Date.now(), ttl: ttlMs });
  if (responseCache.size > 2000) {
    const entries = [...responseCache.entries()].sort((a, b) => a[1].hits - b[1].hits);
    for (let i = 0; i < 200; i++) responseCache.delete(entries[i][0]);
  }
}

export function getCircuitBreaker(endpoint: string): CircuitBreaker {
  let cb = circuitBreakers.get(endpoint);
  if (!cb) {
    cb = { endpoint, state: "closed", failures: 0, lastFailure: 0, threshold: 5, resetTimeout: 30000 };
    circuitBreakers.set(endpoint, cb);
  }
  if (cb.state === "open" && Date.now() - cb.lastFailure > cb.resetTimeout) {
    cb.state = "half-open";
  }
  return cb;
}

export function recordEndpointFailure(endpoint: string): void {
  const cb = getCircuitBreaker(endpoint);
  cb.failures++;
  cb.lastFailure = Date.now();
  if (cb.failures >= cb.threshold) cb.state = "open";
}

export function recordEndpointSuccess(endpoint: string): void {
  const cb = getCircuitBreaker(endpoint);
  if (cb.state === "half-open") {
    cb.state = "closed";
    cb.failures = 0;
  }
}

export function recordEndpointTiming(endpoint: string, ms: number): void {
  const timings = endpointTimings.get(endpoint) || [];
  timings.push(ms);
  if (timings.length > 100) timings.splice(0, 50);
  endpointTimings.set(endpoint, timings);
}

export function getAdaptiveTimeout(endpoint: string): number {
  const timings = endpointTimings.get(endpoint);
  if (!timings || timings.length < 5) return 30000;
  const sorted = [...timings].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  return Math.max(5000, Math.min(60000, Math.round(p95 * 2)));
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      retryCount += attempt;
      return result;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const jitter = Math.random() * 1000;
      const delay = Math.pow(2, attempt) * 1000 + jitter;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

export function getStats() {
  return {
    cache: { size: responseCache.size, lookups: cacheLookups, hits: cacheHits, hitRate: cacheLookups > 0 ? Math.round((cacheHits / cacheLookups) * 100) : 0 },
    dedup: { saved: dedupSaved, active: requestDedup.size },
    circuitBreakers: [...circuitBreakers.values()].map(cb => ({ endpoint: cb.endpoint, state: cb.state, failures: cb.failures })),
    retries: retryCount,
    monitoredEndpoints: endpointTimings.size,
    status: "ACTIVE",
  };
}
