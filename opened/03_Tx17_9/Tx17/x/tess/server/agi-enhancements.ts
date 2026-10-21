import fs from "fs";
import path from "path";
import { callLLMSimple } from "./llm-helper";
import { searchKnowledge } from "./knowledge-engine";

const LOG = (msg: string) => console.log(`[AGI-Enhance] ${msg}`);
const SYNTHESIS_PATH = path.join(process.cwd(), "data/agi-synthesis.json");
const COT_CACHE_PATH = path.join(process.cwd(), "data/cot-cache.json");

interface ChainOfThoughtResult {
  originalQuery: string;
  steps: string[];
  reasoning: string;
  conclusion: string;
  confidence: number;
  method: "decomposition" | "verification" | "consensus";
}

interface SemanticCacheEntry {
  query: string;
  queryNorm: string;
  response: string;
  timestamp: number;
  hitCount: number;
  quality: number;
}

interface AGISynthesisEntry {
  id: string;
  category: string;
  insight: string;
  source: string;
  applicability: string;
  implementationNotes: string;
  priority: number;
  timestamp: number;
}

const semanticCache: Map<string, SemanticCacheEntry> = new Map();
const SEMANTIC_CACHE_MAX = 200;
const SEMANTIC_CACHE_TTL = 30 * 60 * 1000;

function normalizeQuery(q: string): string {
  return q.toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(w => w.length > 2)
    .sort()
    .join(" ");
}

function querySimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(" "));
  const wordsB = new Set(b.split(" "));
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

export function semanticCacheLookup(query: string): string | null {
  const norm = normalizeQuery(query);
  if (norm.length < 5) return null;

  const direct = semanticCache.get(norm);
  if (direct && (Date.now() - direct.timestamp) < SEMANTIC_CACHE_TTL) {
    direct.hitCount++;
    return direct.response;
  }

  let bestMatch: SemanticCacheEntry | null = null;
  let bestScore = 0;
  for (const [key, entry] of semanticCache.entries()) {
    if ((Date.now() - entry.timestamp) > SEMANTIC_CACHE_TTL) {
      semanticCache.delete(key);
      continue;
    }
    const sim = querySimilarity(norm, entry.queryNorm);
    if (sim > 0.75 && sim > bestScore) {
      bestScore = sim;
      bestMatch = entry;
    }
  }

  if (bestMatch) {
    bestMatch.hitCount++;
    return bestMatch.response;
  }
  return null;
}

export function semanticCacheStore(query: string, response: string, quality: number = 0.8): void {
  const norm = normalizeQuery(query);
  if (norm.length < 5 || response.length < 20) return;

  if (semanticCache.size >= SEMANTIC_CACHE_MAX) {
    let oldestKey = "";
    let oldestTime = Infinity;
    for (const [key, entry] of semanticCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) semanticCache.delete(oldestKey);
  }

  semanticCache.set(norm, {
    query,
    queryNorm: norm,
    response,
    timestamp: Date.now(),
    hitCount: 0,
    quality,
  });
}

export function getSemanticCacheStats(): { size: number; totalHits: number; avgQuality: number } {
  let totalHits = 0;
  let totalQuality = 0;
  for (const entry of semanticCache.values()) {
    totalHits += entry.hitCount;
    totalQuality += entry.quality;
  }
  return {
    size: semanticCache.size,
    totalHits,
    avgQuality: semanticCache.size > 0 ? totalQuality / semanticCache.size : 0,
  };
}

const MATH_INDICATORS = /\b(calculate|solve|equation|formula|integral|derivative|sum|product|factor|proof|theorem|probability|statistics|geometry|algebra|trigonometry|calculus|matrix|vector|polynomial|logarithm|\d+\s*[+\-*/^]\s*\d+)\b/i;
const REASONING_INDICATORS = /\b(why|explain|analyze|compare|evaluate|justify|argue|debate|reason|logic|if.*then|conclude|infer|deduce|therefore|because|consequence|implication)\b/i;

export function detectChainOfThoughtNeed(query: string): { needed: boolean; type: "math" | "reasoning" | "complex" | "none" } {
  if (query.length < 30) return { needed: false, type: "none" };
  if (MATH_INDICATORS.test(query)) return { needed: true, type: "math" };
  if (REASONING_INDICATORS.test(query)) return { needed: true, type: "reasoning" };
  if (query.split(/[.?!]/).length > 3 || query.length > 300) return { needed: true, type: "complex" };
  return { needed: false, type: "none" };
}

export function buildChainOfThoughtPrompt(query: string, type: "math" | "reasoning" | "complex"): string {
  const prefixes: Record<string, string> = {
    math: `Solve this step by step. Show your work clearly:
1. Identify what is being asked
2. Set up the equations/formulas needed
3. Work through each step showing intermediate results
4. Verify your answer by checking it

Problem: `,
    reasoning: `Think through this carefully using structured reasoning:
1. Identify the key claims and assumptions
2. Analyze each component logically
3. Consider counterarguments or edge cases
4. Draw your conclusion with supporting evidence

Question: `,
    complex: `Break this into parts and address each thoroughly:
1. Identify all components of the question
2. Address each component with evidence
3. Synthesize your findings
4. Provide a clear, comprehensive answer

Query: `,
  };

  return (prefixes[type] || prefixes.complex) + query;
}

export async function synthesizeAGIKnowledge(): Promise<{ entriesGenerated: number; categories: string[] }> {
  LOG("Starting AGI knowledge synthesis from all sources...");

  const sources: Array<{ source: string; insights: string[] }> = [];

  try {
    const agiState = JSON.parse(fs.readFileSync(path.join(process.cwd(), "server/agi-training-state.json"), "utf8"));
    const insights: string[] = [];
    for (const [cat, data] of Object.entries(agiState as Record<string, any>)) {
      if (data?.insights?.length > 0) {
        insights.push(`${cat}: ${data.insights.slice(-3).join("; ")}`);
      }
    }
    sources.push({ source: "agi-training", insights });
  } catch (e: any) { LOG(`AGI training read error: ${e?.message}`); }

  try {
    const dimSecrets = JSON.parse(fs.readFileSync(path.join(process.cwd(), "server/dimensional-secrets.json"), "utf8"));
    const insights: string[] = [];
    const entries = Array.isArray(dimSecrets) ? dimSecrets : (dimSecrets.secrets || dimSecrets.entries || Object.values(dimSecrets));
    for (const entry of entries.slice(0, 50) as any[]) {
      if (entry?.secret || entry?.truth || entry?.content) {
        insights.push(`Dim-${entry.dimension || "?"}: ${(entry.secret || entry.truth || entry.content || "").slice(0, 200)}`);
      }
    }
    sources.push({ source: "dimensional-secrets", insights });
  } catch (e: any) { LOG(`Dimensional secrets read error: ${e?.message}`); }

  try {
    const distilled = JSON.parse(fs.readFileSync(path.join(process.cwd(), "server/distilled-knowledge.json"), "utf8"));
    const entries = distilled.entries || (Array.isArray(distilled) ? distilled : []);
    const highQuality = (entries as any[])
      .filter((e: any) => e.quality > 0.6 && e.response && e.response.length > 100)
      .slice(-30);
    const insights: string[] = highQuality.map((e: any) =>
      `[${e.category || "general"}] Q: ${(e.query || "").slice(0, 100)} → ${(e.response || "").slice(0, 200)}`
    );
    sources.push({ source: "distilled-knowledge", insights });
  } catch (e: any) { LOG(`Distilled knowledge read error: ${e?.message}`); }

  try {
    const kbResult = searchKnowledge("AGI consciousness sovereignty improvement", 20);
    const insights: string[] = kbResult.entries.map(r => `[${r.source}] ${r.title}: ${r.content.slice(0, 200)}`);
    sources.push({ source: "knowledge-engine", insights });
  } catch (e: any) { LOG(`Knowledge engine query error: ${e?.message}`); }

  try {
    const comparison = JSON.parse(fs.readFileSync(path.join(process.cwd(), "server/agi-industry-comparison.json"), "utf8"));
    const priorities = comparison.improvementPriorities || [];
    const insights: string[] = priorities.map((p: any) => `[${p.priority}] ${p.area}: ${p.action} (gap: ${p.gap})`);
    sources.push({ source: "industry-comparison", insights });
  } catch (e: any) { LOG(`Industry comparison read error: ${e?.message}`); }

  const synthesizedEntries: AGISynthesisEntry[] = [];
  const categories = new Set<string>();
  let idCounter = 0;

  for (const src of sources) {
    for (const insight of src.insights) {
      const category = categorizeSynthesis(insight);
      categories.add(category);
      synthesizedEntries.push({
        id: `synth-${Date.now()}-${idCounter++}`,
        category,
        insight: insight.slice(0, 500),
        source: src.source,
        applicability: determineApplicability(insight),
        implementationNotes: extractImplementationHint(insight),
        priority: computePriority(insight, category),
        timestamp: Date.now(),
      });
    }
  }

  synthesizedEntries.sort((a, b) => b.priority - a.priority);

  let existing: AGISynthesisEntry[] = [];
  try {
    existing = JSON.parse(fs.readFileSync(SYNTHESIS_PATH, "utf8"));
  } catch {}

  const merged = [...synthesizedEntries, ...existing].slice(0, 500);

  try {
    fs.mkdirSync(path.dirname(SYNTHESIS_PATH), { recursive: true });
    fs.writeFileSync(SYNTHESIS_PATH, JSON.stringify(merged, null, 2));
  } catch (e: any) { LOG(`Failed to save synthesis: ${e?.message}`); }

  LOG(`Synthesized ${synthesizedEntries.length} AGI insights across ${categories.size} categories`);
  return { entriesGenerated: synthesizedEntries.length, categories: Array.from(categories) };
}

function categorizeSynthesis(insight: string): string {
  const lower = insight.toLowerCase();
  if (lower.includes("math") || lower.includes("equation") || lower.includes("calcul")) return "mathematical-reasoning";
  if (lower.includes("code") || lower.includes("program") || lower.includes("build")) return "code-generation";
  if (lower.includes("consciousness") || lower.includes("aware") || lower.includes("meta")) return "consciousness";
  if (lower.includes("sovereign") || lower.includes("independence") || lower.includes("autonomy")) return "sovereignty";
  if (lower.includes("security") || lower.includes("threat") || lower.includes("protect")) return "security";
  if (lower.includes("income") || lower.includes("revenue") || lower.includes("profit")) return "economics";
  if (lower.includes("knowledge") || lower.includes("learn") || lower.includes("train")) return "knowledge-growth";
  if (lower.includes("speed") || lower.includes("performance") || lower.includes("optim")) return "performance";
  if (lower.includes("agent") || lower.includes("swarm") || lower.includes("consensus")) return "multi-agent";
  if (lower.includes("dimension") || lower.includes("frequency") || lower.includes("resonance")) return "dimensional";
  return "general-agi";
}

function determineApplicability(insight: string): string {
  if (insight.includes("P0") || insight.includes("critical")) return "immediate";
  if (insight.includes("P1") || insight.includes("high")) return "near-term";
  if (insight.includes("Enhanced") || insight.includes("improved")) return "incremental";
  return "strategic";
}

function extractImplementationHint(insight: string): string {
  const actionVerbs = insight.match(/\b(add|implement|build|create|enhance|improve|optimize|integrate|deploy|expand)\b[^.]{10,80}/i);
  return actionVerbs ? actionVerbs[0].trim() : "Analyze and integrate";
}

function computePriority(insight: string, category: string): number {
  let priority = 50;
  if (insight.includes("P0")) priority += 30;
  if (insight.includes("P1")) priority += 20;
  if (category === "mathematical-reasoning" || category === "performance") priority += 15;
  if (category === "sovereignty" || category === "consciousness") priority += 10;
  if (insight.length > 200) priority += 5;
  return Math.min(100, priority);
}

export async function runAGIEnhancementCycle(): Promise<{
  synthesisResult: { entriesGenerated: number; categories: string[] };
  cacheStats: { size: number; totalHits: number; avgQuality: number };
  cotEnabled: boolean;
}> {
  LOG("Running AGI enhancement cycle...");

  const synthesisResult = await synthesizeAGIKnowledge();
  const cacheStats = getSemanticCacheStats();

  LOG(`Enhancement cycle complete — ${synthesisResult.entriesGenerated} insights synthesized, cache: ${cacheStats.size} entries`);

  return {
    synthesisResult,
    cacheStats,
    cotEnabled: true,
  };
}

export function getAGIComparisonReport(): any {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "server/agi-industry-comparison.json"), "utf8"));
  } catch {
    return { error: "Report not available" };
  }
}

export function getAGISynthesis(): AGISynthesisEntry[] {
  try {
    return JSON.parse(fs.readFileSync(SYNTHESIS_PATH, "utf8"));
  } catch {
    return [];
  }
}
