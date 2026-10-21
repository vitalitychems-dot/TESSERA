import type { Request, Response, NextFunction, Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { pool, db } from "./db";
import { logger } from "./logger";
import os from "os";

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 300;
const MAX_LLM_REQUESTS_PER_WINDOW = 60;
const RATE_LIMIT_BUFFER_PERCENT = 10;

interface RateLimitEntry {
  count: number;
  llmCount: number;
  windowStart: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimits.delete(key);
    }
  }
}, 60_000);

function getClientId(req: Request): string {
  const token = req.headers["x-admin-session"] as string;
  if (token) return `session:${token.slice(0, 8)}`;
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip || req.socket.remoteAddress || "unknown";
  return `ip:${ip}`;
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api")) return next();

  const clientId = getClientId(req);
  const now = Date.now();
  let entry = rateLimits.get(clientId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { count: 0, llmCount: 0, windowStart: now };
    rateLimits.set(clientId, entry);
  }

  entry.count++;

  const isLLMRoute = req.path.includes("/chat") || req.path.includes("/llm") || req.path.includes("/tesseract");
  if (isLLMRoute) entry.llmCount++;

  const limit = isLLMRoute ? MAX_LLM_REQUESTS_PER_WINDOW : MAX_REQUESTS_PER_WINDOW;
  const currentCount = isLLMRoute ? entry.llmCount : entry.count;

  if (currentCount > limit) {
    const retryAfter = Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    res.set("X-RateLimit-Limit", String(limit));
    res.set("X-RateLimit-Remaining", "0");
    return res.status(429).json({
      error: "Rate limit exceeded",
      retryAfter,
      limit,
    });
  }

  res.set("X-RateLimit-Limit", String(limit));
  res.set("X-RateLimit-Remaining", String(limit - currentCount));
  next();
}

export function healthCheckRoute(app: Express) {
  app.get("/api/health", async (_req: Request, res: Response) => {
    const startTime = Date.now();
    const checks: Record<string, { status: string; latency?: number; details?: string }> = {};

    try {
      const dbStart = Date.now();
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      checks.database = { status: "healthy", latency: Date.now() - dbStart };
    } catch (err) {
      checks.database = { status: "unhealthy", details: (err as Error).message };
    }

    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    checks.memory = {
      status: memUsage.heapUsed < 500 * 1024 * 1024 ? "healthy" : "warning",
      details: `Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB, System: ${Math.round((totalMem - freeMem) / 1024 / 1024)}MB / ${Math.round(totalMem / 1024 / 1024)}MB`,
    };

    checks.uptime = {
      status: "healthy",
      details: `${Math.round(process.uptime())}s`,
    };

    checks.cpu = {
      status: os.loadavg()[0] < os.cpus().length * 2 ? "healthy" : "warning",
      details: `Load: ${os.loadavg().map(l => l.toFixed(2)).join(", ")}`,
    };

    const allHealthy = Object.values(checks).every(c => c.status !== "unhealthy");
    const overallStatus = allHealthy ? "healthy" : "unhealthy";

    res.status(allHealthy ? 200 : 503).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      checks,
      connections: {
        activeRateLimits: rateLimits.size,
        wsClients: wsClients.size,
      },
    });
  });
}

const wsClients = new Map<string, Set<WebSocket>>();
const wsChannels = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const clientId = `ws:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const clientSet = new Set([ws]);
    wsClients.set(clientId, clientSet);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribe" && msg.channel) {
          if (!wsChannels.has(msg.channel)) {
            wsChannels.set(msg.channel, new Set());
          }
          wsChannels.get(msg.channel)!.add(ws);
          ws.send(JSON.stringify({ type: "subscribed", channel: msg.channel }));
        }
        if (msg.type === "unsubscribe" && msg.channel) {
          wsChannels.get(msg.channel)?.delete(ws);
        }
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        }
      } catch {}
    });

    ws.on("close", () => {
      wsClients.delete(clientId);
      for (const [, subscribers] of wsChannels) {
        subscribers.delete(ws);
      }
    });

    ws.on("error", () => {
      wsClients.delete(clientId);
    });

    ws.send(JSON.stringify({
      type: "connected",
      clientId,
      channels: ["agents", "system", "chat", "income", "swarm", "processes"],
    }));
  });

  logger.info("websocket", `WebSocket server initialized on /ws`);
  return wss;
}

export function broadcastToChannel(channel: string, data: Record<string, unknown>) {
  const subscribers = wsChannels.get(channel);
  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify({ channel, ...data, ts: Date.now() });
  for (const ws of subscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch {}
    } else {
      subscribers.delete(ws);
    }
  }
}

export function broadcastAll(data: Record<string, unknown>) {
  const message = JSON.stringify({ ...data, ts: Date.now() });
  for (const [, clients] of wsClients) {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch {}
      }
    }
  }
}

export function errorBoundaryMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
  const errorId = `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  logger.error("error-boundary", `Unhandled error [${errorId}]`, {
    message: err.message,
    stack: err.stack?.split("\n").slice(0, 5).join("\n"),
    path: req.path,
    method: req.method,
  });

  broadcastToChannel("system", {
    type: "error",
    errorId,
    message: err.message,
    path: req.path,
  });

  if (res.headersSent) return next(err);

  res.status(500).json({
    error: "Internal server error",
    errorId,
    message: process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message,
  });
}

interface QueuedRequest {
  id: string;
  priority: number;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  enqueuedAt: number;
}

const llmQueue: QueuedRequest[] = [];
let activeLLMCalls = 0;
const MAX_CONCURRENT_LLM = 5;
const QUEUE_TIMEOUT_MS = 120_000;

function processQueue() {
  while (activeLLMCalls < MAX_CONCURRENT_LLM && llmQueue.length > 0) {
    llmQueue.sort((a, b) => a.priority - b.priority);
    const req = llmQueue.shift()!;

    if (Date.now() - req.enqueuedAt > QUEUE_TIMEOUT_MS) {
      req.reject(new Error("LLM request timed out in queue"));
      continue;
    }

    activeLLMCalls++;
    req.execute()
      .then(req.resolve)
      .catch(req.reject)
      .finally(() => {
        activeLLMCalls--;
        processQueue();
      });
  }
}

export function enqueueLLMCall<T>(
  execute: () => Promise<T>,
  priority: number = 3
): Promise<T> {
  return new Promise((resolve, reject) => {
    llmQueue.push({
      id: `llm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      priority,
      execute,
      resolve,
      reject,
      enqueuedAt: Date.now(),
    });
    processQueue();
  });
}

export function getLLMQueueStats() {
  return {
    queued: llmQueue.length,
    active: activeLLMCalls,
    maxConcurrent: MAX_CONCURRENT_LLM,
  };
}

const routeModules: Map<string, (app: Express) => void> = new Map();

export function registerRouteModule(name: string, registrar: (app: Express) => void) {
  routeModules.set(name, registrar);
}

export function mountRouteModules(app: Express) {
  for (const [name, registrar] of routeModules) {
    try {
      registrar(app);
      logger.info("routes", `Mounted route module: ${name}`);
    } catch (err) {
      logger.error("routes", `Failed to mount route module: ${name}`, { error: (err as Error).message });
    }
  }
}

export function getRouteModuleStats() {
  return {
    modules: Array.from(routeModules.keys()),
    count: routeModules.size,
  };
}

export function installInfrastructure(app: Express, server: Server) {
  app.use(rateLimitMiddleware);
  healthCheckRoute(app);
  setupWebSocket(server);
  app.use(errorBoundaryMiddleware as any);

  logger.info("infrastructure", "Infrastructure layer installed — rate limiting, health checks, WebSocket, error boundary, LLM queue");
}

console.log("[Infrastructure] Rate limiting, WebSocket hub, health checks, error boundary, LLM queue — loaded");
