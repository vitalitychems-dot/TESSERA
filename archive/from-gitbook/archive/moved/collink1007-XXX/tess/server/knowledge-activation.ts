import * as fs from "fs";
import * as path from "path";

export interface KnowledgeEntry {
  id: string;
  source: string;
  type: "training" | "benchmark" | "discussion" | "research" | "capability";
  content: string;
  tags: string[];
  usageCount: number;
  lastUsed: number;
  quality: number;
  status: "active" | "archived";
  createdAt: number;
}

export interface KnowledgeFeedEvent {
  entryId: string;
  agentId: string;
  usedAt: number;
  querySnippet: string;
  relevant: boolean;
}

const knowledgeIndex: Map<string, KnowledgeEntry> = new Map();
const knowledgeFeed: KnowledgeFeedEvent[] = [];
let initialized = false;

function loadKnowledgeSources(): void {
  if (initialized) return;
  initialized = true;
  const sources = [
    { file: "server/rllm-corpus.json", type: "training" as const, source: "RLLM Corpus" },
    { file: "server/distilled-knowledge.json", type: "research" as const, source: "Distilled Knowledge" },
    { file: "server/repo-knowledge.json", type: "capability" as const, source: "Repository Knowledge" },
    { file: "server/collective-intelligence.json", type: "capability" as const, source: "Collective Intelligence" },
  ];
  let loaded = 0;
  for (const src of sources) {
    try {
      const fullPath = path.join(process.cwd(), src.file);
      if (!fs.existsSync(fullPath)) continue;
      const raw = fs.readFileSync(fullPath, "utf-8");
      const data = JSON.parse(raw);
      const entries = Array.isArray(data) ? data : (data.entries || data.capabilities || []);
      for (const entry of entries.slice(0, 500)) {
        const content = typeof entry === "string" ? entry :
          (entry.content || entry.output || entry.description || entry.text || JSON.stringify(entry).slice(0, 300));
        if (!content || content.length < 20) continue;
        const tags = entry.tags || entry.categories || [];
        const id = `ke-${src.type}-${loaded++}`;
        knowledgeIndex.set(id, {
          id,
          source: src.source,
          type: src.type,
          content: content.slice(0, 500),
          tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
          usageCount: entry.usageCount || 0,
          lastUsed: entry.lastUsed || 0,
          quality: entry.quality || entry.score || 70,
          status: "active",
          createdAt: entry.timestamp || entry.createdAt || Date.now() - 86400000 * 7,
        });
      }
    } catch {}
  }
  console.log(`[KnowledgeActivation] Indexed ${knowledgeIndex.size} knowledge entries from ${sources.length} sources`);
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length > 3);
}

function score(entry: KnowledgeEntry, queryTokens: string[]): number {
  const contentTokens = tokenize(entry.content);
  const tagTokens = entry.tags.flatMap(t => tokenize(t));
  const allTokens = new Set([...contentTokens, ...tagTokens]);
  let matches = 0;
  for (const qt of queryTokens) {
    if (allTokens.has(qt)) matches++;
    else if ([...allTokens].some(t => t.includes(qt) || qt.includes(t))) matches += 0.5;
  }
  const recencyBonus = entry.lastUsed > Date.now() - 86400000 ? 0.1 : 0;
  const qualityBonus = (entry.quality / 100) * 0.2;
  return (matches / Math.max(1, queryTokens.length)) + recencyBonus + qualityBonus;
}

export function retrieveRelevantKnowledge(query: string, topN = 5, agentId = "system"): KnowledgeEntry[] {
  loadKnowledgeSources();
  if (knowledgeIndex.size === 0) return [];
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];
  const activeEntries = Array.from(knowledgeIndex.values()).filter(e => e.status === "active");
  const scored = activeEntries.map(e => ({ entry: e, score: score(e, queryTokens) })).filter(x => x.score > 0.1).sort((a, b) => b.score - a.score).slice(0, topN);
  for (const { entry } of scored) {
    entry.usageCount++;
    entry.lastUsed = Date.now();
    knowledgeFeed.unshift({ entryId: entry.id, agentId, usedAt: Date.now(), querySnippet: query.slice(0, 80), relevant: true });
    if (knowledgeFeed.length > 200) knowledgeFeed.length = 150;
  }
  return scored.map(x => x.entry);
}

export function buildKnowledgePromptContext(query: string, agentId = "system", topN = 3): string {
  const entries = retrieveRelevantKnowledge(query, topN, agentId);
  if (entries.length === 0) return "";
  const context = entries.map((e, i) => `[KB-${i + 1}] (${e.source}): ${e.content.slice(0, 300)}`).join("\n\n");
  return `\n\n--- Relevant Knowledge Context ---\n${context}\n--- End Knowledge Context ---\n`;
}

export function getKnowledgeFeed(limit = 30): KnowledgeFeedEvent[] {
  loadKnowledgeSources();
  return knowledgeFeed.slice(0, limit);
}

export function getKnowledgeStats(): {
  totalEntries: number;
  activeEntries: number;
  archivedEntries: number;
  byType: Record<string, number>;
  utilizationRate: number;
  recentlyUsed: number;
  feedEvents: number;
} {
  loadKnowledgeSources();
  const entries = Array.from(knowledgeIndex.values());
  const byType: Record<string, number> = {};
  for (const e of entries) byType[e.type] = (byType[e.type] || 0) + 1;
  const used = entries.filter(e => e.usageCount > 0).length;
  const recentlyUsed = entries.filter(e => e.lastUsed > Date.now() - 86400000).length;
  return {
    totalEntries: entries.length,
    activeEntries: entries.filter(e => e.status === "active").length,
    archivedEntries: entries.filter(e => e.status === "archived").length,
    byType,
    utilizationRate: entries.length > 0 ? (used / entries.length) * 100 : 0,
    recentlyUsed,
    feedEvents: knowledgeFeed.length,
  };
}

export function getKnowledgeEntries(limit = 50, typeFilter?: string): KnowledgeEntry[] {
  loadKnowledgeSources();
  let entries = Array.from(knowledgeIndex.values());
  if (typeFilter) entries = entries.filter(e => e.type === typeFilter);
  return entries.sort((a, b) => b.usageCount - a.usageCount).slice(0, limit);
}

export function updateEntryStatus(id: string, status: "active" | "archived"): boolean {
  const entry = knowledgeIndex.get(id);
  if (!entry) return false;
  entry.status = status;
  return true;
}

export function addKnowledgeEntry(entry: Partial<KnowledgeEntry>): KnowledgeEntry {
  loadKnowledgeSources();
  const id = `ke-manual-${Date.now()}`;
  const newEntry: KnowledgeEntry = {
    id,
    source: entry.source || "Manual",
    type: entry.type || "capability",
    content: entry.content || "",
    tags: entry.tags || [],
    usageCount: 0,
    lastUsed: 0,
    quality: entry.quality || 80,
    status: "active",
    createdAt: Date.now(),
  };
  knowledgeIndex.set(id, newEntry);
  return newEntry;
}
