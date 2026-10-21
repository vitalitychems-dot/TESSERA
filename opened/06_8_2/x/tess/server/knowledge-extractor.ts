import { buildVectorIndex, vectorSearchSync, getVectorIndexStats } from "./agent-system-archive";

const LOG_PREFIX = "[KnowledgeExtractor]";

interface ExtractedKnowledge {
  id: string;
  topic: string;
  content: string;
  source: string;
  provider: string;
  extractedAt: number;
  category: string;
  confidence: number;
  usageCount: number;
}

interface KnowledgeStats {
  totalEntries: number;
  categories: Record<string, number>;
  topProviders: Record<string, number>;
  lastExtraction: number;
  selfSufficiencyScore: number;
}

const knowledgeBase: ExtractedKnowledge[] = [];
const KNOWLEDGE_CATEGORIES = [
  "code-patterns", "architecture", "algorithms", "security",
  "language-models", "training-techniques", "optimization",
  "prompt-engineering", "tokenization", "embeddings",
  "inference-optimization", "model-compression", "fine-tuning",
  "reasoning-chains", "attention-mechanisms", "transformer-architecture",
  "general-knowledge", "science", "mathematics", "philosophy",
  "economics", "cryptography", "networking", "systems-design",
];

const MAX_KNOWLEDGE = 5000;
let extractionCount = 0;

function categorizeContent(content: string): string {
  const lower = content.toLowerCase();
  const categoryScores: Record<string, number> = {};

  const keywords: Record<string, string[]> = {
    "code-patterns": ["function", "class", "const", "async", "await", "import", "export", "interface", "type"],
    "architecture": ["microservice", "monolith", "event-driven", "serverless", "distributed", "scalable"],
    "algorithms": ["sort", "search", "graph", "tree", "dynamic programming", "recursion", "complexity"],
    "security": ["encryption", "auth", "token", "hash", "certificate", "vulnerability", "firewall"],
    "language-models": ["llm", "gpt", "claude", "model", "inference", "neural", "weights"],
    "training-techniques": ["training", "fine-tune", "dataset", "epoch", "gradient", "backprop", "loss"],
    "optimization": ["optimize", "cache", "performance", "latency", "throughput", "efficient"],
    "prompt-engineering": ["prompt", "system message", "instruction", "chain of thought", "few-shot"],
    "tokenization": ["token", "tokenizer", "bpe", "wordpiece", "vocabulary", "encode"],
    "transformer-architecture": ["transformer", "attention", "self-attention", "multi-head", "layer norm"],
    "reasoning-chains": ["reasoning", "step by step", "logical", "deduction", "inference chain"],
    "economics": ["market", "price", "supply", "demand", "trade", "arbitrage", "profit"],
    "cryptography": ["blockchain", "hash", "signature", "wallet", "consensus", "merkle"],
    "systems-design": ["load balancer", "database", "queue", "cache", "replication", "sharding"],
    "science": ["physics", "chemistry", "biology", "quantum", "evolution", "energy", "matter"],
    "mathematics": ["equation", "theorem", "proof", "calculus", "algebra", "probability", "statistics"],
    "philosophy": ["consciousness", "ethics", "existence", "knowledge", "reality", "mind", "truth"],
  };

  for (const [cat, words] of Object.entries(keywords)) {
    categoryScores[cat] = words.filter(w => lower.includes(w)).length;
  }

  let best = "general-knowledge";
  let bestScore = 0;
  for (const [cat, score] of Object.entries(categoryScores)) {
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best;
}

function computeConfidence(content: string): number {
  let score = 0.5;
  if (content.length > 200) score += 0.1;
  if (content.length > 500) score += 0.1;
  if (content.includes("because") || content.includes("therefore") || content.includes("specifically")) score += 0.05;
  if (/\d+/.test(content)) score += 0.05;
  if (content.includes("example") || content.includes("for instance")) score += 0.05;
  if (content.includes("```") || content.includes("function") || content.includes("class ")) score += 0.1;
  return Math.min(score, 1.0);
}

function isDuplicate(topic: string, content: string): boolean {
  const contentLower = content.toLowerCase().slice(0, 100);
  return knowledgeBase.some(k => {
    if (k.topic === topic) return true;
    const existingLower = k.content.toLowerCase().slice(0, 100);
    let overlap = 0;
    const words = contentLower.split(/\s+/);
    const existingWords = new Set(existingLower.split(/\s+/));
    for (const w of words) {
      if (existingWords.has(w) && w.length > 4) overlap++;
    }
    return overlap > words.length * 0.7;
  });
}

export function extractKnowledge(
  response: string,
  provider: string,
  promptTopic?: string,
): ExtractedKnowledge | null {
  if (!response || response.length < 50) return null;

  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length < 2) return null;

  const keyContent = sentences
    .filter(s => {
      const lower = s.toLowerCase().trim();
      if (lower.startsWith("i ") || lower.startsWith("sure") || lower.startsWith("of course")) return false;
      if (lower.includes("i'm an ai") || lower.includes("i cannot")) return false;
      return true;
    })
    .slice(0, 5)
    .map(s => s.trim())
    .join(". ");

  if (keyContent.length < 40) return null;

  const category = categorizeContent(keyContent);
  const topic = promptTopic || keyContent.split(/[.!?]/)[0].trim().slice(0, 80);

  if (isDuplicate(topic, keyContent)) return null;

  const entry: ExtractedKnowledge = {
    id: `know-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    topic,
    content: keyContent.slice(0, 1000),
    source: "llm-response",
    provider,
    extractedAt: Date.now(),
    category,
    confidence: computeConfidence(keyContent),
    usageCount: 0,
  };

  knowledgeBase.push(entry);
  if (knowledgeBase.length > MAX_KNOWLEDGE) {
    knowledgeBase.sort((a, b) => b.usageCount - a.usageCount || b.confidence - a.confidence);
    knowledgeBase.length = MAX_KNOWLEDGE - 100;
  }

  extractionCount++;

  setImmediate(async () => {
    try {
      await buildVectorIndex([{
        source: `kb-${entry.provider}`,
        title: entry.topic,
        content: entry.content,
        tags: [entry.category, entry.provider, "sovereign-knowledge"],
      }]);
    } catch {}
  });

  return entry;
}

export function searchKnowledge(query: string, limit: number = 10): ExtractedKnowledge[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  const scored = knowledgeBase.map(k => {
    const text = (k.topic + " " + k.content + " " + k.category).toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      if (text.includes(word)) score += 1;
    }
    score += k.confidence * 0.5;
    score += Math.min(k.usageCount * 0.1, 1);
    return { entry: k, score };
  });

  return scored
    .filter(s => s.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => {
      s.entry.usageCount++;
      return s.entry;
    });
}

export function getKnowledgeStats(): KnowledgeStats {
  const categories: Record<string, number> = {};
  const topProviders: Record<string, number> = {};

  for (const k of knowledgeBase) {
    categories[k.category] = (categories[k.category] || 0) + 1;
    topProviders[k.provider] = (topProviders[k.provider] || 0) + 1;
  }

  const totalPossibleCategories = KNOWLEDGE_CATEGORIES.length;
  const coveredCategories = Object.keys(categories).length;
  const avgConfidence = knowledgeBase.length > 0
    ? knowledgeBase.reduce((s, k) => s + k.confidence, 0) / knowledgeBase.length
    : 0;

  const selfSufficiencyScore = Math.min(
    ((coveredCategories / totalPossibleCategories) * 40) +
    (Math.min(knowledgeBase.length / 500, 1) * 30) +
    (avgConfidence * 30),
    100
  );

  return {
    totalEntries: knowledgeBase.length,
    categories,
    topProviders,
    lastExtraction: knowledgeBase.length > 0 ? knowledgeBase[knowledgeBase.length - 1].extractedAt : 0,
    selfSufficiencyScore,
  };
}

export function getKnowledgeBase(): ExtractedKnowledge[] {
  return knowledgeBase;
}

export function getExtractionCount(): number {
  return extractionCount;
}

let knowledgeHits = 0;
let knowledgeMisses = 0;

export function queryKnowledgeForPrompt(prompt: string): string | null {
  const realTimeKeywords = /\b(price|bitcoin|btc|ethereum|eth|solana|sol|weather|news|today|live|current|trending|stock|market|score|sports|election|breaking|right now)\b/i;
  if (realTimeKeywords.test(prompt)) {
    knowledgeMisses++;
    return null;
  }

  const vectorResults = vectorSearchSync(prompt, 3, 0.15);
  if (vectorResults.length > 0 && vectorResults[0].score >= 0.35) {
    knowledgeHits++;
    const topKB = vectorResults.find(r => r.tags?.includes("sovereign-knowledge"));
    const result = topKB || vectorResults[0];
    const content = vectorResults.map(r => r.content).join(" Additionally, ");
    return content.slice(0, 1500);
  }

  if (knowledgeBase.length < 10) {
    knowledgeMisses++;
    return null;
  }

  const queryWords = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (queryWords.length === 0) { knowledgeMisses++; return null; }

  const best: { entry: ExtractedKnowledge; score: number }[] = [];
  for (const k of knowledgeBase) {
    const text = (k.topic + " " + k.content + " " + k.category).toLowerCase();
    let score = 0;
    let matchCount = 0;
    for (const word of queryWords) {
      if (text.includes(word)) { score += 1; matchCount++; }
    }
    const matchRatio = matchCount / queryWords.length;
    if (matchRatio >= 0.6 && score >= 3) {
      score += k.confidence * 2;
      score += Math.min(k.usageCount * 0.05, 0.5);
      best.push({ entry: k, score });
    }
  }

  if (best.length === 0 || best.sort((a, b) => b.score - a.score)[0].score < 5) {
    knowledgeMisses++;
    return null;
  }

  const top = best.slice(0, 3);
  top[0].entry.usageCount++;
  knowledgeHits++;

  return top.map(t => t.entry.content).join(" Additionally, ").slice(0, 1500);
}

export function getAbsorptionStats() {
  const stats = getKnowledgeStats();
  const totalQueries = knowledgeHits + knowledgeMisses;
  const hitRate = totalQueries > 0 ? (knowledgeHits / totalQueries) * 100 : 0;

  let vectorStats: any = null;
  try { vectorStats = getVectorIndexStats(); } catch {}

  return {
    totalKnowledgeEntries: stats.totalEntries,
    categories: stats.categories,
    topProviders: stats.topProviders,
    selfSufficiencyScore: Math.round(stats.selfSufficiencyScore),
    knowledgeHits,
    knowledgeMisses,
    totalQueries,
    hitRate: Math.round(hitRate * 10) / 10,
    absorptionRate: extractionCount,
    lastExtraction: stats.lastExtraction,
    avgConfidence: stats.totalEntries > 0
      ? Math.round((knowledgeBase.reduce((s, k) => s + k.confidence, 0) / knowledgeBase.length) * 100)
      : 0,
    vectorIndex: vectorStats ? {
      totalVectorized: vectorStats.totalEntries,
      lastBuilt: vectorStats.lastBuilt,
      embeddingModel: vectorStats.embeddingModel,
      embeddingDim: vectorStats.embeddingDim,
      realEmbeddingsEnabled: vectorStats.realEmbeddingsEnabled,
    } : null,
  };
}

const PATTERN_LIBRARY: Record<string, string[]> = {};

export function extractPatterns(response: string, provider: string): void {
  const codeBlocks = response.match(/```[\s\S]*?```/g);
  if (codeBlocks) {
    for (const block of codeBlocks) {
      const code = block.replace(/```\w*\n?/g, "").trim();
      if (code.length > 30 && code.length < 2000) {
        const key = categorizeContent(code);
        if (!PATTERN_LIBRARY[key]) PATTERN_LIBRARY[key] = [];
        if (PATTERN_LIBRARY[key].length < 50) {
          PATTERN_LIBRARY[key].push(code);
        }
      }
    }
  }

  const techniques = response.match(/(?:technique|approach|method|strategy|pattern|algorithm):\s*([^\n.]+)/gi);
  if (techniques) {
    for (const t of techniques) {
      extractKnowledge(t, provider, "technique-" + t.slice(0, 40));
    }
  }
}

export function getPatternLibrary(): Record<string, string[]> {
  return PATTERN_LIBRARY;
}

export function buildSelfSufficientPrompt(query: string): string {
  const relevant = searchKnowledge(query, 5);
  if (relevant.length === 0) return "";

  return "\n\n[INTERNAL KNOWLEDGE BASE — learned from previous interactions]\n" +
    relevant.map((k, i) => `${i + 1}. [${k.category}] ${k.content.slice(0, 200)}`).join("\n") +
    "\n[Use the above knowledge to reduce dependency on external providers]\n";
}
