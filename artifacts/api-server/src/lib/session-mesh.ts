import { WebSocket } from "ws";
import { createHash } from "crypto";
import { logger } from "./logger";
import { setSacredInterval, clearSacredInterval, type SacredHandle } from "./sacred-scheduler";

export interface MeshSession {
  sessionId: string;
  sovereignKeyHash: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  metadata: {
    userAgent?: string;
    location?: string;
    activeAgents?: string[];
    currentPage?: string;
    taskCount?: number;
  };
  ws: WebSocket;
  isAuthorized: () => boolean;
}

export interface MeshSessionInfo {
  sessionId: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  metadata: MeshSession["metadata"];
  latencyMs?: number;
}

const meshSessions = new Map<string, Map<string, MeshSession>>();

const HEARTBEAT_INTERVAL_MS = 15_000;
const SESSION_TIMEOUT_MS = 45_000;

export const MESH_SOCKET_CLOSE_CODE = 1008;
export const MESH_SOCKET_CLOSE_REASON = "admin session expired or revoked";

function guardAuthorizer(isAuthorized: (() => boolean) | undefined): () => boolean {
  return () => {
    if (typeof isAuthorized !== "function") return false;
    try {
      return isAuthorized() === true;
    } catch {
      return false;
    }
  };
}

export function closeMeshSocket(ws: WebSocket): void {
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
    try {
      ws.close(MESH_SOCKET_CLOSE_CODE, MESH_SOCKET_CLOSE_REASON);
    } catch {
      // The socket is already going away.
    }
  }
}

let heartbeatTimer: SacredHandle | null = null;

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function sessionBinding(sovereignKeyHash: string): "present" | "absent" {
  return sovereignKeyHash.length > 0 ? "present" : "absent";
}

export function getSovereignKeyHash(key: string): string {
  return hashKey(key);
}

export function registerSession(
  sovereignKeyHash: string,
  sessionId: string,
  ws: WebSocket,
  metadata: MeshSession["metadata"],
  isAuthorized: () => boolean,
): MeshSession {
  if (!meshSessions.has(sovereignKeyHash)) {
    meshSessions.set(sovereignKeyHash, new Map());
  }
  const group = meshSessions.get(sovereignKeyHash)!;
  const session: MeshSession = {
    sessionId,
    sovereignKeyHash,
    connectedAt: new Date(),
    lastHeartbeat: new Date(),
    metadata,
    ws,
    isAuthorized: guardAuthorizer(isAuthorized),
  };
  group.set(sessionId, session);
  logger.info({ sessionId, binding: sessionBinding(sovereignKeyHash), peerCount: group.size }, "Session registered in mesh");
  return session;
}

export function updateSessionHeartbeat(sovereignKeyHash: string, sessionId: string, metadata?: MeshSession["metadata"]): boolean {
  const group = meshSessions.get(sovereignKeyHash);
  if (!group) return false;
  const session = group.get(sessionId);
  if (!session) return false;
  session.lastHeartbeat = new Date();
  if (metadata) {
    session.metadata = { ...session.metadata, ...metadata };
  }
  return true;
}

export function removeSession(sovereignKeyHash: string, sessionId: string): void {
  const group = meshSessions.get(sovereignKeyHash);
  if (!group) return;
  group.delete(sessionId);
  if (group.size === 0) {
    meshSessions.delete(sovereignKeyHash);
  }
  logger.info({ sessionId, binding: sessionBinding(sovereignKeyHash) }, "Session removed from mesh");
}

export function getGroupSessions(sovereignKeyHash: string): MeshSessionInfo[] {
  const group = meshSessions.get(sovereignKeyHash);
  if (!group) return [];
  for (const [sessionId, session] of group) {
    if (!session.isAuthorized()) {
      group.delete(sessionId);
      closeMeshSocket(session.ws);
    }
  }
  if (group.size === 0) {
    meshSessions.delete(sovereignKeyHash);
    return [];
  }
  return Array.from(group.values()).map((s) => ({
    sessionId: s.sessionId,
    connectedAt: s.connectedAt,
    lastHeartbeat: s.lastHeartbeat,
    metadata: s.metadata,
  }));
}

export function getMeshStats(): { totalSessions: number; totalGroups: number; groups: { keyHash: string; sessionCount: number }[] } {
  const groups = Array.from(meshSessions.entries()).map(([keyHash, sessions]) => ({
    keyHash,
    sessionCount: sessions.size,
  }));
  const totalSessions = groups.reduce((sum, g) => sum + g.sessionCount, 0);
  return { totalSessions, totalGroups: groups.length, groups };
}

export function broadcastToGroup(
  sovereignKeyHash: string,
  message: object,
  excludeSessionId?: string
): number {
  const group = meshSessions.get(sovereignKeyHash);
  if (!group) return 0;
  const payload = JSON.stringify(message);
  let count = 0;
  for (const [sessionId, session] of group) {
    if (excludeSessionId && sessionId === excludeSessionId) continue;
    if (!session.isAuthorized()) {
      group.delete(sessionId);
      closeMeshSocket(session.ws);
      continue;
    }
    if (session.ws.readyState === WebSocket.OPEN) {
      try {
        session.ws.send(payload);
        count++;
      } catch (err) {
        logger.warn({ err, sessionId }, "Failed to send to mesh peer");
      }
    }
  }
  return count;
}

export function sendToSession(sovereignKeyHash: string, sessionId: string, message: object): boolean {
  const group = meshSessions.get(sovereignKeyHash);
  if (!group) return false;
  const session = group.get(sessionId);
  if (!session || session.ws.readyState !== WebSocket.OPEN) return false;
  if (!session.isAuthorized()) {
    group.delete(sessionId);
    closeMeshSocket(session.ws);
    if (group.size === 0) meshSessions.delete(sovereignKeyHash);
    return false;
  }
  try {
    session.ws.send(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}

export function getGroupSharedState(sovereignKeyHash: string): object {
  const sessions = getGroupSessions(sovereignKeyHash);
  const totalTasks = sessions.reduce((sum, s) => sum + (s.metadata.taskCount || 0), 0);
  const allAgents = Array.from(new Set(sessions.flatMap(s => s.metadata.activeAgents || [])));
  const pageMap = sessions.map(s => ({ sessionId: s.sessionId, page: s.metadata.currentPage || "/" }));
  return {
    peers: sessions,
    peerCount: sessions.length,
    meshHealth: sessions.length > 1 ? "entangled" : sessions.length === 1 ? "isolated" : "empty",
    aggregateStats: {
      totalActiveTasks: totalTasks,
      activeAgents: allAgents,
      sessionPages: pageMap,
    },
    timestamp: Date.now(),
  };
}

export function pruneMeshSessions(): void {
  const now = Date.now();
  for (const [keyHash, group] of meshSessions) {
    const stale: string[] = [];
    for (const [sessionId, session] of group) {
      const age = now - session.lastHeartbeat.getTime();
      const authorized = session.isAuthorized();
      if (!authorized) closeMeshSocket(session.ws);
      if (age > SESSION_TIMEOUT_MS || session.ws.readyState !== WebSocket.OPEN || !authorized) {
        stale.push(sessionId);
      }
    }
    for (const sessionId of stale) {
      group.delete(sessionId);
      logger.info({ sessionId, binding: sessionBinding(keyHash) }, "Stale session pruned from mesh");
      broadcastToGroup(keyHash, {
        type: "mesh:peer-left",
        channel: "mesh",
        sessionId,
        reason: "timeout",
        peers: getGroupSessions(keyHash),
        timestamp: Date.now(),
      });
    }
    if (group.size === 0) {
      meshSessions.delete(keyHash);
    }
  }
}

export function broadcastToAll(message: object): number {
  let total = 0;
  const payload = JSON.stringify(message);
  for (const group of meshSessions.values()) {
    for (const session of group.values()) {
      if (!session.isAuthorized()) {
        group.delete(session.sessionId);
        closeMeshSocket(session.ws);
        continue;
      }
      if (session.ws.readyState === WebSocket.OPEN) {
        try { session.ws.send(payload); total++; } catch {}
      }
    }
  }
  return total;
}

export function broadcastToKeyHash(sovereignKeyHash: string, message: object, excludeSessionId?: string): number {
  return broadcastToGroup(sovereignKeyHash, message, excludeSessionId);
}

export function startMeshHeartbeatMonitor(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setSacredInterval(pruneMeshSessions, HEARTBEAT_INTERVAL_MS, "session-mesh");
  logger.info({ intervalMs: HEARTBEAT_INTERVAL_MS }, "Mesh heartbeat monitor started");
}

export function stopMeshHeartbeatMonitor(): void {
  if (heartbeatTimer) {
    clearSacredInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
