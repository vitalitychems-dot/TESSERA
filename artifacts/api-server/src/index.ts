import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import app from "./app";
import { logger } from "./lib/logger";
import {
  registerSession,
  removeSession,
  broadcastToGroup,
  updateSessionHeartbeat,
  getGroupSessions,
  getGroupSharedState,
  startMeshHeartbeatMonitor,
} from "./lib/session-mesh";
import { validateMeshToken } from "./lib/mesh-auth";
import { db } from "@workspace/db";
import { swarmTasksTable, decisionHistoryTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const sessionId = uuidv4();
  let sovereignKeyHash: string | null = null;
  let registered = false;

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const tokenParam = url.searchParams.get("token");
  const userAgent = req.headers["user-agent"] || "";

  if (tokenParam) {
    const keyHash = validateMeshToken(tokenParam);
    if (keyHash) {
      sovereignKeyHash = keyHash;
    }
  }

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "mesh:auth") {
        const token = msg.token || "";
        const keyHash = validateMeshToken(token);
        if (keyHash) {
          sovereignKeyHash = keyHash;
          const session = registerSession(sovereignKeyHash, sessionId, ws, {
            userAgent,
            currentPage: msg.metadata?.currentPage,
            activeAgents: msg.metadata?.activeAgents || [],
            taskCount: msg.metadata?.taskCount || 0,
          });
          registered = true;

          const peerState = getGroupSharedState(sovereignKeyHash);
          const peers = getGroupSessions(sovereignKeyHash);

          Promise.all([
            db.select({
              taskId: swarmTasksTable.taskId,
              task: swarmTasksTable.task,
              selectedDomains: swarmTasksTable.selectedDomains,
              status: swarmTasksTable.status,
              agentCount: swarmTasksTable.agentCount,
              overallQuality: swarmTasksTable.overallQuality,
              createdAt: swarmTasksTable.createdAt,
            }).from(swarmTasksTable).orderBy(desc(swarmTasksTable.createdAt)).limit(5),
            db.select({
              id: decisionHistoryTable.id,
              action: decisionHistoryTable.action,
              category: decisionHistoryTable.category,
              significance: decisionHistoryTable.significance,
              decidedAt: decisionHistoryTable.decidedAt,
            }).from(decisionHistoryTable).orderBy(desc(decisionHistoryTable.decidedAt)).limit(5),
          ]).then(([recentTasks, recentDecisions]) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: "mesh:registered",
                channel: "mesh",
                sessionId,
                sharedState: {
                  ...peerState,
                  recentTasks,
                  recentDecisions,
                },
                peers,
                timestamp: Date.now(),
              }));
            }
          }).catch(err => {
            logger.warn({ err }, "Failed to enrich newcomer state from DB");
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: "mesh:registered",
                channel: "mesh",
                sessionId,
                sharedState: peerState,
                peers,
                timestamp: Date.now(),
              }));
            }
          });

          broadcastToGroup(sovereignKeyHash, {
            type: "mesh:peer-joined",
            channel: "mesh",
            sessionId,
            metadata: session.metadata,
            peers: getGroupSessions(sovereignKeyHash),
            timestamp: Date.now(),
          }, sessionId);
        } else {
          ws.send(JSON.stringify({ type: "mesh:auth-failed", channel: "mesh", reason: "invalid token" }));
        }
        return;
      }

      if (msg.type === "mesh:heartbeat") {
        if (sovereignKeyHash && registered) {
          updateSessionHeartbeat(sovereignKeyHash, sessionId, msg.metadata);
          ws.send(JSON.stringify({
            type: "mesh:heartbeat-ack",
            channel: "mesh",
            sessionId,
            peers: getGroupSessions(sovereignKeyHash),
            timestamp: Date.now(),
          }));
        }
        return;
      }

      if (msg.type === "mesh:update-metadata") {
        if (sovereignKeyHash && registered) {
          updateSessionHeartbeat(sovereignKeyHash, sessionId, msg.metadata);
          broadcastToGroup(sovereignKeyHash, {
            type: "mesh:peer-updated",
            channel: "mesh",
            sessionId,
            metadata: msg.metadata,
            timestamp: Date.now(),
          }, sessionId);
        }
        return;
      }

      if (msg.type === "mesh:broadcast") {
        if (sovereignKeyHash && registered) {
          const { payload, eventType } = msg;
          broadcastToGroup(sovereignKeyHash, {
            type: "mesh:event",
            channel: "mesh",
            eventType: eventType || "generic",
            fromSession: sessionId,
            payload,
            timestamp: Date.now(),
          }, sessionId);
        }
        return;
      }

      if (msg.type === "mesh:agent-coordination") {
        if (sovereignKeyHash && registered) {
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
        }
        return;
      }

      if (msg.type === "subscribe") {
        ws.send(JSON.stringify({ type: "subscribed", channel: msg.channel }));
        return;
      }

      if (msg.type === "unsubscribe") {
        return;
      }

    } catch (err) {
      logger.warn({ err }, "Failed to parse WS message");
    }
  });

  ws.on("close", () => {
    if (sovereignKeyHash && registered) {
      removeSession(sovereignKeyHash, sessionId);
      broadcastToGroup(sovereignKeyHash, {
        type: "mesh:peer-left",
        channel: "mesh",
        sessionId,
        reason: "disconnected",
        peers: getGroupSessions(sovereignKeyHash),
        timestamp: Date.now(),
      });
    }
  });

  ws.on("error", () => {
    if (sovereignKeyHash && registered) {
      removeSession(sovereignKeyHash, sessionId);
    }
  });

  ws.send(JSON.stringify({
    type: "mesh:connected",
    channel: "mesh",
    sessionId,
    message: "Tessera Mesh WebSocket — send mesh:auth to entangle",
    timestamp: Date.now(),
  }));
});

startMeshHeartbeatMonitor();

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening with WebSocket mesh enabled");
});
