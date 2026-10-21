import crypto from "crypto";

export interface AirGapMessage {
  id: string;
  from: string;
  to: string;
  payload: string;
  encryptedPayload: string;
  timestamp: number;
  priority: "low" | "normal" | "high" | "urgent";
  type: string;
  synced: boolean;
  syncAttempts: number;
  lastSyncAttempt: number | null;
  ttl: number;
}

export interface NodeSyncState {
  nodeId: string;
  online: boolean;
  lastSeen: number;
  lastSync: number | null;
  pendingQueue: AirGapMessage[];
  syncedMessages: string[];
  presharedKey: string;
  syncBandwidthBytesPerBurst: number;
}

export interface SyncBurstResult {
  nodeId: string;
  messagesSynced: number;
  bytesTransferred: number;
  failedMessages: string[];
  syncTimestamp: number;
  success: boolean;
}

const nodeStates: Map<string, NodeSyncState> = new Map();

function generatePresharedKey(nodeIdA: string, nodeIdB: string): string {
  const combined = [nodeIdA, nodeIdB].sort().join(":airgap:");
  return crypto.createHash("sha256").update(combined + "sovereign-airgap-psk").digest("hex");
}

function encryptWithPSK(data: string, presharedKey: string): string {
  const key = Buffer.from(presharedKey.slice(0, 64), "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let enc = cipher.update(data, "utf8", "hex");
  enc += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${enc}`;
}

function decryptWithPSK(encryptedData: string, presharedKey: string): string {
  const key = Buffer.from(presharedKey.slice(0, 64), "hex");
  const parts = encryptedData.split(":");
  if (parts.length < 3) throw new Error("Invalid encrypted format");
  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const ciphertext = parts.slice(2).join(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  let dec = decipher.update(ciphertext, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

export function registerAirGapNode(
  nodeId: string,
  syncBandwidthBytesPerBurst: number = 1024 * 1024
): NodeSyncState {
  if (nodeStates.has(nodeId)) {
    return nodeStates.get(nodeId)!;
  }

  const state: NodeSyncState = {
    nodeId,
    online: true,
    lastSeen: Date.now(),
    lastSync: null,
    pendingQueue: [],
    syncedMessages: [],
    presharedKey: crypto.randomBytes(32).toString("hex"),
    syncBandwidthBytesPerBurst,
  };
  nodeStates.set(nodeId, state);
  return state;
}

export function setNodeOnline(nodeId: string, online: boolean): void {
  const state = nodeStates.get(nodeId);
  if (state) {
    state.online = online;
    if (online) state.lastSeen = Date.now();
  }
}

export function queueMessage(
  fromNodeId: string,
  toNodeId: string,
  payload: string,
  type: string = "data",
  priority: AirGapMessage["priority"] = "normal",
  ttlMs: number = 24 * 60 * 60 * 1000
): AirGapMessage {
  const toState = nodeStates.get(toNodeId);
  if (!toState) {
    registerAirGapNode(toNodeId);
  }

  const psk = generatePresharedKey(fromNodeId, toNodeId);
  const messageId = `agsp-${crypto.randomBytes(8).toString("hex")}`;
  const encryptedPayload = encryptWithPSK(payload, psk);

  const message: AirGapMessage = {
    id: messageId,
    from: fromNodeId,
    to: toNodeId,
    payload,
    encryptedPayload,
    timestamp: Date.now(),
    priority,
    type,
    synced: false,
    syncAttempts: 0,
    lastSyncAttempt: null,
    ttl: Date.now() + ttlMs,
  };

  const state = nodeStates.get(toNodeId)!;
  if (!state.online) {
    state.pendingQueue.push(message);
    console.log(`[AirGapSync] Message ${messageId} queued for offline node ${toNodeId}`);
  } else {
    state.pendingQueue.push(message);
  }

  return message;
}

export function burstSyncNode(nodeId: string): SyncBurstResult {
  const state = nodeStates.get(nodeId);
  if (!state) {
    return { nodeId, messagesSynced: 0, bytesTransferred: 0, failedMessages: [], syncTimestamp: Date.now(), success: false };
  }

  if (!state.online) {
    return { nodeId, messagesSynced: 0, bytesTransferred: 0, failedMessages: [], syncTimestamp: Date.now(), success: false };
  }

  const expired = state.pendingQueue.filter(m => Date.now() > m.ttl);
  state.pendingQueue = state.pendingQueue.filter(m => Date.now() <= m.ttl);

  const priorityOrder: Record<AirGapMessage["priority"], number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  state.pendingQueue.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return a.timestamp - b.timestamp;
  });

  let bytesTransferred = 0;
  const synced: string[] = [];
  const failed: string[] = [];

  for (const message of [...state.pendingQueue]) {
    if (bytesTransferred + message.encryptedPayload.length > state.syncBandwidthBytesPerBurst) {
      break;
    }

    try {
      const psk = generatePresharedKey(message.from, nodeId);
      const verified = decryptWithPSK(message.encryptedPayload, psk) === message.payload;

      if (verified) {
        message.synced = true;
        message.syncAttempts++;
        message.lastSyncAttempt = Date.now();
        bytesTransferred += message.encryptedPayload.length;
        synced.push(message.id);
        state.syncedMessages.push(message.id);
      } else {
        message.syncAttempts++;
        message.lastSyncAttempt = Date.now();
        failed.push(message.id);
      }
    } catch {
      message.syncAttempts++;
      failed.push(message.id);
    }
  }

  state.pendingQueue = state.pendingQueue.filter(m => !m.synced || m.syncAttempts < 3);
  state.lastSync = Date.now();

  console.log(`[AirGapSync] Burst sync for ${nodeId}: ${synced.length} messages, ${bytesTransferred} bytes`);

  return {
    nodeId,
    messagesSynced: synced.length,
    bytesTransferred,
    failedMessages: failed,
    syncTimestamp: Date.now(),
    success: synced.length > 0 || state.pendingQueue.length === 0,
  };
}

export function onNodeReconnect(nodeId: string): SyncBurstResult {
  setNodeOnline(nodeId, true);
  console.log(`[AirGapSync] Node ${nodeId} reconnected — triggering burst sync`);
  return burstSyncNode(nodeId);
}

export function getNodeQueue(nodeId: string): AirGapMessage[] {
  return nodeStates.get(nodeId)?.pendingQueue || [];
}

export function getPendingQueueSize(nodeId: string): number {
  return nodeStates.get(nodeId)?.pendingQueue.filter(m => !m.synced).length || 0;
}

export function getAirGapStats(): {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  totalQueued: number;
  totalSynced: number;
} {
  const all = Array.from(nodeStates.values());
  return {
    totalNodes: all.length,
    onlineNodes: all.filter(n => n.online).length,
    offlineNodes: all.filter(n => !n.online).length,
    totalQueued: all.reduce((s, n) => s + n.pendingQueue.filter(m => !m.synced).length, 0),
    totalSynced: all.reduce((s, n) => s + n.syncedMessages.length, 0),
  };
}

export function getAllNodeStates(): Array<{
  nodeId: string;
  online: boolean;
  lastSeen: number;
  lastSync: number | null;
  queueSize: number;
  syncedCount: number;
}> {
  return Array.from(nodeStates.values()).map(n => ({
    nodeId: n.nodeId,
    online: n.online,
    lastSeen: n.lastSeen,
    lastSync: n.lastSync,
    queueSize: n.pendingQueue.filter(m => !m.synced).length,
    syncedCount: n.syncedMessages.length,
  }));
}

export function initAirGapSystem(nodeIds: string[]): void {
  for (const nodeId of nodeIds) {
    registerAirGapNode(nodeId);
  }
  console.log(`[AirGapSync] Air-Gap Sync initialized with ${nodeIds.length} nodes`);

  setInterval(() => {
    for (const [nodeId, state] of nodeStates) {
      if (state.online && state.pendingQueue.some(m => !m.synced)) {
        burstSyncNode(nodeId);
      }

      state.pendingQueue = state.pendingQueue.filter(m => Date.now() <= m.ttl);
    }
  }, 30000);
}
