interface CacheEntry {
  response: string;
  timestamp: number;
  hits: number;
  lastAccessed: number;
  ttl: number;
  model?: string;
  tokens?: number;
}

const MAX_SIZE = 500;
const DEFAULT_TTL = 3600000;
let totalHits = 0;
let totalMisses = 0;
let totalEvictions = 0;

const cache = new Map<string, CacheEntry>();
const accessOrder: string[] = [];

function evictLRU() {
  while (cache.size >= MAX_SIZE && accessOrder.length > 0) {
    const oldest = accessOrder.shift();
    if (oldest && cache.has(oldest)) {
      cache.delete(oldest);
      totalEvictions++;
    }
  }
}

function touchKey(key: string) {
  const idx = accessOrder.indexOf(key);
  if (idx !== -1) accessOrder.splice(idx, 1);
  accessOrder.push(key);
}

export function cacheGet(query: string): string | null {
  const entry = cache.get(query);
  if (!entry) {
    totalMisses++;
    return null;
  }

  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(query);
    const idx = accessOrder.indexOf(query);
    if (idx !== -1) accessOrder.splice(idx, 1);
    totalMisses++;
    return null;
  }

  entry.hits++;
  entry.lastAccessed = Date.now();
  touchKey(query);
  totalHits++;
  return entry.response;
}

export function cacheSet(query: string, response: string, ttl: number = DEFAULT_TTL, model?: string, tokens?: number) {
  if (cache.has(query)) {
    const existing = cache.get(query)!;
    existing.response = response;
    existing.timestamp = Date.now();
    existing.lastAccessed = Date.now();
    existing.ttl = ttl;
    if (model) existing.model = model;
    if (tokens) existing.tokens = tokens;
    touchKey(query);
    return;
  }

  evictLRU();

  cache.set(query, {
    response,
    timestamp: Date.now(),
    hits: 0,
    lastAccessed: Date.now(),
    ttl,
    model,
    tokens,
  });
  accessOrder.push(query);
}

export function getCachedResponse(query: string): { response: string; tokens: number; model: string } | null {
  const entry = cache.get(query);
  if (!entry) {
    totalMisses++;
    return null;
  }
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(query);
    const idx = accessOrder.indexOf(query);
    if (idx !== -1) accessOrder.splice(idx, 1);
    totalMisses++;
    return null;
  }
  entry.hits++;
  entry.lastAccessed = Date.now();
  touchKey(query);
  totalHits++;
  return { response: entry.response, tokens: entry.tokens || Math.ceil(entry.response.length / 4), model: entry.model || "cached" };
}

export function cacheResponse(prompt: string, content: string, model: string, tokens: number) {
  cacheSet(prompt, content, DEFAULT_TTL, model, tokens);
}

export function getResponseCacheStats() {
  const total = totalHits + totalMisses;
  return {
    size: cache.size,
    maxSize: MAX_SIZE,
    hitRate: total > 0 ? Math.round((totalHits / total) * 100) / 100 : 0,
    totalHits,
    totalMisses,
    totalEvictions,
    oldestEntry: accessOrder.length > 0 ? cache.get(accessOrder[0])?.timestamp || 0 : 0,
    newestEntry: accessOrder.length > 0 ? cache.get(accessOrder[accessOrder.length - 1])?.timestamp || 0 : 0,
  };
}

export function getTopCachedQueries() {
  return Array.from(cache.entries())
    .sort((a, b) => b[1].hits - a[1].hits)
    .slice(0, 10)
    .map(([key, val]) => ({
      query: key.substring(0, 100),
      hits: val.hits,
      age: Date.now() - val.timestamp,
      lastAccessed: Date.now() - val.lastAccessed,
    }));
}

export function clearExpiredCache() {
  const now = Date.now();
  let cleared = 0;
  for (const [key, val] of cache) {
    if (now - val.timestamp > val.ttl) {
      cache.delete(key);
      const idx = accessOrder.indexOf(key);
      if (idx !== -1) accessOrder.splice(idx, 1);
      cleared++;
    }
  }
  return { cleared, remaining: cache.size };
}

export function clearCache() {
  const size = cache.size;
  cache.clear();
  accessOrder.length = 0;
  totalHits = 0;
  totalMisses = 0;
  totalEvictions = 0;
  return { cleared: size };
}
