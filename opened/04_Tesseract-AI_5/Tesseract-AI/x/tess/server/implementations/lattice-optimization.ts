const compressionCache = new Map<string, { data: Buffer; ratio: number; timestamp: number }>();
let totalCompressed = 0;
let totalSaved = 0;

export function adaptiveCompress(payload: string): { compressed: string; ratio: number } {
  const key = payload.substring(0, 64);
  const cached = compressionCache.get(key);
  if (cached && Date.now() - cached.timestamp < 60000) {
    return { compressed: cached.data.toString("base64"), ratio: cached.ratio };
  }
  const original = Buffer.from(payload, "utf-8");
  const deduplicated = deduplicateChunks(original);
  const ratio = Math.round((1 - deduplicated.length / original.length) * 100);
  totalCompressed++;
  totalSaved += original.length - deduplicated.length;
  compressionCache.set(key, { data: deduplicated, ratio, timestamp: Date.now() });
  if (compressionCache.size > 1000) {
    const oldest = [...compressionCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 100; i++) compressionCache.delete(oldest[i][0]);
  }
  return { compressed: deduplicated.toString("base64"), ratio };
}

function deduplicateChunks(buf: Buffer): Buffer {
  const chunkSize = 64;
  const seen = new Set<string>();
  const chunks: Buffer[] = [];
  for (let i = 0; i < buf.length; i += chunkSize) {
    const chunk = buf.subarray(i, Math.min(i + chunkSize, buf.length));
    const key = chunk.toString("hex");
    if (!seen.has(key)) {
      seen.add(key);
      chunks.push(chunk);
    }
  }
  return Buffer.concat(chunks);
}

const edgeCacheNodes = new Map<string, { data: any; hits: number; ttl: number; created: number }>();

export function edgeCacheGet(key: string): any | null {
  const entry = edgeCacheNodes.get(key);
  if (!entry) return null;
  if (Date.now() - entry.created > entry.ttl) {
    edgeCacheNodes.delete(key);
    return null;
  }
  entry.hits++;
  return entry.data;
}

export function edgeCacheSet(key: string, data: any, ttlMs = 30000): void {
  edgeCacheNodes.set(key, { data, hits: 0, ttl: ttlMs, created: Date.now() });
}

const channelQueues: Map<number, Array<{ id: string; payload: any; resolve: (v: any) => void }>> = new Map();
const CHANNEL_COUNT = 4;
for (let i = 0; i < CHANNEL_COUNT; i++) channelQueues.set(i, []);

let requestCounter = 0;

export function multiplexRequest(payload: any): Promise<any> {
  const channelId = requestCounter++ % CHANNEL_COUNT;
  const queue = channelQueues.get(channelId)!;
  return new Promise((resolve) => {
    queue.push({ id: `req-${requestCounter}`, payload, resolve });
    if (queue.length === 1) processChannel(channelId);
  });
}

async function processChannel(channelId: number): Promise<void> {
  const queue = channelQueues.get(channelId)!;
  while (queue.length > 0) {
    const batch = queue.splice(0, 10);
    for (const req of batch) {
      req.resolve({ channelId, processed: true, id: req.id });
    }
  }
}

const behaviorPatterns = new Map<string, { paths: string[]; frequency: number; lastAccess: number }>();

export function recordBehavior(userId: string, path: string): void {
  const pattern = behaviorPatterns.get(userId) || { paths: [], frequency: 0, lastAccess: 0 };
  pattern.paths.push(path);
  if (pattern.paths.length > 50) pattern.paths = pattern.paths.slice(-50);
  pattern.frequency++;
  pattern.lastAccess = Date.now();
  behaviorPatterns.set(userId, pattern);
}

export function predictNextPath(userId: string): string | null {
  const pattern = behaviorPatterns.get(userId);
  if (!pattern || pattern.paths.length < 3) return null;
  const transitions = new Map<string, Map<string, number>>();
  for (let i = 0; i < pattern.paths.length - 1; i++) {
    const from = pattern.paths[i];
    const to = pattern.paths[i + 1];
    if (!transitions.has(from)) transitions.set(from, new Map());
    const counts = transitions.get(from)!;
    counts.set(to, (counts.get(to) || 0) + 1);
  }
  const current = pattern.paths[pattern.paths.length - 1];
  const nextCounts = transitions.get(current);
  if (!nextCounts) return null;
  let best = "", bestCount = 0;
  for (const [path, count] of nextCounts) {
    if (count > bestCount) { best = path; bestCount = count; }
  }
  return best || null;
}

export function getStats() {
  return {
    compression: { totalCompressed, totalBytesSaved: totalSaved, cacheSize: compressionCache.size },
    edgeCache: { nodes: edgeCacheNodes.size, totalHits: [...edgeCacheNodes.values()].reduce((s, v) => s + v.hits, 0) },
    multiplexer: { channels: CHANNEL_COUNT, totalRequests: requestCounter },
    prefetcher: { trackedUsers: behaviorPatterns.size },
    status: "ACTIVE",
  };
}
