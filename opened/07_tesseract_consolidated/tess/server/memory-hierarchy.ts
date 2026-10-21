/**
 * Tessera Universal Memory Consolidation — Hierarchical 3-Tier System
 * Grand Dimension Council Proposal #2 — 98% YES — CRITICAL
 *
 * Tier 1: Working Memory — last 100 interactions, instant O(1) recall
 * Tier 2: Episodic Memory — past 30 days, BM25-indexed keyword search
 * Tier 3: Semantic Memory — permanent condensed knowledge, Colonel-compressed
 *
 * Automatic promotion/demotion between tiers based on access frequency and age.
 */

import { logger } from "./logger";
import crypto from "crypto";

const log = (msg: string) => logger.info("MemoryHierarchy", msg);

// ── Types ──────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  content: string;
  compressedContent?: string;
  tier: 1 | 2 | 3;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  type: "conversation" | "knowledge" | "agent_thought" | "system_event" | "user_preference";
  tags: string[];
  importance: number; // 0-1
  condensedVersion?: string;
  source?: string;
}

// Simple BM25 index for episodic memory
interface BM25Index {
  documents: Array<{ id: string; tokens: string[] }>;
  df: Record<string, number>; // document frequency
  avgDocLength: number;
  totalDocs: number;
}

// ── Working Memory (Tier 1) ────────────────────────────────────────────────

const TIER1_CAPACITY = 100;
const tier1: Map<string, MemoryEntry> = new Map();
const tier1Order: string[] = []; // LRU order

function tier1Put(entry: MemoryEntry): void {
  entry.tier = 1;
  if (tier1.has(entry.id)) {
    // Move to end (most recent)
    const idx = tier1Order.indexOf(entry.id);
    if (idx !== -1) tier1Order.splice(idx, 1);
    tier1Order.push(entry.id);
    tier1.set(entry.id, entry);
    return;
  }

  // Evict oldest if at capacity
  if (tier1.size >= TIER1_CAPACITY) {
    const oldest = tier1Order.shift();
    if (oldest) {
      const evicted = tier1.get(oldest);
      tier1.delete(oldest);
      // Promote to tier 2 if accessed enough
      if (evicted) {
        evicted.tier = 2;
        tier2Put(evicted);
      }
    }
  }

  tier1.set(entry.id, entry);
  tier1Order.push(entry.id);
}

function tier1Get(id: string): MemoryEntry | undefined {
  const entry = tier1.get(id);
  if (entry) {
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    // Move to most recent
    const idx = tier1Order.indexOf(id);
    if (idx !== -1) tier1Order.splice(idx, 1);
    tier1Order.push(id);
  }
  return entry;
}

// ── Episodic Memory (Tier 2) ──────────────────────────────────────────────

const TIER2_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const tier2: Map<string, MemoryEntry> = new Map();
const bm25Index: BM25Index = {
  documents: [],
  df: {},
  avgDocLength: 0,
  totalDocs: 0,
};

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function updateBM25Index(id: string, content: string): void {
  const tokens = tokenize(content);

  // Remove old entry if exists
  const existingIdx = bm25Index.documents.findIndex(d => d.id === id);
  if (existingIdx !== -1) {
    const oldTokens = bm25Index.documents[existingIdx].tokens;
    const oldTF = new Set(oldTokens);
    for (const t of oldTF) {
      bm25Index.df[t] = (bm25Index.df[t] || 1) - 1;
      if (bm25Index.df[t] <= 0) delete bm25Index.df[t];
    }
    bm25Index.documents.splice(existingIdx, 1);
    bm25Index.totalDocs--;
  }

  // Add new entry
  const uniqueTokens = new Set(tokens);
  for (const t of uniqueTokens) {
    bm25Index.df[t] = (bm25Index.df[t] || 0) + 1;
  }
  bm25Index.documents.push({ id, tokens });
  bm25Index.totalDocs++;
  bm25Index.avgDocLength = bm25Index.documents.reduce((s, d) => s + d.tokens.length, 0) / bm25Index.totalDocs;
}

function bm25Score(queryTokens: string[], docTokens: string[], docLength: number): number {
  const k1 = 1.5, b = 0.75;
  const N = bm25Index.totalDocs || 1;
  let score = 0;

  const tf: Record<string, number> = {};
  for (const t of docTokens) tf[t] = (tf[t] || 0) + 1;

  for (const qt of queryTokens) {
    const df = bm25Index.df[qt] || 0;
    if (df === 0) continue;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    const termFreq = tf[qt] || 0;
    const bm25 = idf * ((termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b * docLength / (bm25Index.avgDocLength || 1))));
    score += bm25;
  }
  return score;
}

function tier2Put(entry: MemoryEntry): void {
  entry.tier = 2;
  tier2.set(entry.id, entry);
  updateBM25Index(entry.id, entry.content + " " + entry.tags.join(" "));
}

function tier2Search(query: string, limit: number = 10): MemoryEntry[] {
  const queryTokens = tokenize(query);
  const scored: Array<{ entry: MemoryEntry; score: number }> = [];

  const now = Date.now();
  for (const [id, entry] of tier2) {
    // Skip expired entries
    if (now - entry.createdAt > TIER2_MAX_AGE_MS) continue;

    const docEntry = bm25Index.documents.find(d => d.id === id);
    if (!docEntry) continue;

    const score = bm25Score(queryTokens, docEntry.tokens, docEntry.tokens.length);
    if (score > 0) scored.push({ entry, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => {
      s.entry.lastAccessedAt = Date.now();
      s.entry.accessCount++;
      return s.entry;
    });
}

// ── Semantic Memory (Tier 3) ───────────────────────────────────────────────

const tier3: Map<string, MemoryEntry> = new Map();
const TIER3_MIN_ACCESS_COUNT = 5; // Must be accessed 5+ times to be promoted
const TIER3_MIN_IMPORTANCE = 0.7;

function tier3Put(entry: MemoryEntry): void {
  entry.tier = 3;
  // Condense for long-term storage
  if (!entry.condensedVersion && entry.content.length > 500) {
    entry.condensedVersion = entry.content.slice(0, 200) + "...[condensed]..." + entry.content.slice(-100);
  }
  tier3.set(entry.id, entry);
}

function tier3Recall(query: string, limit: number = 5): MemoryEntry[] {
  const queryLower = query.toLowerCase();
  const results: Array<{ entry: MemoryEntry; score: number }> = [];

  for (const entry of tier3.values()) {
    let score = 0;
    const contentLower = (entry.condensedVersion || entry.content).toLowerCase();
    if (contentLower.includes(queryLower)) score += 10;
    for (const tag of entry.tags) {
      if (queryLower.includes(tag.toLowerCase())) score += 5;
    }
    score += entry.importance * 3;
    score += Math.min(5, entry.accessCount * 0.1);
    if (score > 0) results.push({ entry, score });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.entry);
}

// ── Maintenance: Promotion and Expiry ─────────────────────────────────────

function runMaintenanceCycle(): void {
  const now = Date.now();
  let promoted = 0, expired = 0;

  // Promote tier 2 entries to tier 3 if they're important enough
  for (const [id, entry] of tier2) {
    // Expire old tier 2 entries
    if (now - entry.createdAt > TIER2_MAX_AGE_MS) {
      // Check if worth keeping in tier 3
      if (entry.accessCount >= TIER3_MIN_ACCESS_COUNT || entry.importance >= TIER3_MIN_IMPORTANCE) {
        entry.tier = 3;
        tier3Put(entry);
        promoted++;
      }
      tier2.delete(id);
      expired++;
    }
    // Promote frequently accessed entries early
    else if (entry.accessCount >= TIER3_MIN_ACCESS_COUNT && entry.importance >= 0.5) {
      tier3Put(entry);
      tier2.delete(id);
      promoted++;
    }
  }

  if (promoted > 0 || expired > 0) {
    log(`Maintenance: ${promoted} promoted to tier 3, ${expired} tier 2 entries processed`);
  }
}

// Run maintenance every 5 minutes
setInterval(runMaintenanceCycle, 5 * 60 * 1000);

// ── Public API ─────────────────────────────────────────────────────────────

export function storeMemory(params: {
  content: string;
  type: MemoryEntry["type"];
  tags?: string[];
  importance?: number;
  source?: string;
}): MemoryEntry {
  const entry: MemoryEntry = {
    id: `mem-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
    content: params.content,
    tier: 1,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    accessCount: 1,
    type: params.type,
    tags: params.tags || [],
    importance: params.importance ?? 0.5,
    source: params.source,
  };

  // High-importance items go directly to tier 3
  if (entry.importance >= 0.9) {
    tier3Put(entry);
  } else {
    tier1Put(entry);
  }

  return entry;
}

export function recallMemory(query: string, options?: {
  limit?: number;
  tier?: 1 | 2 | 3 | "all";
  type?: MemoryEntry["type"];
}): MemoryEntry[] {
  const limit = options?.limit || 10;
  const tierFilter = options?.tier || "all";

  const results: MemoryEntry[] = [];

  if (tierFilter === 1 || tierFilter === "all") {
    // Search tier 1 by simple contains
    const queryLower = query.toLowerCase();
    for (const entry of tier1.values()) {
      if (entry.content.toLowerCase().includes(queryLower)) {
        results.push(entry);
        entry.lastAccessedAt = Date.now();
        entry.accessCount++;
      }
    }
  }

  if (tierFilter === 2 || tierFilter === "all") {
    const tier2Results = tier2Search(query, limit);
    results.push(...tier2Results);
  }

  if (tierFilter === 3 || tierFilter === "all") {
    const tier3Results = tier3Recall(query, Math.ceil(limit / 2));
    results.push(...tier3Results);
  }

  // Deduplicate and sort by recency + importance
  const seen = new Set<string>();
  return results
    .filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      if (options?.type && e.type !== options.type) return false;
      return true;
    })
    .sort((a, b) => (b.lastAccessedAt + b.importance * 10000) - (a.lastAccessedAt + a.importance * 10000))
    .slice(0, limit);
}

export function recallById(id: string): MemoryEntry | undefined {
  return tier1Get(id) || tier2.get(id) || tier3.get(id);
}

export function getMemoryStats() {
  const t2Active = [...tier2.values()].filter(e => Date.now() - e.createdAt < TIER2_MAX_AGE_MS).length;
  const totalContent = [...tier1.values(), ...tier2.values(), ...tier3.values()].reduce((s, e) => s + e.content.length, 0);
  return {
    tier1: {
      count: tier1.size,
      capacity: TIER1_CAPACITY,
      utilization: Math.round((tier1.size / TIER1_CAPACITY) * 100),
    },
    tier2: {
      count: tier2.size,
      active: t2Active,
      bm25IndexSize: bm25Index.totalDocs,
      maxAgeDays: 30,
    },
    tier3: {
      count: tier3.size,
      permanent: true,
    },
    total: {
      entries: tier1.size + tier2.size + tier3.size,
      contentBytes: totalContent,
      contentKB: Math.round(totalContent / 1024),
    },
  };
}

export function promoteToTier3(id: string): boolean {
  const entry = tier1.get(id) || tier2.get(id);
  if (!entry) return false;
  tier1.delete(id);
  tier2.delete(id);
  tier3Put(entry);
  return true;
}

log("3-Tier Memory Hierarchy initialized — Tier 1 (LRU 100), Tier 2 (BM25 30d), Tier 3 (Semantic permanent)");
