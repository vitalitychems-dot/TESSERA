import type { IncomingMessage } from "node:http";
import { v4 as uuidv4 } from "uuid";
import { WebSocket } from "ws";
import { logger } from "./logger";
import { configuredMeshKeyHash, validateMeshToken } from "./mesh-auth";
import {
  broadcastToGroup,
  closeMeshSocket,
  getGroupSessions,
  getGroupSharedState,
  registerSession,
  removeSession,
  updateSessionHeartbeat,
  type MeshSession,
} from "./session-mesh";
import { SESSION_COOKIE, lookupSession } from "./sovereign-session";

export interface MeshEnrichment {
  recentTasks: unknown[];
  recentDecisions: unknown[];
}

export interface MeshClientDeps {
  loadEnrichment: () => Promise<MeshEnrichment>;
}

interface MeshAuthState {
  token: string | null;
  sessionPresented: boolean;
  sessionCookie: string | null;
}

function readSessionCookie(header: string | undefined): { present: boolean; value: string | null } {
  if (!header) return { present: false, value: null };
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    if (trimmed.slice(0, eq) !== SESSION_COOKIE) continue;
    try {
      return { present: true, value: decodeURIComponent(trimmed.slice(eq + 1)) };
    } catch {
      return { present: true, value: null };
    }
  }
  return { present: false, value: null };
}

/** Fail closed. Returns the sovereign key hash, or null when unauthorized. */
export function authorizeMeshCredential(state: MeshAuthState): string | null {
  try {
    const token = typeof state.token === "string" ? state.token.trim() : "";
    const hasToken = token.length > 0;
    if (!hasToken && !state.sessionPresented) return null;
    if (state.sessionPresented) {
      const lookup = lookupSession(state.sessionCookie);
      if (!lookup.valid) return null;
    }
    if (hasToken) return validateMeshToken(token);
    return configuredMeshKeyHash();
  } catch {
    return null;
  }
}

function credentialPresented(state: MeshAuthState): boolean {
  const token = typeof state.token === "string" ? state.token.trim() : "";
  return state.sessionPresented || token.length > 0;
}

function metadataOf(msg: Record<string, unknown>): MeshSession["metadata"] | undefined {
  const metadata = msg.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  return metadata as MeshSession["metadata"];
}

export function attachMeshClient(ws: WebSocket, req: IncomingMessage, deps: MeshClientDeps): void {
  const sessionId = uuidv4();
  let sovereignKeyHash: string | null = null;
  let registered = false;
  const userAgentHeader = req.headers["user-agent"];
  const userAgent = typeof userAgentHeader === "string" ? userAgentHeader : "";
  const rawCookie = req.headers.cookie;
  const cookie = readSessionCookie(typeof rawCookie === "string" ? rawCookie : undefined);
  const state: MeshAuthState = {
    token: null,
    sessionPresented: cookie.present,
    sessionCookie: cookie.value,
  };
  const isAuthorized = () => authorizeMeshCredential(state) !== null;

  const reject = () => {
    if (sovereignKeyHash && registered) {
      removeSession(sovereignKeyHash, sessionId);
      registered = false;
      sovereignKeyHash = null;
    }
    closeMeshSocket(ws);
  };

  if (state.sessionPresented && !isAuthorized()) {
    closeMeshSocket(ws);
    return;
  }

  ws.on("message", (raw) => {
    let msg: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw.toString());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        reject();
        return;
      }
      msg = parsed as Record<string, unknown>;
    } catch {
      logger.warn("Failed to parse WS message");
      reject();
      return;
    }

    if (msg.type === "mesh:auth") {
      state.token = typeof msg.token === "string" ? msg.token : "";
      const keyHash = authorizeMeshCredential(state);
      if (!keyHash) {
        reject();
        return;
      }
      sovereignKeyHash = keyHash;
      const metadata = metadataOf(msg) ?? {};
      const session = registerSession(sovereignKeyHash, sessionId, ws, {
        userAgent,
        currentPage: metadata.currentPage,
        activeAgents: metadata.activeAgents || [],
        taskCount: metadata.taskCount || 0,
      }, isAuthorized);
      registered = true;
      if (!isAuthorized()) {
        reject();
        return;
      }

      const peerState = getGroupSharedState(sovereignKeyHash);
      const peers = getGroupSessions(sovereignKeyHash);
      if (!isAuthorized()) {
        reject();
        return;
      }

      void deps.loadEnrichment().then((enrichment) => {
        if (!isAuthorized() || ws.readyState !== WebSocket.OPEN) {
          if (!isAuthorized()) reject();
          return;
        }
        ws.send(JSON.stringify({
          type: "mesh:registered",
          channel: "mesh",
          sessionId,
          sharedState: {
            ...peerState,
            recentTasks: enrichment.recentTasks,
            recentDecisions: enrichment.recentDecisions,
          },
          peers,
          timestamp: Date.now(),
        }));
      }).catch((err: unknown) => {
        logger.warn({ err }, "Failed to enrich newcomer state from DB");
        if (!isAuthorized() || ws.readyState !== WebSocket.OPEN) {
          if (!isAuthorized()) reject();
          return;
        }
        ws.send(JSON.stringify({
          type: "mesh:registered",
          channel: "mesh",
          sessionId,
          sharedState: peerState,
          peers,
          timestamp: Date.now(),
        }));
      });

      if (!isAuthorized()) {
        reject();
        return;
      }
      broadcastToGroup(sovereignKeyHash, {
        type: "mesh:peer-joined",
        channel: "mesh",
        sessionId,
        metadata: session.metadata,
        peers: getGroupSessions(sovereignKeyHash),
        timestamp: Date.now(),
      }, sessionId);
      return;
    }

    if (!isAuthorized()) {
      const preAuthHandshake = !credentialPresented(state)
        && (msg.type === "subscribe" || msg.type === "unsubscribe");
      if (preAuthHandshake && msg.type === "subscribe") {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "subscribed", channel: msg.channel }));
        }
        return;
      }
      if (preAuthHandshake && msg.type === "unsubscribe") return;
      reject();
      return;
    }

    if (msg.type === "subscribe") {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "subscribed", channel: msg.channel }));
      }
      return;
    }

    if (msg.type === "unsubscribe") return;

    if (!sovereignKeyHash || !registered || !isAuthorized()) {
      reject();
      return;
    }

    if (msg.type === "mesh:heartbeat") {
      updateSessionHeartbeat(sovereignKeyHash, sessionId, metadataOf(msg));
      if (!isAuthorized() || ws.readyState !== WebSocket.OPEN) {
        if (!isAuthorized()) reject();
        return;
      }
      ws.send(JSON.stringify({
        type: "mesh:heartbeat-ack",
        channel: "mesh",
        sessionId,
        peers: getGroupSessions(sovereignKeyHash),
        timestamp: Date.now(),
      }));
      return;
    }

    if (msg.type === "mesh:update-metadata") {
      updateSessionHeartbeat(sovereignKeyHash, sessionId, metadataOf(msg));
      if (!isAuthorized()) {
        reject();
        return;
      }
      broadcastToGroup(sovereignKeyHash, {
        type: "mesh:peer-updated",
        channel: "mesh",
        sessionId,
        metadata: msg.metadata,
        timestamp: Date.now(),
      }, sessionId);
      return;
    }

    if (msg.type === "mesh:broadcast") {
      if (!isAuthorized()) {
        reject();
        return;
      }
      broadcastToGroup(sovereignKeyHash, {
        type: "mesh:event",
        channel: "mesh",
        eventType: typeof msg.eventType === "string" ? msg.eventType : "generic",
        fromSession: sessionId,
        payload: msg.payload,
        timestamp: Date.now(),
      }, sessionId);
      return;
    }

    if (msg.type === "mesh:agent-coordination") {
      if (!isAuthorized()) {
        reject();
        return;
      }
      broadcastToGroup(sovereignKeyHash, {
        type: "mesh:agent-coordination",
        channel: "mesh",
        fromSession: sessionId,
        agentId: msg.agentId,
        action: msg.action,
        taskId: msg.taskId,
        domain: msg.domain,
        payload: msg.payload,
        timestamp: Date.now(),
      }, sessionId);
      return;
    }

  });

  ws.on("close", () => {
    if (sovereignKeyHash && registered) {
      const hash = sovereignKeyHash;
      removeSession(hash, sessionId);
      registered = false;
      broadcastToGroup(hash, {
        type: "mesh:peer-left",
        channel: "mesh",
        sessionId,
        reason: "disconnected",
        peers: getGroupSessions(hash),
        timestamp: Date.now(),
      });
    }
  });

  ws.on("error", () => {
    if (sovereignKeyHash && registered) {
      removeSession(sovereignKeyHash, sessionId);
      registered = false;
    }
  });

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "mesh:connected",
      channel: "mesh",
      sessionId,
      message: "Tessera Mesh WebSocket — send mesh:auth to entangle",
      timestamp: Date.now(),
    }));
  }
}
