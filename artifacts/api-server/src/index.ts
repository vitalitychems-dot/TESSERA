import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import app, { initPromise, setServerReady, setServerUnready, deriveStartupProbeRoutes, type StartupProbeRoute } from "./app";
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
import { setActualPort } from "./lib/server-config";
import {
  setOnRoutesHealthyCallback,
  setOnRoutesUnhealthyCallback,
  setWatchdogProbeRoutes,
  INTERNAL_PROBE_HEADER,
  INTERNAL_PROBE_SECRET,
} from "./lib/auto-recovery";
import { db } from "@workspace/db";
import { swarmTasksTable, decisionHistoryTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const basePort = Number(rawPort);

if (Number.isNaN(basePort) || basePort <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    function tryPort(p: number) {
      const probe = http.createServer();
      probe.once("error", (err: NodeJS.ErrnoException) => {
        probe.close();
        if (err.code === "EADDRINUSE") {
          attempt++;
          if (attempt >= maxAttempts) {
            reject(new Error(`No available port found after ${maxAttempts} attempts starting from ${startPort}`));
            return;
          }
          logger.warn({ port: p, nextPort: p + 1 }, "Port in use, trying next port");
          tryPort(p + 1);
        } else {
          reject(err);
        }
      });
      probe.once("listening", () => {
        probe.close(() => resolve(p));
      });
      probe.listen(p);
    }

    tryPort(startPort);
  });
}

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

const PROBE_MAX_ATTEMPTS = 3;
const PROBE_RETRY_DELAY_MS = 1500;

async function probeRoute(
  baseUrl: string,
  route: string,
  treatNotFoundAsFailure: boolean,
): Promise<{ status: number; ok: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${baseUrl}${route}`, {
      signal: controller.signal,
      headers: { [INTERNAL_PROBE_HEADER]: INTERNAL_PROBE_SECRET },
    });
    clearTimeout(timeout);
    const is404Failure = res.status === 404 && treatNotFoundAsFailure;
    const ok = res.status < 500 && !is404Failure;
    return { status: res.status, ok };
  } catch (err: unknown) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ route, err: msg }, "Startup route probe attempt failed");
    return { status: 0, ok: false };
  }
}

async function runPostBindHealthProbe(port: number): Promise<void> {
  const baseUrl = `http://localhost:${port}`;

  const probeRoutes: StartupProbeRoute[] = deriveStartupProbeRoutes();
  const staticCount = probeRoutes.filter(p => !p.hasParams).length;
  const paramCount = probeRoutes.filter(p => p.hasParams).length;
  logger.info(
    { total: probeRoutes.length, staticRoutes: staticCount, parameterizedRoutes: paramCount },
    "=== STARTUP ROUTE PROBE BEGIN — static routes: 404=failure; parameterized routes: 404=OK ===",
  );

  setWatchdogProbeRoutes(probeRoutes);
  setOnRoutesHealthyCallback(setServerReady);
  setOnRoutesUnhealthyCallback(() => setServerUnready("route-health-watchdog"));

  for (let attempt = 1; attempt <= PROBE_MAX_ATTEMPTS; attempt++) {
    const results = await Promise.all(
      probeRoutes.map(p =>
        probeRoute(baseUrl, p.path, !p.hasParams).then(res => ({ route: p.path, hasParams: p.hasParams, ...res })),
      ),
    );
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).map(r => ({ route: r.route, status: r.status, parameterized: r.hasParams }));
    const allOk = failed.length === 0;

    if (allOk) {
      logger.info(
        { passed, total: results.length, attempt },
        "=== STARTUP ROUTE PROBE COMPLETE — all route categories healthy — opening to external traffic ===",
      );
      setServerReady();
      return;
    }

    if (attempt < PROBE_MAX_ATTEMPTS) {
      logger.warn({ failed, attempt, nextAttemptIn: `${PROBE_RETRY_DELAY_MS}ms` }, "Startup route probe: some routes failed — retrying");
      await new Promise<void>(resolve => setTimeout(resolve, PROBE_RETRY_DELAY_MS));
    } else {
      logger.error(
        { passed, total: results.length, failed },
        "=== STARTUP ROUTE PROBE EXHAUSTED — auto-fix strategy: readiness gate stays CLOSED (503). Express route registration cannot be repaired in-process. Watchdog will re-open gate if routes recover on subsequent cycles. If routes are permanently missing, a process-manager restart (systemd/Docker restart policy) is required to re-register them. ===",
      );
    }
  }
}

(async () => {
  try {
    await initPromise;
    logger.info("Module initialization complete — binding port");

    const port = await findAvailablePort(basePort);
    if (port !== basePort) {
      logger.warn({ requestedPort: basePort, actualPort: port }, "Port conflict resolved — using alternate port");
    }
    server.listen(port, async () => {
      setActualPort(port);
      logger.info({ port }, "Server listening with WebSocket mesh enabled");
      await runPostBindHealthProbe(port);
    });
  } catch (err) {
    logger.error({ err }, "Fatal: could not start server");
    process.exit(1);
  }
})();
