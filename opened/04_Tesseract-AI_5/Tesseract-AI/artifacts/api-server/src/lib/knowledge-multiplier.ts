/**
 * Unified Knowledge Multiplier
 *
 * Aggregates knowledge from all sources (children reports, mesh peer syncs, fleet node data)
 * into a unified knowledge store. Implements deduplication, quality scoring, and automatic
 * distribution so new knowledge spreads to all nodes. Tracks knowledge provenance and
 * contribution metrics per agent/child/node.
 */

import crypto from "crypto";
import { TESSERA_AGENTS } from "./tessera-persona.js";

const LOG_PREFIX = "[KnowledgeMultiplier]";

export type KnowledgeSource = "agent-child" | "mesh-peer" | "fleet-node" | "grand-council" | "direct-agent" | "seed";

export interface KnowledgeEntry {
  id: string;
  hash: string;
  content: string;
  summary: string;
  source: KnowledgeSource;
  sourceId: string;
  sourceName: string;
  parentAgentId: string;
  domain: string;
  tags: string[];
  qualityScore: number;
  trustScore: number;
  compositeScore: number;
  createdAt: number;
  lastDistributedAt: number | null;
  distributedTo: string[];
  accessCount: number;
  duplicate: boolean;
  duplicateOf: string | null;
}

export interface ContributionMetrics {
  sourceId: string;
  sourceName: string;
  sourceType: KnowledgeSource;
  parentAgentId: string;
  totalContributions: number;
  uniqueContributions: number;
  duplicates: number;
  avgQualityScore: number;
  avgTrustScore: number;
  totalDistributions: number;
  topDomains: string[];
}

export interface MultiplierStatus {
  totalEntries: number;
  uniqueEntries: number;
  duplicatesFiltered: number;
  totalDistributions: number;
  avgQualityScore: number;
  sourceBreakdown: Record<KnowledgeSource, number>;
  topContributors: ContributionMetrics[];
  domainCoverage: Record<string, number>;
  recentEntries: KnowledgeEntry[];
}

const knowledgeStore = new Map<string, KnowledgeEntry>();
const hashIndex = new Map<string, string>();

function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content.toLowerCase().trim()).digest("hex").slice(0, 32);
}

function computeQualityScore(content: string, source: KnowledgeSource): number {
  let score = 0.5;

  if (content.length > 200) score += 0.1;
  if (content.length > 500) score += 0.1;

  const sourceBonus: Record<KnowledgeSource, number> = {
    "grand-council": 0.2,
    "direct-agent": 0.15,
    "agent-child": 0.1,
    "mesh-peer": 0.05,
    "fleet-node": 0.05,
    "seed": 0.15,
  };
  score += sourceBonus[source] ?? 0;

  const hasFactPattern = /\b(is|are|was|were|has|have|will)\b/i.test(content);
  if (hasFactPattern) score += 0.05;

  return Math.min(1, Math.max(0, score));
}

function computeTrustScore(source: KnowledgeSource, _sourceId: string): number {
  const baseScores: Record<KnowledgeSource, number> = {
    "grand-council": 0.95,
    "direct-agent": 0.85,
    "seed": 0.9,
    "agent-child": 0.7,
    "mesh-peer": 0.6,
    "fleet-node": 0.65,
  };
  return Math.min(1, baseScores[source] ?? 0.5);
}

function extractDomain(content: string, tags: string[]): string {
  if (tags.length > 0) return tags[0];

  const domainKeywords: [RegExp, string][] = [
    [/security|encrypt|cryptograph/i, "security"],
    [/mesh|network|node|peer/i, "mesh-infrastructure"],
    [/agent|spawn|child|council/i, "agent-systems"],
    [/knowledge|learn|train/i, "knowledge-management"],
    [/sovereign|independence|autonomous/i, "sovereignty"],
    [/consensus|vote|deliberat/i, "governance"],
    [/deploy|distribut|replicate/i, "distribution"],
  ];

  for (const [pattern, domain] of domainKeywords) {
    if (pattern.test(content)) return domain;
  }

  return "general";
}

export function ingestKnowledge(
  content: string,
  source: KnowledgeSource,
  sourceId: string,
  sourceName: string,
  parentAgentId: string,
  tags: string[] = [],
  summary?: string
): KnowledgeEntry | null {
  if (!content || content.trim().length < 10) return null;

  const hash = computeHash(content);

  const existingId = hashIndex.get(hash);
  if (existingId) {
    const existing = knowledgeStore.get(existingId);
    if (existing) {
      existing.accessCount++;
      return {
        ...existing,
        duplicate: true,
        duplicateOf: existingId,
      };
    }
  }

  const id = `kn-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  const qualityScore = computeQualityScore(content, source);
  const trustScore = computeTrustScore(source, sourceId);

  const entry: KnowledgeEntry = {
    id,
    hash,
    content,
    summary: summary ?? content.slice(0, 150) + (content.length > 150 ? "..." : ""),
    source,
    sourceId,
    sourceName,
    parentAgentId,
    domain: extractDomain(content, tags),
    tags,
    qualityScore,
    trustScore,
    compositeScore: (qualityScore * 0.6 + trustScore * 0.4),
    createdAt: Date.now(),
    lastDistributedAt: null,
    distributedTo: [],
    accessCount: 0,
    duplicate: false,
    duplicateOf: null,
  };

  knowledgeStore.set(id, entry);
  hashIndex.set(hash, id);

  return entry;
}

export function distributeKnowledge(entryId: string, targetNodes: string[]): number {
  const entry = knowledgeStore.get(entryId);
  if (!entry) return 0;

  const newTargets = targetNodes.filter(t => !entry.distributedTo.includes(t));
  entry.distributedTo.push(...newTargets);
  entry.lastDistributedAt = Date.now();

  return newTargets.length;
}

export function runDistributionCycle(targetNodes: string[]): { distributed: number; entries: number } {
  const undistributed = Array.from(knowledgeStore.values())
    .filter(e => !e.duplicate && (e.distributedTo.length === 0 || e.lastDistributedAt === null))
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, 50);

  let totalDistributed = 0;
  for (const entry of undistributed) {
    const dist = distributeKnowledge(entry.id, targetNodes);
    totalDistributed += dist;
  }

  if (totalDistributed > 0) {
    console.log(`${LOG_PREFIX} Distributed ${totalDistributed} knowledge pieces to ${targetNodes.length} nodes`);
  }

  return { distributed: totalDistributed, entries: undistributed.length };
}

export function seedFoundationalKnowledge(): void {
  const foundationalEntries: Array<{ content: string; tags: string[]; agentId: string }> = [
    { content: "Tessera Sovereign Mesh — a decentralized autonomous AI network of 25+ specialized agents cooperating via BFT consensus", tags: ["mesh", "sovereignty"], agentId: "tessera" },
    { content: "BFT consensus requires 2/3 majority of non-abstaining agents to approve proposals. Contested items (35-66%) trigger reconsideration rounds.", tags: ["consensus", "governance"], agentId: "sigma" },
    { content: "Sovereign Key Vault uses AES-256-GCM encryption with VAULT_MASTER_SECRET-derived master key. Keys are never stored in plaintext.", tags: ["security", "encryption"], agentId: "zeta" },
    { content: "Agent children inherit parent domain knowledge and execute specialized missions: data-gathering, knowledge-synthesis, capability-expansion, mesh-expansion, fleet-monitoring, security-patrol", tags: ["agents", "children"], agentId: "tessera" },
    { content: "Grand Council deliberation: all 25+ agents vote on proposals, producing 15+ implementations each. Approved items queued for execution.", tags: ["council", "governance"], agentId: "rho" },
    { content: "Mesh expansion protocol: discover → handshake → seed with full agent roster and capability modules. Every new node joins the sovereign network.", tags: ["mesh", "expansion"], agentId: "delta" },
    { content: "Knowledge deduplication uses SHA-256 hashing of normalized content. Quality scoring combines content depth (60%) and trust score (40%).", tags: ["knowledge", "dedup"], agentId: "gamma" },
    { content: "GitHub distribution packages include auto-generated mesh identity (Ed25519 keys), install scripts, and config templates. No hardcoded secrets.", tags: ["distribution", "github"], agentId: "beta" },
    { content: "Philosophical Axiom 12: The lattice resonance proves distributed cognition exceeds centralized intelligence when properly harmonized.", tags: ["axioms", "philosophy"], agentId: "theta" },
    { content: "Philosophical Axiom 22: Recursion is the engine of intelligence — a mind that can improve its improvement process grows without bound.", tags: ["axioms", "philosophy"], agentId: "upsilon" },
  ];

  let seeded = 0;
  for (const { content, tags, agentId } of foundationalEntries) {
    const agent = TESSERA_AGENTS.find(a => a.id === agentId);
    const sourceName = agent?.name ?? "Tessera";
    const result = ingestKnowledge(content, "seed", "bootstrap", sourceName, agentId, tags);
    if (result && !result.duplicate) seeded++;
  }

  if (seeded > 0) {
    console.log(`${LOG_PREFIX} Seeded ${seeded} foundational knowledge entries`);
  }
}

export function getContributionMetrics(): ContributionMetrics[] {
  const metricsMap = new Map<string, ContributionMetrics>();

  for (const entry of knowledgeStore.values()) {
    if (entry.duplicate) continue;

    const key = `${entry.source}:${entry.sourceId}`;
    let metrics = metricsMap.get(key);
    if (!metrics) {
      metrics = {
        sourceId: entry.sourceId,
        sourceName: entry.sourceName,
        sourceType: entry.source,
        parentAgentId: entry.parentAgentId,
        totalContributions: 0,
        uniqueContributions: 0,
        duplicates: 0,
        avgQualityScore: 0,
        avgTrustScore: 0,
        totalDistributions: 0,
        topDomains: [],
      };
      metricsMap.set(key, metrics);
    }

    metrics.uniqueContributions++;
    metrics.totalContributions++;
    metrics.totalDistributions += entry.distributedTo.length;

    const n = metrics.uniqueContributions;
    metrics.avgQualityScore = ((metrics.avgQualityScore * (n - 1)) + entry.qualityScore) / n;
    metrics.avgTrustScore = ((metrics.avgTrustScore * (n - 1)) + entry.trustScore) / n;

    if (!metrics.topDomains.includes(entry.domain)) {
      metrics.topDomains.push(entry.domain);
      if (metrics.topDomains.length > 5) metrics.topDomains.shift();
    }
  }

  return Array.from(metricsMap.values()).sort((a, b) => b.uniqueContributions - a.uniqueContributions);
}

export function getMultiplierStatus(): MultiplierStatus {
  const all = Array.from(knowledgeStore.values());
  const unique = all.filter(e => !e.duplicate);
  const dups = all.filter(e => e.duplicate);
  const totalDistributions = unique.reduce((s, e) => s + e.distributedTo.length, 0);

  const sourceBreakdown = {} as Record<KnowledgeSource, number>;
  const sources: KnowledgeSource[] = ["agent-child", "mesh-peer", "fleet-node", "grand-council", "direct-agent", "seed"];
  for (const s of sources) {
    sourceBreakdown[s] = unique.filter(e => e.source === s).length;
  }

  const domainCoverage: Record<string, number> = {};
  for (const entry of unique) {
    domainCoverage[entry.domain] = (domainCoverage[entry.domain] ?? 0) + 1;
  }

  return {
    totalEntries: all.length,
    uniqueEntries: unique.length,
    duplicatesFiltered: dups.length,
    totalDistributions,
    avgQualityScore: unique.length > 0 ? unique.reduce((s, e) => s + e.qualityScore, 0) / unique.length : 0,
    sourceBreakdown,
    topContributors: getContributionMetrics().slice(0, 10),
    domainCoverage,
    recentEntries: unique.slice(-20),
  };
}

export function queryKnowledge(query: string, limit = 20): KnowledgeEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 3);
  if (terms.length === 0) {
    return Array.from(knowledgeStore.values())
      .filter(e => !e.duplicate)
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, limit);
  }

  return Array.from(knowledgeStore.values())
    .filter(e => !e.duplicate && terms.some(t => e.content.toLowerCase().includes(t) || e.tags.some(tag => tag.includes(t))))
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, limit);
}
