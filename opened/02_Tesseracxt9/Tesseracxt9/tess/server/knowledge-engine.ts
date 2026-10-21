import fs from "fs";
import path from "path";
import { buildVectorIndex, vectorSearch, loadVectorIndex, getVectorIndexStats } from "./vector-index";

interface KnowledgeEntry {
  source: string;
  title: string;
  content: string;
  url?: string;
  tags: string[];
  tokens?: string[];
  score?: number;
}

interface Capability {
  name: string;
  category: string;
  description: string;
  agentIds: string[];
  implemented: boolean;
}

interface RetrievalResult {
  entries: KnowledgeEntry[];
  totalSearched: number;
  queryTokens: string[];
  searchMethod: "vector" | "tfidf";
}

interface KnowledgeStats {
  totalEntries: number;
  sources: Record<string, number>;
  capabilities: number;
  implementedCapabilities: number;
  lastIndexed: string;
  recentRetrievals: { query: string; results: number; timestamp: string }[];
}

const INDEX_PATH = path.join(process.cwd(), "server/knowledge-index.json");
const CAPABILITIES_PATH = path.join(process.cwd(), "server/capabilities-registry.json");

let knowledgeIndex: KnowledgeEntry[] = [];
let capabilities: Capability[] = [];
let recentRetrievals: { query: string; results: number; timestamp: string }[] = [];
let lastIndexed = "";
const servedHashes = new Set<string>();
let sacredKnowledgePointer = 0;

function tokenize(text: string | any): string[] {
  const str = String(text || "");
  return str.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "has", "have", "from", "they",
  "been", "said", "each", "which", "their", "will", "way", "about",
  "many", "then", "them", "would", "like", "than", "with", "that",
  "this", "into", "also", "some", "could", "other", "more", "very",
  "what", "just", "where", "when", "make", "time", "been", "there",
]);

function computeTokens() {
  for (const entry of knowledgeIndex) {
    entry.tokens = tokenize(`${entry.title} ${entry.content} ${entry.tags.join(" ")}`);
  }
}

function buildIDF(): Map<string, number> {
  const docFreq = new Map<string, number>();
  const N = knowledgeIndex.length || 1;
  for (const entry of knowledgeIndex) {
    const unique = new Set(entry.tokens || []);
    for (const t of unique) {
      docFreq.set(t, (docFreq.get(t) || 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, freq] of docFreq) {
    idf.set(term, Math.log(N / freq));
  }
  return idf;
}

let idfCache: Map<string, number> | null = null;

export function loadKnowledgeIndex(): number {
  try {
    if (fs.existsSync(INDEX_PATH)) {
      knowledgeIndex = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
      computeTokens();
      idfCache = buildIDF();
      lastIndexed = new Date().toISOString();
    }
  } catch (e) {
    knowledgeIndex = [];
  }

  try {
    if (fs.existsSync(CAPABILITIES_PATH)) {
      capabilities = JSON.parse(fs.readFileSync(CAPABILITIES_PATH, "utf8"));
    }
  } catch {
    capabilities = [];
  }

  loadVectorIndex();

  return knowledgeIndex.length;
}

let hasRebuilt = false;

export function searchKnowledge(query: string, topK: number = 5): RetrievalResult {
  if (!hasRebuilt) {
    rebuildFromSources();
    hasRebuilt = true;
  }

  const queryTokens = tokenize(query);

  const vectorStats = getVectorIndexStats();
  if (vectorStats.totalEntries > 0) {
    const vectorResults = vectorSearch(query, topK * 2, 0.03);
    if (vectorResults.length > 0) {
      const dedupedResults = vectorResults.filter(vr => {
        const hash = contentHash(vr.source, vr.title, vr.content);
        return !servedHashes.has(hash);
      });

      const finalResults = dedupedResults.slice(0, topK).map(vr => ({
        source: vr.source,
        title: vr.title,
        content: vr.content,
        tags: vr.tags,
        url: vr.url,
        score: vr.score,
      }));

      for (const entry of finalResults) {
        servedHashes.add(contentHash(entry.source, entry.title, entry.content));
      }
      if (servedHashes.size > 5000) {
        const arr = Array.from(servedHashes);
        arr.splice(0, arr.length - 2000);
        servedHashes.clear();
        arr.forEach(h => servedHashes.add(h));
      }

      recentRetrievals.push({ query, results: finalResults.length, timestamp: new Date().toISOString() });
      if (recentRetrievals.length > 100) recentRetrievals = recentRetrievals.slice(-100);

      return {
        entries: finalResults,
        totalSearched: vectorStats.totalEntries,
        queryTokens,
        searchMethod: "vector",
      };
    }
  }

  if (queryTokens.length === 0) {
    return { entries: [], totalSearched: knowledgeIndex.length, queryTokens, searchMethod: "tfidf" };
  }

  const scored: KnowledgeEntry[] = knowledgeIndex.map(entry => {
    const entryTokens = entry.tokens || [];
    let score = 0;
    const titleStr = String(entry.title || "").toLowerCase();
    const contentStr = String(entry.content || "").toLowerCase();
    const tagsArr = Array.isArray(entry.tags) ? entry.tags : [];

    for (const qt of queryTokens) {
      const tf = entryTokens.filter(t => t === qt).length / (entryTokens.length || 1);
      const idf = idfCache?.get(qt) || 0;
      score += tf * idf;

      if (titleStr.includes(qt)) score += 0.5;
      if (tagsArr.some(t => String(t || "").toLowerCase().includes(qt))) score += 0.3;
    }

    for (let i = 0; i < queryTokens.length - 1; i++) {
      const bigram = queryTokens[i] + " " + queryTokens[i + 1];
      if (contentStr.includes(bigram)) score += 1.0;
    }

    return { ...entry, score };
  }).filter(e => (e.score || 0) > 0);

  for (const entry of scored) {
    const hash = contentHash(entry.source, entry.title, entry.content);
    if (servedHashes.has(hash)) {
      entry.score = (entry.score || 0) * 0.3;
    }
  }

  scored.sort((a, b) => (b.score || 0) - (a.score || 0));
  const results = scored.slice(0, topK);

  for (const entry of results) {
    const hash = contentHash(entry.source, entry.title, entry.content);
    servedHashes.add(hash);
  }
  if (servedHashes.size > 5000) {
    const arr = Array.from(servedHashes);
    arr.splice(0, arr.length - 2000);
    servedHashes.clear();
    arr.forEach(h => servedHashes.add(h));
  }

  recentRetrievals.push({ query, results: results.length, timestamp: new Date().toISOString() });
  if (recentRetrievals.length > 100) recentRetrievals = recentRetrievals.slice(-100);

  return { entries: results, totalSearched: knowledgeIndex.length, queryTokens, searchMethod: "tfidf" };
}

export function getKnowledgeContext(query: string, maxTokens: number = 1600): string {
  const result = searchKnowledge(query, 10);
  if (result.entries.length === 0) return "";

  let context = "RELEVANT KNOWLEDGE:\n";
  let tokenCount = 0;

  for (const entry of result.entries) {
    const chunk = `[${entry.source}] ${entry.title}: ${entry.content}\n`;
    const chunkTokens = chunk.split(/\s+/).length;
    if (tokenCount + chunkTokens > maxTokens) break;
    context += chunk;
    tokenCount += chunkTokens;
  }

  return context;
}

export function addKnowledge(entry: Omit<KnowledgeEntry, "tokens">): void {
  const full: KnowledgeEntry = { ...entry, tokens: tokenize(`${entry.title} ${entry.content} ${entry.tags.join(" ")}`) };
  knowledgeIndex.push(full);
  idfCache = buildIDF();
  saveIndex();
}

export function refreshIndex(): number {
  return rebuildFromSources();
}

function ingestJSONFile(entries: KnowledgeEntry[], filePath: string, sourceName: string, parser: (data: any) => KnowledgeEntry[]) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return;
    const raw = fs.readFileSync(fullPath, "utf8");
    if (!raw || raw.length < 3) return;
    const data = JSON.parse(raw);
    const items = parser(data);
    for (const item of items) entries.push(item);
  } catch (e: any) {
    console.warn(`[Knowledge] Failed to ingest ${filePath}: ${e?.message || "unknown error"}`);
  }
}

function ingestGenericJSON(data: any): KnowledgeEntry[] {
  const items: KnowledgeEntry[] = [];
  const arr = Array.isArray(data) ? data.slice(-50) : typeof data === "object" && data !== null ? Object.entries(data).slice(0, 50).map(([k, v]) => ({ _key: k, ...(typeof v === "object" && v !== null ? v as any : { value: v }) })) : [];
  for (const e of arr as any[]) {
    const title = e.title || e.name || e.topic || e.category || e._key || e.type || "";
    const content = e.content || e.description || e.summary || e.insight || e.result || e.response || e.message || e.value || (typeof e === "string" ? e : "");
    if (title || content) {
      items.push({
        source: "system-state",
        title: String(title).slice(0, 300),
        content: String(content).slice(0, 1000),
        tags: [e.category || e.type || "system"].filter(Boolean).map(String),
      });
    }
  }
  return items;
}

function contentHash(source: string, title: string, content: string): string {
  const key = `${source}::${title}::${content}`.toLowerCase().replace(/\s+/g, " ");
  let h1 = 0, h2 = 0;
  for (let i = 0; i < key.length; i++) {
    h1 = ((h1 << 5) - h1 + key.charCodeAt(i)) | 0;
    h2 = ((h2 << 7) + h2 + key.charCodeAt(i)) | 0;
  }
  return `${(h1 >>> 0).toString(36)}_${(h2 >>> 0).toString(36)}`;
}

function deduplicateEntries(entries: KnowledgeEntry[]): KnowledgeEntry[] {
  const seen = new Set<string>();
  const result: KnowledgeEntry[] = [];
  for (const entry of entries) {
    const hash = contentHash(entry.source, entry.title, entry.content);
    if (!seen.has(hash)) {
      seen.add(hash);
      result.push(entry);
    }
  }
  return result;
}

function rebuildFromSources(): number {
  const manualEntries = knowledgeIndex.filter(e => e.source === "manual" || e.source === "training" || e.source === "conference-result");
  const entries: KnowledgeEntry[] = [...manualEntries];

  try {
    const cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/sovereign-data-cache.json"), "utf8"));
    const items = Array.isArray(cache) ? cache : Object.values(cache);
    for (const e of items as any[]) {
      if (e.title || e.content || e.description) {
        entries.push({ source: e.source || "sovereign-cache", title: e.title || "", content: (e.content || e.description || e.summary || "").slice(0, 1000), url: e.url || "", tags: e.tags || [] });
      }
    }
  } catch (e: any) { console.warn(`[Knowledge] sovereign-data-cache.json: ${e?.message}`); }

  try {
    const synth = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/knowledge-synthesis.json"), "utf8"));
    const items = Array.isArray(synth) ? synth : Object.values(synth);
    for (const e of items as any[]) {
      if (e.insight || e.title || e.content) {
        entries.push({ source: "synthesis", title: e.title || e.topic || "", content: (e.insight || e.content || e.synthesis || "").slice(0, 1000), tags: e.tags || e.categories || [] });
      }
    }
  } catch (e: any) { console.warn(`[Knowledge] knowledge-synthesis.json: ${e?.message}`); }

  try {
    const evo = JSON.parse(fs.readFileSync(path.join(process.cwd(), "server/evolution-log.json"), "utf8"));
    const items = Array.isArray(evo) ? evo : Object.values(evo);
    const allCaps = new Set<string>();
    const capsByCategory: Record<string, string[]> = {};
    for (const e of items as any[]) {
      const caps = Array.isArray(e.newCaps) ? e.newCaps : (Array.isArray(e.capabilities) ? e.capabilities : []);
      for (const c of caps) {
        if (typeof c === "string") {
          allCaps.add(c);
          const cat = categorizeCapability(c);
          if (!capsByCategory[cat]) capsByCategory[cat] = [];
          capsByCategory[cat].push(c);
        }
      }
    }
    entries.push({ source: "evolution", title: "Discovered Capabilities", content: Array.from(allCaps).join(", "), tags: ["capabilities", "evolution"] });

    capabilities = Array.from(allCaps).map(name => ({
      name,
      category: categorizeCapability(name),
      description: name,
      agentIds: [],
      implemented: false,
    }));
    fs.writeFileSync(CAPABILITIES_PATH, JSON.stringify(capabilities));
  } catch (e: any) { console.warn(`[Knowledge] evolution-log.json: ${e?.message}`); }

  try {
    const cm = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/conference-memory.json"), "utf8"));
    for (const p of (cm.autoProposals || [])) {
      entries.push({ source: "conference-proposal", title: p.title || p.category || "", content: (p.description || p.rationale || JSON.stringify(p).slice(0, 300)), tags: [p.category || "governance"] });
    }
    for (const m of (cm.memory || []).slice(-50)) {
      if (m.lesson || m.insight) {
        entries.push({ source: "conference-memory", title: m.topic || "", content: (m.lesson || m.insight || "").slice(0, 1000), tags: ["learned"] });
      }
    }
  } catch (e: any) { console.warn(`[Knowledge] conference-memory.json: ${e?.message}`); }

  try {
    const dk = JSON.parse(fs.readFileSync(path.join(process.cwd(), "server/distilled-knowledge.json"), "utf8"));
    const items = Array.isArray(dk) ? dk : Object.values(dk);
    for (const e of items as any[]) {
      if (e.query || e.response || e.content) {
        entries.push({ source: "distilled", title: e.query || "", content: (e.response || e.content || "").slice(0, 1000), tags: e.queryTokens || [] });
      }
    }
  } catch (e: any) { console.warn(`[Knowledge] distilled-knowledge.json: ${e?.message}`); }

  try {
    const transcriptsDir = path.join(process.cwd(), "server/conference-transcripts");
    const transcripts = fs.readdirSync(transcriptsDir)
      .filter((f: string) => f.endsWith(".json"))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(transcriptsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 20)
      .map(f => f.name);
    for (const file of transcripts) {
      const data = JSON.parse(fs.readFileSync(path.join(transcriptsDir, file), "utf8"));
      if (data.title && data.results) {
        for (const r of (data.results || []).slice(0, 20)) {
          entries.push({
            source: "conference-result",
            title: r.title || r.proposal || "",
            content: `${r.passed ? "PASSED" : "FAILED"} (${r.approvalPct || 0}%) - ${(r.summary || r.debate || "").slice(0, 300)}`,
            tags: ["conference", r.passed ? "approved" : "rejected"],
          });
        }
      }
    }
  } catch (e: any) { console.warn(`[Knowledge] conference-transcripts: ${e?.message}`); }

  ingestJSONFile(entries, "server/agi-training-state.json", "agi-training", (data) => {
    const items: KnowledgeEntry[] = [];
    for (const [cat, state] of Object.entries(data as Record<string, any>)) {
      if (state && typeof state === "object" && state.score) {
        items.push({ source: "agi-training", title: `AGI: ${cat}`, content: `Score: ${state.score?.toFixed(1)}%, Sessions: ${state.sessions}, Insights: ${(state.insights || []).slice(-3).join("; ")}`, tags: ["agi", "training", cat.toLowerCase()] });
      }
    }
    return items;
  });

  ingestJSONFile(entries, "server/collective-intelligence.json", "collective-intelligence", ingestGenericJSON);
  ingestJSONFile(entries, "server/consciousness-state.json", "consciousness", ingestGenericJSON);
  ingestJSONFile(entries, "server/sovereign-knowledge.json", "sovereign-knowledge", ingestGenericJSON);
  ingestJSONFile(entries, "server/repo-knowledge.json", "repo-knowledge", ingestGenericJSON);
  ingestJSONFile(entries, "server/self-analysis.json", "self-analysis", ingestGenericJSON);
  ingestJSONFile(entries, "server/self-knowledge-map.json", "self-knowledge", ingestGenericJSON);
  ingestJSONFile(entries, "server/world-state.json", "world-state", ingestGenericJSON);
  ingestJSONFile(entries, "server/learned-behaviors.json", "learned-behaviors", ingestGenericJSON);
  ingestJSONFile(entries, "server/sovereignty-data.json", "sovereignty-data", ingestGenericJSON);
  ingestJSONFile(entries, "server/cycle-results.json", "cycle-results", ingestGenericJSON);
  ingestJSONFile(entries, "server/unified-tesseract-state.json", "unified-tesseract", ingestGenericJSON);
  ingestJSONFile(entries, "server/knowledge-base.json", "knowledge-base", ingestGenericJSON);
  ingestJSONFile(entries, "server/fact-check-log.json", "fact-check", ingestGenericJSON);
  ingestJSONFile(entries, "server/rllm-corpus.json", "rllm-corpus", ingestGenericJSON);
  ingestJSONFile(entries, "server/dual-brain-state.json", "dual-brain", ingestGenericJSON);

  ingestJSONFile(entries, "data/grand-council-state.json", "grand-council", ingestGenericJSON);
  ingestJSONFile(entries, "data/evolving-conclusion.json", "evolving-conclusion", ingestGenericJSON);
  ingestJSONFile(entries, "data/synthesis-conference.json", "synthesis-conference", ingestGenericJSON);
  ingestJSONFile(entries, "data/tesseraxt.json", "tesseraxt", ingestGenericJSON);
  ingestJSONFile(entries, "data/secret-society.json", "secret-society", ingestGenericJSON);
  ingestJSONFile(entries, "data/society-intel.json", "society-intel", ingestGenericJSON);
  ingestJSONFile(entries, "data/society-conference.json", "society-conference", ingestGenericJSON);
  ingestJSONFile(entries, "data/tesseraxt-conferences.json", "tesseraxt-conferences", ingestGenericJSON);

  ingestJSONFile(entries, "server/router-stats.json", "router-stats", (data) => {
    const items: KnowledgeEntry[] = [];
    if (data && typeof data === "object") {
      for (const [provider, stats] of Object.entries(data as Record<string, any>)) {
        if (stats && typeof stats === "object") {
          items.push({ source: "router-stats", title: `LLM Provider: ${provider}`, content: `Calls: ${stats.calls || 0}, Successes: ${stats.successes || 0}, Errors: ${stats.errors || 0}, Avg latency: ${stats.avgLatency || 0}ms`, tags: ["llm", "provider", provider] });
        }
      }
    }
    return items;
  });

  ingestJSONFile(entries, "server/phoenix-mesh-state.json", "phoenix-mesh", ingestGenericJSON);
  ingestJSONFile(entries, "server/arbitrage-state.json", "arbitrage", ingestGenericJSON);
  ingestJSONFile(entries, "server/blog-posts.json", "blog-posts", (data) => {
    const items: KnowledgeEntry[] = [];
    const arr = Array.isArray(data) ? data : Object.values(data);
    for (const post of arr.slice(-30) as any[]) {
      if (post.title || post.content) {
        items.push({ source: "blog-posts", title: post.title || "", content: (post.content || post.body || post.summary || "").slice(0, 1000), tags: ["blog", "content", ...(post.tags || [])] });
      }
    }
    return items;
  });

  ingestJSONFile(entries, "server/dimensional-secrets.json", "dimensional-secrets", ingestGenericJSON);
  ingestJSONFile(entries, "server/conversation-corpus.json", "conversation-corpus", (data) => {
    const items: KnowledgeEntry[] = [];
    const arr = Array.isArray(data) ? data : Object.values(data);
    for (const conv of arr.slice(-20) as any[]) {
      if (conv.topic || conv.content || conv.summary) {
        items.push({ source: "conversation-corpus", title: conv.topic || conv.title || "Conversation", content: (conv.summary || conv.content || conv.response || "").slice(0, 1000), tags: ["conversation", "corpus"] });
      }
    }
    return items;
  });

  ingestJSONFile(entries, "server/grand-evaluation-results.json", "grand-evaluation", ingestGenericJSON);
  ingestJSONFile(entries, "server/summit-transcript.json", "summit-transcript", ingestGenericJSON);
  ingestJSONFile(entries, "server/compute-economy-state.json", "compute-economy", ingestGenericJSON);
  ingestJSONFile(entries, "server/marketplace-state.json", "marketplace", ingestGenericJSON);
  ingestJSONFile(entries, "server/token-factory-state.json", "token-factory", ingestGenericJSON);
  ingestJSONFile(entries, "server/wallet-monitor-state.json", "wallet-monitor", ingestGenericJSON);
  ingestJSONFile(entries, "server/real-income-state.json", "real-income", ingestGenericJSON);
  ingestJSONFile(entries, "server/service-arbitrage-state.json", "service-arbitrage", ingestGenericJSON);
  ingestJSONFile(entries, "server/swarm-stats.json", "swarm-stats", ingestGenericJSON);
  ingestJSONFile(entries, "server/compressed-memory.json", "compressed-memory", ingestGenericJSON);
  ingestJSONFile(entries, "server/research_state.json", "research", ingestGenericJSON);

  ingestJSONFile(entries, "data/ad-exchange.json", "ad-exchange", (data) => {
    const items: KnowledgeEntry[] = [];
    if (data && typeof data === "object") {
      items.push({ source: "ad-exchange", title: "Ad Exchange State", content: `Views: ${(data as any).totalViews || 0}, Revenue: $${(data as any).totalRevenue || 0}, Active: ${(data as any).active || false}`, tags: ["income", "advertising"] });
    }
    return items;
  });

  const beforeDedup = entries.length;
  knowledgeIndex = deduplicateEntries(entries);
  const removed = beforeDedup - knowledgeIndex.length;
  if (removed > 0) console.log(`[Knowledge] Deduplication removed ${removed} duplicate entries (${beforeDedup} → ${knowledgeIndex.length})`);
  computeTokens();
  idfCache = buildIDF();
  lastIndexed = new Date().toISOString();
  saveIndex();

  buildVectorIndex(knowledgeIndex.map(e => ({
    source: e.source,
    title: e.title,
    content: e.content,
    tags: e.tags,
    url: e.url,
  })));

  return knowledgeIndex.length;
}

function categorizeCapability(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("code") || n.includes("program") || n.includes("compile") || n.includes("debug")) return "coding";
  if (n.includes("learn") || n.includes("train") || n.includes("knowledge")) return "learning";
  if (n.includes("security") || n.includes("encrypt") || n.includes("auth")) return "security";
  if (n.includes("network") || n.includes("mesh") || n.includes("fleet") || n.includes("p2p")) return "networking";
  if (n.includes("vision") || n.includes("image") || n.includes("visual") || n.includes("pattern")) return "perception";
  if (n.includes("reason") || n.includes("logic") || n.includes("plan") || n.includes("decision")) return "reasoning";
  if (n.includes("memory") || n.includes("store") || n.includes("persist")) return "memory";
  if (n.includes("income") || n.includes("revenue") || n.includes("earn") || n.includes("trade")) return "economics";
  return "general";
}

function saveIndex() {
  try {
    fs.writeFileSync(INDEX_PATH, JSON.stringify(knowledgeIndex.map(({ tokens, ...rest }) => rest)));
  } catch (e: any) { console.warn(`[Knowledge] Failed to save index: ${e?.message}`); }
}

export function getKnowledgeStats(): KnowledgeStats & { vectorIndex: ReturnType<typeof getVectorIndexStats> } {
  const sources: Record<string, number> = {};
  for (const e of knowledgeIndex) {
    sources[e.source] = (sources[e.source] || 0) + 1;
  }
  return {
    totalEntries: knowledgeIndex.length,
    sources,
    capabilities: capabilities.length,
    implementedCapabilities: capabilities.filter(c => c.implemented).length,
    lastIndexed,
    recentRetrievals: recentRetrievals.slice(-20),
    vectorIndex: getVectorIndexStats(),
  };
}

export function getCapabilities(): Capability[] {
  return capabilities;
}

export function getCapabilitiesByCategory(): Record<string, Capability[]> {
  const result: Record<string, Capability[]> = {};
  for (const c of capabilities) {
    if (!result[c.category]) result[c.category] = [];
    result[c.category].push(c);
  }
  return result;
}

loadKnowledgeIndex();
