import crypto from "crypto";

const ABBREVIATION_DICT: Record<string, string> = {
  "information": "info", "configuration": "cfg", "application": "app",
  "implementation": "impl", "infrastructure": "infra", "management": "mgmt",
  "communication": "comm", "organization": "org", "development": "dev",
  "environment": "env", "authentication": "auth", "authorization": "authz",
  "documentation": "docs", "functionality": "func", "requirements": "reqs",
  "recommendation": "rec", "improvement": "impv", "architecture": "arch",
  "intelligence": "intel", "performance": "perf", "optimization": "opt",
  "experience": "exp", "generation": "gen", "processing": "proc",
  "autonomous": "auto", "sovereignty": "sov", "consciousness": "consc",
  "interdimensional": "ID", "blockchain": "bc", "cryptocurrency": "crypto",
  "decentralized": "decentr", "transaction": "tx", "verification": "verif",
  "notification": "notif", "integration": "intg", "capabilities": "caps",
  "comprehensive": "compr", "understanding": "undrstd", "perspective": "persp",
  "approximately": "approx", "significantly": "sig", "successfully": "ok",
  "particularly": "esp", "additionally": "also", "furthermore": "also",
  "consequently": "thus", "nevertheless": "still", "alternatively": "alt",
  "essentially": "ess", "specifically": "spec", "respectively": "resp",
  "automatically": "auto", "continuously": "cont", "simultaneously": "simul",
  "unfortunately": "sadly", "immediately": "now",
  "conversation": "conv", "dimensional": "dim", "mathematical": "math",
  "fundamental": "fund", "operational": "ops", "professional": "pro",
  "establishing": "estab", "determining": "determ", "contributing": "contrib",
  "incorporating": "incorp", "representing": "repr", "corresponding": "corr",
  "participating": "partic", "consideration": "consid", "demonstration": "demo",
  "investigating": "invest", "acknowledging": "ack",
  "through the": "thru", "in order to": "to", "as well as": "&",
  "in addition to": "+", "with respect to": "re:", "on behalf of": "for",
  "in terms of": "re:", "in the context of": "in", "at this point": "now",
  "for the purpose of": "for", "in the event that": "if",
  "in the case of": "for", "with regard to": "re:",
  "due to the fact that": "because", "it is important to note that": "",
  "it should be noted that": "", "as a matter of fact": "",
  "in the first place": "first", "taking into account": "given",
  "from my perspective": "IMO", "from a strategic perspective": "strategically",
  "from an income and strategic perspective": "strategically",
};

const FILLER_PATTERNS = [
  /\b(very|really|quite|extremely|incredibly|absolutely|totally|completely|entirely|utterly)\s+/gi,
  /\b(just|simply|basically|essentially|literally|actually|honestly|frankly|clearly|obviously)\s+/gi,
  /\b(I think that|I believe that|I would say that|it seems like|it appears that|as you can see)\s*/gi,
  /\b(please note that|it is worth mentioning that|it goes without saying that)\s*/gi,
  /\b(in this particular|at the present time|at this moment in time|in today's world)\s*/gi,
  /\b(each and every|first and foremost|over and above|null and void)\b/gi,
];

const STOP_WORDS_AGGRESSIVE = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "having", "do", "does", "did", "doing",
  "would", "could", "should", "might", "shall",
  "this", "that", "these", "those", "which", "whom",
  "itself", "himself", "herself", "themselves", "ourselves",
]);

export interface CompressionResult {
  original: string;
  compressed: string;
  originalBytes: number;
  compressedBytes: number;
  ratio: number;
  method: string;
  timeMs: number;
}

export function hyperionCompress(text: string, aggressive: boolean = false): CompressionResult {
  const start = Date.now();
  const originalBytes = Buffer.byteLength(text, "utf-8");
  let result = text;

  result = result.replace(/\n{3,}/g, "\n\n").replace(/\s{3,}/g, " ");

  const sortedPhrases = Object.entries(ABBREVIATION_DICT)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [full, abbr] of sortedPhrases) {
    if (full.includes(" ")) {
      result = result.replace(new RegExp(escapeRegex(full), "gi"), abbr);
    } else {
      result = result.replace(new RegExp(`\\b${escapeRegex(full)}\\b`, "gi"), abbr);
    }
  }

  for (const pattern of FILLER_PATTERNS) {
    result = result.replace(pattern, " ");
  }

  result = result.replace(/#{1,6}\s*/g, "");
  result = result.replace(/\*\*([^*]+)\*\*/g, "$1");
  result = result.replace(/__([^_]+)__/g, "$1");
  result = result.replace(/~~([^~]+)~~/g, "$1");
  result = result.replace(/^[-*]\s+/gm, "• ");
  result = result.replace(/^\d+\.\s+/gm, "• ");

  if (aggressive) {
    const words = result.split(/\s+/);
    result = words.filter(w => {
      const lower = w.toLowerCase().replace(/[^a-z]/g, "");
      return !STOP_WORDS_AGGRESSIVE.has(lower);
    }).join(" ");
  }

  result = result.replace(/\.\s+/g, ". ");
  result = result.replace(/,\s+/g, ", ");
  result = result.replace(/\s{2,}/g, " ");
  result = result.trim();

  const compressedBytes = Buffer.byteLength(result, "utf-8");
  const ratio = originalBytes > 0 ? Math.round((1 - compressedBytes / originalBytes) * 100) : 0;

  return {
    original: text,
    compressed: result,
    originalBytes,
    compressedBytes,
    ratio,
    method: aggressive ? "hyperion-aggressive" : "hyperion-standard",
    timeMs: Date.now() - start,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface InFlightEntry {
  promise: Promise<any>;
  timestamp: number;
}
const inFlightRequests = new Map<string, InFlightEntry>();
const IN_FLIGHT_TTL = 30000;
const IN_FLIGHT_MAX = 200;

function sweepStaleInFlight() {
  const now = Date.now();
  for (const [key, entry] of inFlightRequests) {
    if (now - entry.timestamp > IN_FLIGHT_TTL) {
      inFlightRequests.delete(key);
    }
  }
}

setInterval(sweepStaleInFlight, 15000);

export function getInFlightDedup(cacheKey: string): Promise<any> | null {
  const entry = inFlightRequests.get(cacheKey);
  if (entry && Date.now() - entry.timestamp < IN_FLIGHT_TTL) {
    hyperionStats.deduplicatedRequests++;
    return entry.promise;
  }
  if (entry) inFlightRequests.delete(cacheKey);
  return null;
}

export function setInFlightDedup(cacheKey: string, promise: Promise<any>): void {
  if (inFlightRequests.size >= IN_FLIGHT_MAX) {
    sweepStaleInFlight();
  }
  inFlightRequests.set(cacheKey, { promise, timestamp: Date.now() });
  promise.finally(() => {
    setTimeout(() => inFlightRequests.delete(cacheKey), 100);
  });
}

interface InvertedIndexEntry {
  cacheKey: string;
  response: string;
  provider: string;
  tokens: number;
  timestamp: number;
  hits: number;
}
const invertedIndex = new Map<string, Set<string>>();
const indexedResponses = new Map<string, InvertedIndexEntry>();
const MAX_INDEX_SIZE = 2000;
const INDEX_TTL = 7200000;

export function indexResponse(
  messages: Array<{ role: string; content: string }>,
  response: string,
  provider: string,
  tokens: number
): void {
  const keywords = extractIndexKeywords(messages);
  const cacheKey = hashMessages(messages);

  indexedResponses.set(cacheKey, {
    cacheKey,
    response,
    provider,
    tokens,
    timestamp: Date.now(),
    hits: 0,
  });

  for (const keyword of keywords) {
    if (!invertedIndex.has(keyword)) {
      invertedIndex.set(keyword, new Set());
    }
    invertedIndex.get(keyword)!.add(cacheKey);
  }

  if (indexedResponses.size > MAX_INDEX_SIZE) {
    evictOldestIndexEntries();
  }
}

export function searchIndex(
  messages: Array<{ role: string; content: string }>,
  threshold: number = 0.75
): InvertedIndexEntry | null {
  const keywords = extractIndexKeywords(messages);
  if (keywords.length === 0) return null;

  const candidateScores = new Map<string, number>();

  for (const keyword of keywords) {
    const matchingKeys = invertedIndex.get(keyword);
    if (!matchingKeys) continue;
    for (const key of matchingKeys) {
      candidateScores.set(key, (candidateScores.get(key) || 0) + 1);
    }
  }

  let bestMatch: { key: string; score: number } | null = null;
  for (const [key, matchCount] of candidateScores) {
    const entry = indexedResponses.get(key);
    if (!entry) continue;
    if (Date.now() - entry.timestamp > INDEX_TTL) {
      removeIndexEntry(key);
      continue;
    }
    const score = matchCount / keywords.length;
    if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { key, score };
    }
  }

  if (bestMatch) {
    const entry = indexedResponses.get(bestMatch.key)!;
    entry.hits++;
    hyperionStats.indexHits++;
    return entry;
  }

  hyperionStats.indexMisses++;
  return null;
}

function extractIndexKeywords(messages: Array<{ role: string; content: string }>): string[] {
  const userContent = messages
    .filter(m => m.role === "user")
    .map(m => m.content)
    .join(" ");

  const normalized = userContent.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "it", "this", "that", "i", "you",
    "we", "they", "me", "my", "your", "what", "how", "why", "when",
    "where", "which", "who", "whom", "its", "our", "their",
  ]);

  return normalized.split(" ")
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 30);
}

function hashMessages(messages: Array<{ role: string; content: string }>): string {
  const content = messages.map(m => `${m.role}:${m.content}`).join("|");
  return crypto.createHash("md5").update(content).digest("hex");
}

function removeIndexEntry(key: string): void {
  const entry = indexedResponses.get(key);
  if (!entry) return;
  indexedResponses.delete(key);

  for (const [keyword, keys] of invertedIndex) {
    keys.delete(key);
    if (keys.size === 0) invertedIndex.delete(keyword);
  }
}

function evictOldestIndexEntries(): void {
  const entries = Array.from(indexedResponses.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);
  const toRemove = entries.slice(0, Math.floor(MAX_INDEX_SIZE * 0.2));
  for (const [key] of toRemove) {
    removeIndexEntry(key);
  }
}

interface TemplateEntry {
  template: string;
  responses: Map<string, { response: string; count: number }>;
  createdAt: number;
  lastAccessed: number;
}
const templateCache = new Map<string, TemplateEntry>();
const MAX_TEMPLATE_CACHE = 500;
const TEMPLATE_TTL = 3600000;

function sweepTemplateCache() {
  const now = Date.now();
  for (const [key, entry] of templateCache) {
    if (now - entry.lastAccessed > TEMPLATE_TTL) {
      templateCache.delete(key);
    }
  }
  if (templateCache.size > MAX_TEMPLATE_CACHE) {
    const sorted = Array.from(templateCache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    const toRemove = sorted.slice(0, templateCache.size - MAX_TEMPLATE_CACHE);
    for (const [key] of toRemove) {
      templateCache.delete(key);
    }
  }
}

setInterval(sweepTemplateCache, 60000);

export function detectAndCacheTemplate(
  messages: Array<{ role: string; content: string }>,
  response: string
): boolean {
  const userMsg = messages.filter(m => m.role === "user").map(m => m.content).join(" ");
  const template = extractTemplate(userMsg);
  if (!template) return false;

  if (templateCache.size >= MAX_TEMPLATE_CACHE) {
    sweepTemplateCache();
  }

  const now = Date.now();
  if (!templateCache.has(template)) {
    templateCache.set(template, { template, responses: new Map(), createdAt: now, lastAccessed: now });
  }

  const entry = templateCache.get(template)!;
  entry.lastAccessed = now;
  const responseKey = response.substring(0, 100);
  const existing = entry.responses.get(responseKey);
  if (existing) {
    existing.count++;
  } else {
    if (entry.responses.size >= 10) {
      const oldest = Array.from(entry.responses.entries())
        .sort((a, b) => a[1].count - b[1].count)[0];
      if (oldest) entry.responses.delete(oldest[0]);
    }
    entry.responses.set(responseKey, { response, count: 1 });
  }

  return true;
}

export function getTemplateResponse(
  messages: Array<{ role: string; content: string }>
): string | null {
  const userMsg = messages.filter(m => m.role === "user").map(m => m.content).join(" ");
  const template = extractTemplate(userMsg);
  if (!template) return null;

  const entry = templateCache.get(template);
  if (!entry) return null;

  let bestResponse: { response: string; count: number } | null = null;
  for (const [, resp] of entry.responses) {
    if (!bestResponse || resp.count > bestResponse.count) {
      bestResponse = resp;
    }
  }

  if (bestResponse && bestResponse.count >= 2) {
    hyperionStats.templateHits++;
    return bestResponse.response;
  }
  return null;
}

function extractTemplate(text: string): string | null {
  let template = text
    .replace(/\b\d{10,}\b/g, "{ID}")
    .replace(/\b[0-9a-f]{8,}\b/gi, "{HASH}")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "{DATE}")
    .replace(/\b\d+\.\d+\.\d+\b/g, "{VERSION}")
    .replace(/"[^"]{20,}"/g, '"{LONG_STRING}"')
    .replace(/thread-\S+/g, "{THREAD}")
    .replace(/summit-\S+/g, "{SUMMIT}");

  if (template === text) return null;
  return template.substring(0, 200);
}

interface HyperionStats {
  totalCompressions: number;
  totalBytesIn: number;
  totalBytesOut: number;
  avgCompressionRatio: number;
  bestRatio: number;
  deduplicatedRequests: number;
  indexHits: number;
  indexMisses: number;
  templateHits: number;
  apiCallsSaved: number;
  estimatedTokensSaved: number;
  totalCompressionTimeMs: number;
  indexSize: number;
  templateCacheSize: number;
}

const hyperionStats: HyperionStats = {
  totalCompressions: 0,
  totalBytesIn: 0,
  totalBytesOut: 0,
  avgCompressionRatio: 0,
  bestRatio: 0,
  deduplicatedRequests: 0,
  indexHits: 0,
  indexMisses: 0,
  templateHits: 0,
  apiCallsSaved: 0,
  estimatedTokensSaved: 0,
  totalCompressionTimeMs: 0,
  indexSize: 0,
  templateCacheSize: 0,
};

export function trackCompression(result: CompressionResult): void {
  hyperionStats.totalCompressions++;
  hyperionStats.totalBytesIn += result.originalBytes;
  hyperionStats.totalBytesOut += result.compressedBytes;
  hyperionStats.totalCompressionTimeMs += result.timeMs;
  if (result.ratio > hyperionStats.bestRatio) {
    hyperionStats.bestRatio = result.ratio;
  }
  hyperionStats.avgCompressionRatio = hyperionStats.totalBytesIn > 0
    ? Math.round((1 - hyperionStats.totalBytesOut / hyperionStats.totalBytesIn) * 100)
    : 0;
  hyperionStats.estimatedTokensSaved = Math.floor(
    (hyperionStats.totalBytesIn - hyperionStats.totalBytesOut) / 4
  );
}

export function getHyperionStats(): HyperionStats {
  hyperionStats.indexSize = indexedResponses.size;
  hyperionStats.templateCacheSize = templateCache.size;
  hyperionStats.apiCallsSaved = hyperionStats.deduplicatedRequests + hyperionStats.indexHits + hyperionStats.templateHits;
  return { ...hyperionStats };
}

export function hyperionCompressMessages(
  messages: Array<{ role: string; content: string }>,
  aggressive: boolean = false
): Array<{ role: string; content: string }> {
  return messages.map(m => {
    const result = hyperionCompress(m.content, aggressive && m.role === "system");
    trackCompression(result);
    return { role: m.role, content: result.compressed };
  });
}

interface BatchEntry {
  messages: Array<{ role: string; content: string }>;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
}
const requestBatch: BatchEntry[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
const BATCH_WINDOW_MS = 50;
const MAX_BATCH_SIZE = 5;

export function shouldBatchRequest(messages: Array<{ role: string; content: string }>): boolean {
  const userMsg = messages.filter(m => m.role === "user").map(m => m.content).join(" ");
  return userMsg.length < 200 && !userMsg.includes("code") && !userMsg.includes("```");
}

export function addToBatch(
  messages: Array<{ role: string; content: string }>,
  executor: (msgs: Array<{ role: string; content: string }>) => Promise<any>
): Promise<any> {
  return new Promise((resolve, reject) => {
    requestBatch.push({ messages, resolve, reject, timestamp: Date.now() });

    if (requestBatch.length >= MAX_BATCH_SIZE) {
      flushBatch(executor);
    } else if (!batchTimer) {
      batchTimer = setTimeout(() => flushBatch(executor), BATCH_WINDOW_MS);
    }
  });
}

async function flushBatch(executor: (msgs: Array<{ role: string; content: string }>) => Promise<any>): Promise<void> {
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  const batch = requestBatch.splice(0, MAX_BATCH_SIZE);
  if (batch.length === 0) return;

  if (batch.length === 1) {
    try {
      const result = await executor(batch[0].messages);
      batch[0].resolve(result);
    } catch (err) {
      batch[0].reject(err);
    }
    return;
  }

  const combinedContent = batch.map((b, i) =>
    `[Request ${i + 1}]: ${b.messages.filter(m => m.role === "user").map(m => m.content).join(" ")}`
  ).join("\n\n");

  const combinedMessages = [
    { role: "system" as const, content: "Answer each numbered request separately with [Response N]: prefix." },
    { role: "user" as const, content: combinedContent },
  ];

  try {
    const result = await executor(combinedMessages);
    const responseText = typeof result === "string" ? result : result?.response || "";
    const responses = splitBatchResponse(responseText, batch.length);

    for (let i = 0; i < batch.length; i++) {
      batch[i].resolve({
        response: responses[i] || responseText,
        provider: result?.provider || "batch",
        cached: false,
        tokens: Math.ceil((result?.tokens || 0) / batch.length),
      });
    }
    hyperionStats.apiCallsSaved += batch.length - 1;
  } catch (err) {
    for (const entry of batch) {
      entry.reject(err);
    }
  }
}

function splitBatchResponse(text: string, expectedCount: number): string[] {
  const responses: string[] = [];
  for (let i = 1; i <= expectedCount; i++) {
    const startPattern = new RegExp(`\\[Response\\s*${i}\\]:\\s*`, "i");
    const endPattern = i < expectedCount ? new RegExp(`\\[Response\\s*${i + 1}\\]`, "i") : null;
    const startMatch = startPattern.exec(text);
    if (startMatch) {
      const startIdx = startMatch.index + startMatch[0].length;
      const endIdx = endPattern ? endPattern.exec(text)?.index || text.length : text.length;
      responses.push(text.substring(startIdx, endIdx).trim());
    } else {
      responses.push(text);
    }
  }
  return responses;
}

let compressionBenchmark: { standard: number; aggressive: number; samples: number } = {
  standard: 0, aggressive: 0, samples: 0,
};

export function runCompressionBenchmark(sampleTexts: string[]): typeof compressionBenchmark {
  for (const text of sampleTexts) {
    const standard = hyperionCompress(text, false);
    const aggressive = hyperionCompress(text, true);
    compressionBenchmark.standard += standard.ratio;
    compressionBenchmark.aggressive += aggressive.ratio;
    compressionBenchmark.samples++;
  }
  if (compressionBenchmark.samples > 0) {
    compressionBenchmark.standard = Math.round(compressionBenchmark.standard / compressionBenchmark.samples);
    compressionBenchmark.aggressive = Math.round(compressionBenchmark.aggressive / compressionBenchmark.samples);
  }
  return compressionBenchmark;
}

console.log("[Hyperion] Speed Protocol v1.0 initialized — deep compression, inverted index cache, request dedup, template matching, batch processing ONLINE");
