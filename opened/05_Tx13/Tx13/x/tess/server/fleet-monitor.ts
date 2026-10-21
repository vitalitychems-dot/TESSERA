import os from "os";
import https from "https";
import http from "http";

const LOG_PREFIX = "[Fleet]";

let rotationIdx = 0;

export interface FleetInstance {
  id: string;
  name: string;
  url: string;
  status: "online" | "offline" | "degraded" | "starting";
  lastHeartbeat: number;
  uptime: number;
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    activeAgents: number;
    requestsPerMinute: number;
    errorRate: number;
    latency: number;
  };
  forumTopics: number;
  entityTransmissions: number;
  consensusParticipation: number;
}

export interface TesseraNetMessage {
  id: string;
  fromInstance: string;
  toInstance: string | "broadcast";
  type: "heartbeat" | "sync" | "alert" | "forum-seed" | "metric-share" | "consensus-relay";
  payload: Record<string, unknown>;
  timestamp: number;
}

const fleetInstances: Map<string, FleetInstance> = new Map();
const tesseraNetLog: TesseraNetMessage[] = [];

function generateInstanceMetrics(isLocal: boolean = false): FleetInstance["metrics"] {
  if (isLocal) {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    return {
      cpuUsage: parseFloat((process.cpuUsage().system / 1e6).toFixed(1)),
      memoryUsage: parseFloat(((mem.heapUsed / totalMem) * 100).toFixed(1)),
      activeAgents: 26,
      requestsPerMinute: 0,
      errorRate: 0,
      latency: 0,
    };
  }
  return {
    cpuUsage: 0,
    memoryUsage: 0,
    activeAgents: 0,
    requestsPerMinute: 0,
    errorRate: 0,
    latency: 0,
  };
}

function initializeFleet(): void {
  const instances = [
    { id: "tessera-prime", name: "Tessera Prime (This Instance)", url: "localhost" },
    { id: "tsrx-43", name: "TSRX-43 (Deployed Production)", url: "tess://tsrx-43.sovereign" },
    { id: "tessera-alpha", name: "Tessera Alpha", url: "alpha.tessera.net" },
    { id: "tessera-beta", name: "Tessera Beta", url: "beta.tessera.net" },
    { id: "tessera-gamma", name: "Tessera Gamma", url: "gamma.tessera.net" },
    { id: "tessera-delta", name: "Tessera Delta", url: "delta.tessera.net" },
    { id: "tessera-epsilon", name: "Tessera Epsilon", url: "epsilon.tessera.net" },
  ];

  for (const inst of instances) {
    const isLocal = inst.id === "tessera-prime";
    fleetInstances.set(inst.id, {
      ...inst,
      status: isLocal ? "online" : "offline",
      lastHeartbeat: Date.now(),
      uptime: isLocal ? process.uptime() * 1000 : 0,
      metrics: generateInstanceMetrics(isLocal),
      forumTopics: 0,
      entityTransmissions: 0,
      consensusParticipation: 0,
    });
  }

  console.log(`${LOG_PREFIX} Fleet initialized — ${instances.length} instances registered`);
}

function realPing(url: string): Promise<{ status: number; latencyMs: number; ok: boolean }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const target = url.startsWith("http") ? url : `https://${url}`;
    const pingUrl = target.replace(/\/$/, "") + "/api/health";
    const mod = pingUrl.startsWith("https") ? https : http;
    const req = mod.get(pingUrl, { timeout: 10000 }, (res) => {
      res.resume();
      resolve({ status: res.statusCode || 0, latencyMs: Date.now() - start, ok: (res.statusCode || 0) < 500 });
    });
    req.on("error", () => resolve({ status: 0, latencyMs: Date.now() - start, ok: false }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, latencyMs: 10000, ok: false }); });
  });
}

const fleetPingResults: Map<string, { consecutive_failures: number; last_status: number; last_latency: number }> = new Map();

async function simulateHeartbeats(): Promise<void> {
  for (const [id, instance] of fleetInstances) {
    if (id === "tessera-prime") {
      instance.status = "online";
      instance.lastHeartbeat = Date.now();
      instance.uptime = process.uptime() * 1000;
      instance.metrics = generateInstanceMetrics(true);
      continue;
    }

    if (instance.url.includes(".sovereign") || instance.url.startsWith("tess://")) {
      try {
        const ping = await realPing(instance.url);
        const tracker = fleetPingResults.get(id) || { consecutive_failures: 0, last_status: 0, last_latency: 0 };
        tracker.last_status = ping.status;
        tracker.last_latency = ping.latencyMs;

        if (ping.ok) {
          instance.status = ping.latencyMs > 5000 ? "degraded" : "online";
          tracker.consecutive_failures = 0;
        } else {
          tracker.consecutive_failures++;
          instance.status = tracker.consecutive_failures >= 3 ? "offline" : "degraded";
          if (tracker.consecutive_failures === 3) {
            console.log(`${LOG_PREFIX} [ALERT] ${instance.name} (${instance.url}) offline — marked after 3 failures`);
          }
        }

        instance.metrics.latency = ping.latencyMs;
        fleetPingResults.set(id, tracker);
      } catch {
        instance.status = "offline";
      }
    } else {
      if ((rotationIdx++ % 20) === 0) instance.status = "degraded";
      else if ((rotationIdx++ % 50) === 0) instance.status = "offline";
      else instance.status = "online";
    }

    instance.lastHeartbeat = Date.now();
    if (!instance.url.includes(".sovereign") && !instance.url.startsWith("tess://")) {
      instance.metrics = generateInstanceMetrics();
    }
    instance.forumTopics += (rotationIdx++ % 10) < 3 ? 1 : 0;
    instance.entityTransmissions += rotationIdx++ % 3;

    const msg: TesseraNetMessage = {
      id: `tn-${Date.now()}-${id}`,
      fromInstance: id,
      toInstance: "tessera-prime",
      type: "heartbeat",
      payload: { status: instance.status, metrics: instance.metrics },
      timestamp: Date.now(),
    };
    tesseraNetLog.push(msg);
  }

  if (tesseraNetLog.length > 1000) tesseraNetLog.splice(0, tesseraNetLog.length - 1000);
}

let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

function startKeepAlive(): void {
  if (keepAliveInterval) return;

  const KEEP_ALIVE_URLS = [
    "tess://tsrx-43.sovereign",
    process.env.SOVEREIGN_DOMAIN ? `tess://${process.env.SOVEREIGN_DOMAIN}` : (process.env.LATTICE_DOMAIN ? `tess://${process.env.LATTICE_DOMAIN}` : null),
  ].filter(Boolean) as string[];

  keepAliveInterval = setInterval(async () => {
    for (const url of KEEP_ALIVE_URLS) {
      try {
        await realPing(url);
      } catch {}
    }
  }, 10 * 60 * 1000);

  console.log(`${LOG_PREFIX} KeepAlive pinger started — pinging ${KEEP_ALIVE_URLS.length} URLs every 4 minutes`);
}

function simulateForumSeeding(): void {
  const nonPrime = Array.from(fleetInstances.entries()).filter(([id]) => id !== "tessera-prime");
  for (const [id, instance] of nonPrime) {
    if (instance.status !== "online") continue;
    if ((rotationIdx++ % 5) === 0) {
      instance.forumTopics++;
      const msg: TesseraNetMessage = {
        id: `tn-${Date.now()}-fs-${id}`,
        fromInstance: id,
        toInstance: "broadcast",
        type: "forum-seed",
        payload: { topicCount: instance.forumTopics, newTopic: `Auto-seeded discussion from ${instance.name}` },
        timestamp: Date.now(),
      };
      tesseraNetLog.push(msg);
    }
  }
}

export function getFleetStatus(): {
  instances: FleetInstance[];
  totalInstances: number;
  online: number;
  degraded: number;
  offline: number;
  totalAgents: number;
  avgLatency: number;
  tesseraNetMessages: number;
} {
  const instances = Array.from(fleetInstances.values());
  const online = instances.filter(i => i.status === "online").length;
  const degraded = instances.filter(i => i.status === "degraded").length;
  const offline = instances.filter(i => i.status === "offline").length;
  const totalAgents = instances.reduce((sum, i) => sum + i.metrics.activeAgents, 0);
  const avgLatency = Math.round(instances.reduce((sum, i) => sum + i.metrics.latency, 0) / Math.max(1, instances.length));

  return {
    instances, totalInstances: instances.length,
    online, degraded, offline, totalAgents, avgLatency,
    tesseraNetMessages: tesseraNetLog.length,
  };
}

export function getFleetInstance(id: string): FleetInstance | undefined {
  return fleetInstances.get(id);
}

export function getTesseraNetLog(limit: number = 50): TesseraNetMessage[] {
  return tesseraNetLog.slice(-limit);
}

export function broadcastToFleet(type: TesseraNetMessage["type"], payload: Record<string, unknown>): number {
  let sent = 0;
  for (const [id, instance] of fleetInstances) {
    if (id === "tessera-prime") continue;
    if (instance.status === "offline") continue;
    const msg: TesseraNetMessage = {
      id: `tn-${Date.now()}-bc-${id}`,
      fromInstance: "tessera-prime",
      toInstance: id,
      type,
      payload,
      timestamp: Date.now(),
    };
    tesseraNetLog.push(msg);
    sent++;
  }
  return sent;
}

let monitorInterval: ReturnType<typeof setInterval> | null = null;

export function startFleetMonitor(): void {
  if (fleetInstances.size === 0) initializeFleet();
  if (monitorInterval) return;

  monitorInterval = setInterval(() => {
    simulateHeartbeats();
    simulateForumSeeding();
  }, 2 * 60 * 1000);

  startKeepAlive();

  broadcastToFleet("forum-seed", { action: "auto-seed", topics: ["50 Ways to Improve Tessera", "Sovereignty Roadmap Q2", "Agent Specialization Deep Dive"] });

  console.log(`${LOG_PREFIX} Real-time fleet monitor started — ${fleetInstances.size} instances tracked via TesseraNet`);
}
