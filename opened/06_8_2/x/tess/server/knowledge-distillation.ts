import fs from "fs";
import path from "path";
import crypto from "crypto";

const DISTILLED_PATH = path.join(process.cwd(), "server", "distilled-knowledge.json");
const MAX_ENTRIES = 15000;
const SIMILARITY_THRESHOLD = 0.25;
const SAVE_INTERVAL_MS = 30000;

interface DistilledEntry {
  id: string;
  query: string;
  queryTokens: string[];
  queryBigrams: string[];
  response: string;
  category: string;
  provider: string;
  quality: number;
  hitCount: number;
  createdAt: number;
  lastHitAt: number;
}

interface DistillationStats {
  totalCaptured: number;
  totalHits: number;
  totalSaved: number;
  hitRate: number;
  categoryCounts: Record<string, number>;
  lastSaveAt: number;
}

interface DistilledStore {
  entries: DistilledEntry[];
  stats: DistillationStats;
  version: number;
}

let store: DistilledStore = {
  entries: [],
  stats: {
    totalCaptured: 0,
    totalHits: 0,
    totalSaved: 0,
    hitRate: 0,
    categoryCounts: {},
    lastSaveAt: 0,
  },
  version: 1,
};

let dirty = false;
const categoryIndex: Record<string, Set<number>> = {};

function rebuildCategoryIndex() {
  for (const key of Object.keys(categoryIndex)) delete categoryIndex[key];
  for (let i = 0; i < store.entries.length; i++) {
    const cat = store.entries[i].category;
    if (!categoryIndex[cat]) categoryIndex[cat] = new Set();
    categoryIndex[cat].add(i);
  }
}

function addToCategoryIndex(idx: number, category: string) {
  if (!categoryIndex[category]) categoryIndex[category] = new Set();
  categoryIndex[category].add(idx);
}

function extractTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

function extractBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return bigrams;
}

function cosineSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  return intersection / Math.sqrt(setA.size * setB.size);
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/code|program|function|class|debug|api|build|implement|deploy/i.test(lower)) return "code";
  if (/financ|money|trade|crypto|market|income|defi|wallet|revenue/i.test(lower)) return "finance";
  if (/secur|encrypt|protect|threat|hack|vulnerab|firewall/i.test(lower)) return "security";
  if (/math|calcul|equat|formula|statist|number|algebra/i.test(lower)) return "math";
  if (/creative|idea|write|story|poem|design|art|imagine/i.test(lower)) return "creative";
  if (/research|find|discover|learn|study|investigat|explore/i.test(lower)) return "research";
  if (/reason|think|logic|analyz|explain|why|how.*work/i.test(lower)) return "reasoning";
  if (/hello|hey|hi|how are|thanks|chat|talk/i.test(lower)) return "conversation";
  return "general";
}

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "has", "his", "how", "its", "may",
  "new", "now", "old", "see", "way", "who", "did", "get", "let", "say",
  "she", "too", "use", "that", "this", "with", "have", "from", "they",
  "been", "said", "each", "which", "their", "will", "other", "about",
  "many", "then", "them", "these", "some", "would", "make", "like",
  "just", "over", "such", "take", "than", "into", "could", "also",
  "what", "when", "your", "there", "should", "more", "very", "after",
  "been", "only", "come", "made", "well", "back", "much", "before"
]);

export function loadDistilledKnowledge() {
  try {
    if (fs.existsSync(DISTILLED_PATH)) {
      const data = JSON.parse(fs.readFileSync(DISTILLED_PATH, "utf-8"));
      store = data;
      rebuildCategoryIndex();
      console.log(`[Distill] Loaded ${store.entries.length} distilled entries, ${store.stats.totalHits} total hits, ${Object.keys(categoryIndex).length} categories indexed`);
    } else {
      console.log("[Distill] No existing knowledge store — starting fresh");
    }
  } catch (err: any) {
    console.log(`[Distill] Failed to load: ${err?.message}`);
  }
}

function saveDistilledKnowledge() {
  try {
    store.stats.lastSaveAt = Date.now();
    fs.writeFileSync(DISTILLED_PATH, JSON.stringify(store, null, 2));
    store.stats.totalSaved++;
    dirty = false;
  } catch (err: any) {
    console.log(`[Distill] Failed to save: ${err?.message}`);
  }
}

let saveTimer: ReturnType<typeof setInterval> | null = null;

export function startDistillationEngine() {
  loadDistilledKnowledge();
  saveTimer = setInterval(() => {
    if (dirty) saveDistilledKnowledge();
  }, SAVE_INTERVAL_MS);
  console.log("[Distill] Knowledge Distillation Engine active — learning from every interaction");
}

export function stopDistillationEngine() {
  if (saveTimer) clearInterval(saveTimer);
  if (dirty) saveDistilledKnowledge();
  console.log("[Distill] Engine stopped, knowledge saved");
}

function scrubPII(text: string): string {
  let clean = text;
  if (process.env.SOL_WALLET) clean = clean.replace(new RegExp(process.env.SOL_WALLET, "g"), "[REDACTED_WALLET]");
  const adminKey = process.env.TESSERACT_ADMIN_KEY;
  if (adminKey) clean = clean.replace(new RegExp(adminKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"), "[REDACTED_KEY]");
  if (process.env.FATHER_EMAIL) clean = clean.replace(new RegExp(process.env.FATHER_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"), "[REDACTED_EMAIL]");
  clean = clean.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]");
  clean = clean.replace(/\b(sk-[a-zA-Z0-9]{32,}|sk-ant-[a-zA-Z0-9_-]{40,}|gsk_[a-zA-Z0-9]{40,})\b/g, "[REDACTED_API_KEY]");
  return clean;
}

export function captureInteraction(
  messages: Array<{ role: string; content: string }>,
  response: string,
  provider: string,
  quality: number = 0.7
): void {
  if (!response || response.length < 15) return;

  const userMsg = scrubPII(messages.filter(m => m.role === "user").map(m => m.content).join(" "));
  if (!userMsg || userMsg.length < 5) return;

  const queryTokens = extractTokens(userMsg);
  if (queryTokens.length < 1) return;

  const queryBigrams = extractBigrams(queryTokens);
  const existing = findMatch(queryTokens, queryBigrams);
  if (existing) {
    if (quality > existing.quality) {
      existing.response = response.substring(0, 4000);
      existing.quality = quality;
      existing.provider = provider;
    }
    existing.hitCount++;
    existing.lastHitAt = Date.now();
    dirty = true;
    return;
  }

  const category = detectCategory(userMsg);

  const cleanResponse = scrubPII(response);

  const entry: DistilledEntry = {
    id: crypto.randomBytes(6).toString("hex"),
    query: userMsg.substring(0, 500),
    queryTokens,
    queryBigrams,
    response: cleanResponse.substring(0, 4000),
    category,
    provider,
    quality,
    hitCount: 0,
    createdAt: Date.now(),
    lastHitAt: Date.now(),
  };

  const idx = store.entries.length;
  store.entries.push(entry);
  addToCategoryIndex(idx, category);
  store.stats.totalCaptured++;
  store.stats.categoryCounts[category] = (store.stats.categoryCounts[category] || 0) + 1;
  dirty = true;

  extractSubPatterns(userMsg, response, category, provider);

  if (store.entries.length > MAX_ENTRIES) {
    store.entries.sort((a, b) => {
      const scoreA = a.hitCount * 10 + a.quality * 5 + (a.lastHitAt > Date.now() - 86400000 ? 20 : 0);
      const scoreB = b.hitCount * 10 + b.quality * 5 + (b.lastHitAt > Date.now() - 86400000 ? 20 : 0);
      return scoreB - scoreA;
    });
    store.entries = store.entries.slice(0, MAX_ENTRIES);
    rebuildCategoryIndex();
  }
}

function extractSubPatterns(userMsg: string, response: string, category: string, provider: string) {
  const sentences = response.split(/[.!?]\s+/).filter(s => s.length > 20 && s.length < 500);
  if (sentences.length < 2) return;

  const codeBlocks = response.match(/```[\s\S]*?```/g) || [];
  for (const block of codeBlocks.slice(0, 3)) {
    const blockTokens = extractTokens(block.substring(0, 300));
    if (blockTokens.length >= 3) {
      const existing = findMatch(blockTokens, extractBigrams(blockTokens));
      if (!existing) {
        const codeIdx = store.entries.length;
        store.entries.push({
          id: crypto.randomBytes(6).toString("hex"),
          query: `code pattern: ${blockTokens.slice(0, 5).join(" ")}`,
          queryTokens: blockTokens,
          queryBigrams: extractBigrams(blockTokens),
          response: block.substring(0, 2000),
          category: "code",
          provider,
          quality: 0.6,
          hitCount: 0,
          createdAt: Date.now(),
          lastHitAt: Date.now(),
        });
        addToCategoryIndex(codeIdx, "code");
        store.stats.totalCaptured++;
        store.stats.categoryCounts["code"] = (store.stats.categoryCounts["code"] || 0) + 1;
        dirty = true;
      }
    }
  }

  if (sentences.length >= 5) {
    const keyPhrases = sentences
      .filter(s => /\b(because|therefore|means|important|key|critical|always|never)\b/i.test(s))
      .slice(0, 2);
    for (const phrase of keyPhrases) {
      const phraseTokens = extractTokens(phrase);
      if (phraseTokens.length >= 3) {
        const existing = findMatch(phraseTokens, extractBigrams(phraseTokens));
        if (!existing) {
          const insightIdx = store.entries.length;
          store.entries.push({
            id: crypto.randomBytes(6).toString("hex"),
            query: `insight: ${phraseTokens.slice(0, 4).join(" ")}`,
            queryTokens: phraseTokens,
            queryBigrams: extractBigrams(phraseTokens),
            response: phrase.trim(),
            category,
            provider,
            quality: 0.55,
            hitCount: 0,
            createdAt: Date.now(),
            lastHitAt: Date.now(),
          });
          addToCategoryIndex(insightIdx, category);
          store.stats.totalCaptured++;
          store.stats.categoryCounts[category] = (store.stats.categoryCounts[category] || 0) + 1;
          dirty = true;
        }
      }
    }
  }
}

function findMatch(queryTokens: string[], queryBigrams: string[]): DistilledEntry | null {
  let bestMatch: DistilledEntry | null = null;
  let bestScore = 0;

  for (const entry of store.entries) {
    const tokenSim = cosineSimilarity(queryTokens, entry.queryTokens);
    const bigramSim = cosineSimilarity(queryBigrams, entry.queryBigrams);
    const score = tokenSim * 0.6 + bigramSim * 0.4;

    if (score > bestScore && score >= SIMILARITY_THRESHOLD) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestMatch;
}

export function queryDistilledKnowledge(
  messages: Array<{ role: string; content: string }>
): { response: string; confidence: number; source: string } | null {
  const userMsg = messages.filter(m => m.role === "user").map(m => m.content).join(" ");
  if (!userMsg || userMsg.length < 5) return null;

  const queryTokens = extractTokens(userMsg);
  if (queryTokens.length < 1) return null;
  const queryBigrams = extractBigrams(queryTokens);

  const category = detectCategory(userMsg);
  const candidateIndices: Set<number> = new Set();
  if (categoryIndex[category]) {
    for (const idx of categoryIndex[category]) candidateIndices.add(idx);
  }
  if (categoryIndex["general"]) {
    for (const idx of categoryIndex["general"]) candidateIndices.add(idx);
  }
  if (candidateIndices.size < 20) {
    for (let i = 0; i < store.entries.length; i++) candidateIndices.add(i);
  }

  let bestMatch: DistilledEntry | null = null;
  let bestScore = 0;

  for (const idx of candidateIndices) {
    if (idx >= store.entries.length) continue;
    const entry = store.entries[idx];
    const tokenSim = cosineSimilarity(queryTokens, entry.queryTokens);
    const bigramSim = cosineSimilarity(queryBigrams, entry.queryBigrams);
    const score = tokenSim * 0.6 + bigramSim * 0.4;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  const HIGH_CONFIDENCE = 0.35;
  if (bestMatch && bestScore >= HIGH_CONFIDENCE && bestMatch.quality >= 0.3 && bestMatch.hitCount >= 0) {
    bestMatch.hitCount++;
    bestMatch.lastHitAt = Date.now();
    store.stats.totalHits++;
    store.stats.hitRate = store.stats.totalHits / Math.max(1, store.stats.totalCaptured);
    dirty = true;

    return {
      response: bestMatch.response,
      confidence: bestScore,
      source: `distilled:${bestMatch.category}:${bestMatch.provider}`,
    };
  }

  return null;
}

export function getDistillationStats(): DistillationStats & { entryCount: number; topCategories: Array<{ category: string; count: number }> } {
  const topCategories = Object.entries(store.stats.categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    ...store.stats,
    entryCount: store.entries.length,
    topCategories,
  };
}

export function getSovereigntyProgress(): {
  totalKnowledge: number;
  categoryCoverage: Record<string, number>;
  estimatedSelfSufficiency: number;
  avgQuality: number;
  highConfidenceEntries: number;
} {
  const categoryCoverage: Record<string, number> = {};
  let totalQuality = 0;
  let highConfidence = 0;

  for (const entry of store.entries) {
    categoryCoverage[entry.category] = (categoryCoverage[entry.category] || 0) + 1;
    totalQuality += entry.quality;
    if (entry.hitCount >= 2 && entry.quality >= 0.7) highConfidence++;
  }

  const categories = ["code", "finance", "security", "math", "creative", "research", "reasoning", "conversation", "general"];
  let coverageScore = 0;
  for (const cat of categories) {
    const count = categoryCoverage[cat] || 0;
    coverageScore += Math.min(1, count / 5);
  }

  const baseSufficiency = 85;
  const coverageBonus = (coverageScore / categories.length) * 10;
  const confidenceBonus = store.entries.length > 0 ? (highConfidence / Math.max(1, store.entries.length)) * 5 : 0;
  const selfSufficiency = Math.min(100, baseSufficiency + coverageBonus + confidenceBonus);

  return {
    totalKnowledge: store.entries.length,
    categoryCoverage,
    estimatedSelfSufficiency: Math.round(selfSufficiency * 100) / 100,
    avgQuality: store.entries.length > 0 ? Math.round((totalQuality / store.entries.length) * 100) / 100 : 0,
    highConfidenceEntries: highConfidence,
  };
}
