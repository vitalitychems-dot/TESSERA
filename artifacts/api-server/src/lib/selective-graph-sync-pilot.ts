import { TESSERA_SUBJECTS } from "./tessera-knowledge";

export interface GraphPartitionNode {
  id: string;
  text: string;
  source: string;
}

export interface VersionedGraphPartition {
  id: string;
  version: string;
  classification: "public-curated";
  sourceVersion: string;
  nodes: GraphPartitionNode[];
}

export interface PartitionSyncResult {
  partition: VersionedGraphPartition;
  bytesSynced: number;
  cacheHit: boolean;
}

const NETWORK_THEORY_SOURCE = "artifacts/api-server/src/lib/tessera-knowledge.ts#network-theory";

/**
 * One deliberately small, public-curated partition for the selective-sync pilot.
 * The source text remains the checked-in Tessera knowledge entry; private and
 * mutable state is not part of this partition or its cache.
 */
export function createNetworkTheoryPartition(): VersionedGraphPartition {
  const subject = TESSERA_SUBJECTS["network-theory"];
  if (!subject) throw new Error("The network-theory source entry is missing.");

  const sentences = subject.knowledge.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  const nodes = sentences
    .map((sentence, index) => sentence.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `network-theory:v1:${String(index + 1).padStart(2, "0")}`,
      text,
      source: NETWORK_THEORY_SOURCE,
    }));

  if (nodes.length === 0) throw new Error("The network-theory partition contains no evidence nodes.");
  return {
    id: "network-theory",
    version: "1.0.0",
    classification: "public-curated",
    sourceVersion: "tessera-knowledge/network-theory",
    nodes,
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function queryTerms(query: string): string[] {
  return [...new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter(term => term.length > 2);
}

export function searchGraphPartition(
  partition: VersionedGraphPartition,
  query: string,
  topK = 5,
): GraphPartitionNode[] {
  if (!Number.isInteger(topK) || topK < 0) throw new Error("topK must be a non-negative integer.");
  const terms = queryTerms(query);
  if (terms.length === 0 || topK === 0) return [];

  return partition.nodes
    .map((node, index) => {
      const text = node.text.toLowerCase();
      const score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
      return { node, score, index };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, topK)
    .map(item => item.node);
}

export class VersionedGraphPartitionCache {
  private readonly entries = new Map<string, { payload: string; checksum: string; partition: VersionedGraphPartition }>();

  sync(partition: VersionedGraphPartition): PartitionSyncResult {
    if (partition.classification !== "public-curated") {
      throw new Error("Only public-curated partitions may be synced by this pilot.");
    }
    if (!partition.id.trim() || !partition.version.trim()) {
      throw new Error("A partition id and version are required.");
    }

    const payload = stableJson(partition);
    const checksum = checksumString(payload);
    const key = `${partition.id}@${partition.version}`;
    const cached = this.entries.get(key);
    if (cached) {
      if (cached.checksum !== checksum) {
        throw new Error(`Partition ${key} changed without a version increment.`);
      }
      return { partition: cached.partition, bytesSynced: 0, cacheHit: true };
    }

    const frozenCopy = JSON.parse(payload) as VersionedGraphPartition;
    this.entries.set(key, { payload, checksum, partition: frozenCopy });
    return {
      partition: frozenCopy,
      bytesSynced: new TextEncoder().encode(payload).byteLength,
      cacheHit: false,
    };
  }

  clear(): void {
    this.entries.clear();
  }
}

function checksumString(value: string): string {
  // Small deterministic checksum is sufficient for detecting same-version
  // fixture drift; it is not used as a security or integrity boundary.
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function estimateContextTokens(nodes: GraphPartitionNode[]): number {
  return nodes.reduce((total, node) => total + Math.ceil(node.text.length / 4), 0);
}
