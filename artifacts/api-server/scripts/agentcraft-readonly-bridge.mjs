import WebSocket from "ws";

const FOREMAN_URL = process.env.AGENTCRAFT_FOREMAN_URL || "ws://127.0.0.1:7878";
const INGEST_URL = process.env.TESSERA_AGENTCRAFT_INGEST_URL;
const BRIDGE_TOKEN = process.env.AGENTCRAFT_BRIDGE_TOKEN;
const MAX_AGENTS = 32;
const VALID_BACKENDS = new Set(["sim", "claude", "codex"]);
const VALID_STATES = new Set(["idle", "thinking", "reading", "editing", "running", "testing", "waiting_user", "blocked", "done", "error"]);
const VALID_STATIONS = new Set(["desk", "library", "terminal", "testbench", "mergestation", "meeting", "lounge", "user"]);
const agents = new Map();
let backend = null;
let stopped = false;
let reconnectDelayMs = 1_000;
let socket;
let reconnectTimer;
let heartbeat;

function validateEndpoint(raw) {
  if (!raw) throw new Error("TESSERA_AGENTCRAFT_INGEST_URL is required.");
  const url = new URL(raw);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) ||
      url.username || url.password || url.hash || url.search ||
      !url.pathname.endsWith("/api/world/agentcraft/ingest")) {
    throw new Error("Ingest URL must be HTTPS and end with /api/world/agentcraft/ingest (HTTP is allowed only for localhost development).");
  }
  return url.toString();
}

function validateForemanUrl(raw) {
  const url = new URL(raw);
  if (
    url.protocol !== "ws:" ||
    !["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname) ||
    url.username || url.password || url.pathname !== "/" || url.search || url.hash
  ) {
    throw new Error("AgentCraft Foreman must be a loopback WebSocket URL.");
  }
  return url.toString();
}

const ingestUrl = validateEndpoint(INGEST_URL);
const foremanUrl = validateForemanUrl(FOREMAN_URL);
if (!BRIDGE_TOKEN || BRIDGE_TOKEN.length < 32) {
  throw new Error("AGENTCRAFT_BRIDGE_TOKEN must be configured as a secret with at least 32 characters.");
}

function allowlistedAgent(value) {
  if (!value || typeof value !== "object") return null;
  const { id, name, state, station, active } = value;
  if (
    typeof id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$/.test(id) ||
    typeof name !== "string" || !/^[\p{L}\p{N} ._'-]{1,48}$/u.test(name.trim()) ||
    !VALID_STATES.has(state) || !VALID_STATIONS.has(station) || typeof active !== "boolean"
  ) return null;
  return { id, name: name.trim(), state, station, active };
}

async function publishSnapshot() {
  if (!backend || !VALID_BACKENDS.has(backend)) return;
  const payload = {
    backend,
    agents: [...agents.values()].slice(0, MAX_AGENTS),
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch(ingestUrl, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${BRIDGE_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) console.warn(`[agentcraft-bridge] ingest returned HTTP ${response.status}`);
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "request timed out" : "ingest unavailable";
    console.warn(`[agentcraft-bridge] ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function reconnect() {
  if (stopped || reconnectTimer) return;
  const jitter = Math.floor(Math.random() * Math.max(250, reconnectDelayMs / 3));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    connect();
  }, reconnectDelayMs + jitter);
  reconnectDelayMs = Math.min(30_000, Math.round(reconnectDelayMs * 1.8));
}

function connect() {
  if (stopped) return;
  socket = new WebSocket(foremanUrl, { handshakeTimeout: 5_000, maxPayload: 64 * 1024 });
  socket.on("open", () => {
    reconnectDelayMs = 1_000;
    socket.send(JSON.stringify({
      v: 1,
      type: "hello",
      modVersion: "tessera-readonly-bridge",
      protocol: 1,
      client: "tessera-readonly-bridge",
    }));
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) void publishSnapshot();
    }, 15_000);
  });
  socket.on("message", raw => {
    try {
      const message = JSON.parse(raw.toString());
      // Intentionally ignore every command/action response and all user/agent text.
      if (message?.type === "snapshot" && Array.isArray(message.agents)) {
        const nextBackend = message.foreman?.backend;
        if (VALID_BACKENDS.has(nextBackend)) backend = nextBackend;
        agents.clear();
        for (const candidate of message.agents.slice(0, MAX_AGENTS)) {
          const agent = allowlistedAgent(candidate);
          if (agent) agents.set(agent.id, agent);
        }
        void publishSnapshot();
      } else if (message?.type === "agent.upsert") {
        const agent = allowlistedAgent(message.agent);
        if (agent) {
          agents.set(agent.id, agent);
          if (agents.size > MAX_AGENTS) agents.delete(agents.keys().next().value);
          void publishSnapshot();
        }
      } else if (message?.type === "foreman.status") {
        const nextBackend = message.status?.backend;
        if (VALID_BACKENDS.has(nextBackend)) {
          backend = nextBackend;
          void publishSnapshot();
        }
      }
    } catch {
      console.warn("[agentcraft-bridge] ignored an invalid Foreman frame");
    }
  });
  socket.on("error", () => {
    console.warn("[agentcraft-bridge] Foreman connection unavailable");
    socket?.close();
  });
  socket.on("close", () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
    reconnect();
  });
}

function shutdown() {
  stopped = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (heartbeat) clearInterval(heartbeat);
  socket?.close();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
connect();
console.info("[agentcraft-bridge] read-only bridge started; only status and station labels are forwarded");
