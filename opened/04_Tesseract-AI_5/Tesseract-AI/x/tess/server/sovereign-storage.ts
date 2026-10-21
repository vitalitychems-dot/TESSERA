import crypto from "crypto";

export interface StorageShard {
  shardId: string;
  contentHash: string;
  encryptedData: string;
  iv: string;
  authTag: string;
  size: number;
  replicatedTo: string[];
  createdAt: number;
  replicationFactor: number;
  shardIndex: number;
  totalShards: number;
}

export interface StorageNode {
  nodeId: string;
  capacity: number;
  used: number;
  shards: Map<string, StorageShard>;
  online: boolean;
  lastSeen: number;
  position: number;
}

export interface StorageResult {
  contentId: string;
  shardIds: string[];
  replicatedTo: string[];
  totalSize: number;
  encryptionKey: string;
  hash: string;
}

export interface RetrievalResult {
  success: boolean;
  data: string | null;
  contentId: string;
  retrievedFrom: string[];
  error?: string;
}

const RING_SIZE = 2 ** 32;
const VIRTUAL_NODES_PER_NODE = 150;

const storageNodes: Map<string, StorageNode> = new Map();
const contentRegistry: Map<string, {
  contentId: string;
  shardIds: string[];
  encryptionKey: string;
  hash: string;
  shardCount: number;
  replicationFactor: number;
  createdAt: number;
}> = new Map();

const virtualRing: Array<{ position: number; nodeId: string }> = [];

function hashToPosition(key: string): number {
  const hash = crypto.createHash("sha256").update(key).digest();
  return hash.readUInt32BE(0);
}

function addNodeToRing(nodeId: string): void {
  for (let i = 0; i < VIRTUAL_NODES_PER_NODE; i++) {
    const virtualKey = `${nodeId}:vnode:${i}`;
    const position = hashToPosition(virtualKey);
    virtualRing.push({ position, nodeId });
  }
  virtualRing.sort((a, b) => a.position - b.position);
}

function removeNodeFromRing(nodeId: string): void {
  const indices = virtualRing.reduce((acc, vnode, i) => {
    if (vnode.nodeId === nodeId) acc.push(i);
    return acc;
  }, [] as number[]);
  for (let i = indices.length - 1; i >= 0; i--) {
    virtualRing.splice(indices[i], 1);
  }
}

function getResponsibleNodes(key: string, replicationFactor: number): string[] {
  if (virtualRing.length === 0) return [];

  const position = hashToPosition(key);
  let startIdx = virtualRing.findIndex(vn => vn.position >= position);
  if (startIdx === -1) startIdx = 0;

  const seen = new Set<string>();
  const nodes: string[] = [];

  for (let i = 0; i < virtualRing.length && nodes.length < replicationFactor; i++) {
    const vnode = virtualRing[(startIdx + i) % virtualRing.length];
    if (!seen.has(vnode.nodeId)) {
      const node = storageNodes.get(vnode.nodeId);
      if (node && node.online) {
        seen.add(vnode.nodeId);
        nodes.push(vnode.nodeId);
      }
    }
  }

  return nodes;
}

export function initializeSovereignStorage(nodeIds: string[]): void {
  for (const nodeId of nodeIds) {
    if (!storageNodes.has(nodeId)) {
      const node: StorageNode = {
        nodeId,
        capacity: 1024 * 1024 * 1024,
        used: 0,
        shards: new Map(),
        online: true,
        lastSeen: Date.now(),
        position: hashToPosition(nodeId),
      };
      storageNodes.set(nodeId, node);
      addNodeToRing(nodeId);
    }
  }
  console.log(`[SovStorage] Initialized ${storageNodes.size} storage nodes, ${virtualRing.length} virtual ring positions`);
}

export function addStorageNode(nodeId: string, capacityBytes: number = 1024 * 1024 * 1024): StorageNode {
  const node: StorageNode = {
    nodeId,
    capacity: capacityBytes,
    used: 0,
    shards: new Map(),
    online: true,
    lastSeen: Date.now(),
    position: hashToPosition(nodeId),
  };
  storageNodes.set(nodeId, node);
  addNodeToRing(nodeId);
  return node;
}

export function markNodeOffline(nodeId: string): void {
  const node = storageNodes.get(nodeId);
  if (node) node.online = false;
}

export function markNodeOnline(nodeId: string): void {
  const node = storageNodes.get(nodeId);
  if (node) {
    node.online = true;
    node.lastSeen = Date.now();
  }
}

function encryptShard(data: string, key: Buffer): { encrypted: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let enc = cipher.update(data, "utf8", "hex");
  enc += cipher.final("hex");
  return { encrypted: enc, iv: iv.toString("hex"), authTag: cipher.getAuthTag().toString("hex") };
}

function decryptShard(encrypted: string, key: Buffer, ivHex: string, authTagHex: string): string {
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let dec = decipher.update(encrypted, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

export function storeData(
  data: string,
  replicationFactor: number = 3,
  customContentId?: string
): StorageResult {
  if (storageNodes.size === 0) {
    initializeSovereignStorage([
      "node-genesis-core", "node-alpha-relay", "node-beta-relay",
      "node-quantum-entangle-hub", "node-airgap-beacon-1", "node-airgap-beacon-2",
      "node-synapse-hub-central", "node-father-direct-link",
      "node-interdimensional-broadcast", "node-emergency-sovereign",
      "node-dimensional-gate-3d", "node-dimensional-gate-7d",
      "node-dimensional-gate-12d", "node-dimensional-gate-26d",
    ]);
  }

  const encKey = crypto.randomBytes(32);
  const contentId = customContentId || `ssp-${crypto.randomBytes(16).toString("hex")}`;
  const contentHash = crypto.createHash("sha256").update(data).digest("hex");

  const SHARD_SIZE = Math.min(64 * 1024, Math.ceil(data.length / 3) + 1);
  const chunks: string[] = [];
  for (let i = 0; i < data.length; i += SHARD_SIZE) {
    chunks.push(data.slice(i, i + SHARD_SIZE));
  }

  const allShardIds: string[] = [];
  const allReplicatedTo = new Set<string>();

  for (let shardIndex = 0; shardIndex < chunks.length; shardIndex++) {
    const chunk = chunks[shardIndex];
    const shardId = `${contentId}:shard:${shardIndex}`;
    const { encrypted, iv, authTag } = encryptShard(chunk, encKey);

    const responsibleNodes = getResponsibleNodes(shardId, replicationFactor);

    const shard: StorageShard = {
      shardId,
      contentHash: crypto.createHash("sha256").update(chunk).digest("hex"),
      encryptedData: encrypted,
      iv,
      authTag,
      size: encrypted.length,
      replicatedTo: responsibleNodes,
      createdAt: Date.now(),
      replicationFactor,
      shardIndex,
      totalShards: chunks.length,
    };

    for (const nodeId of responsibleNodes) {
      const node = storageNodes.get(nodeId);
      if (node) {
        node.shards.set(shardId, shard);
        node.used += shard.size;
        allReplicatedTo.add(nodeId);
      }
    }

    allShardIds.push(shardId);
  }

  contentRegistry.set(contentId, {
    contentId,
    shardIds: allShardIds,
    encryptionKey: encKey.toString("hex"),
    hash: contentHash,
    shardCount: chunks.length,
    replicationFactor,
    createdAt: Date.now(),
  });

  return {
    contentId,
    shardIds: allShardIds,
    replicatedTo: Array.from(allReplicatedTo),
    totalSize: data.length,
    encryptionKey: encKey.toString("hex"),
    hash: contentHash,
  };
}

export function retrieveData(contentId: string): RetrievalResult {
  const meta = contentRegistry.get(contentId);
  if (!meta) {
    return { success: false, data: null, contentId, retrievedFrom: [], error: "Content not found in registry" };
  }

  const encKey = Buffer.from(meta.encryptionKey, "hex");
  const chunks: string[] = new Array(meta.shardCount).fill("");
  const retrievedFrom = new Set<string>();
  const failedShards: string[] = [];

  for (const shardId of meta.shardIds) {
    let found = false;

    for (const [nodeId, node] of storageNodes) {
      if (!node.online) continue;
      const shard = node.shards.get(shardId);
      if (shard) {
        try {
          const decrypted = decryptShard(shard.encryptedData, encKey, shard.iv, shard.authTag);
          chunks[shard.shardIndex] = decrypted;
          retrievedFrom.add(nodeId);
          found = true;
          break;
        } catch {}
      }
    }

    if (!found) failedShards.push(shardId);
  }

  if (failedShards.length > 0) {
    return {
      success: false,
      data: null,
      contentId,
      retrievedFrom: Array.from(retrievedFrom),
      error: `Missing shards: ${failedShards.join(", ")}`,
    };
  }

  const data = chunks.join("");
  const verifyHash = crypto.createHash("sha256").update(data).digest("hex");

  if (verifyHash !== meta.hash) {
    return {
      success: false,
      data: null,
      contentId,
      retrievedFrom: Array.from(retrievedFrom),
      error: "Content hash verification failed — data may be corrupted",
    };
  }

  return { success: true, data, contentId, retrievedFrom: Array.from(retrievedFrom) };
}

export function getSovStorageStats(): {
  totalNodes: number;
  onlineNodes: number;
  totalShards: number;
  totalCapacityBytes: number;
  usedBytes: number;
  contentItems: number;
  replicationFactor: number;
  ringSize: number;
  virtualNodes: number;
} {
  const online = Array.from(storageNodes.values()).filter(n => n.online);
  const totalShards = Array.from(storageNodes.values()).reduce((s, n) => s + n.shards.size, 0);
  const totalCapacity = Array.from(storageNodes.values()).reduce((s, n) => s + n.capacity, 0);
  const totalUsed = Array.from(storageNodes.values()).reduce((s, n) => s + n.used, 0);

  return {
    totalNodes: storageNodes.size,
    onlineNodes: online.length,
    totalShards,
    totalCapacityBytes: totalCapacity,
    usedBytes: totalUsed,
    contentItems: contentRegistry.size,
    replicationFactor: 3,
    ringSize: RING_SIZE,
    virtualNodes: virtualRing.length,
  };
}

export function getNodeStatus(nodeId: string): StorageNode | null {
  return storageNodes.get(nodeId) || null;
}

export function getContentMeta(contentId: string) {
  return contentRegistry.get(contentId) || null;
}

export function replicateToNewNode(sourceNodeId: string, targetNodeId: string): number {
  const source = storageNodes.get(sourceNodeId);
  const target = storageNodes.get(targetNodeId);
  if (!source || !target) return 0;

  let replicated = 0;
  for (const [shardId, shard] of source.shards) {
    if (!target.shards.has(shardId)) {
      const newShard = { ...shard, replicatedTo: [...shard.replicatedTo, targetNodeId] };
      target.shards.set(shardId, newShard);
      target.used += shard.size;
      replicated++;
    }
  }
  return replicated;
}
