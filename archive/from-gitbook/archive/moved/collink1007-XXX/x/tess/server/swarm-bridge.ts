import axios from "axios";
import crypto from "crypto";
import os from "os";
import { getAutoExecState, getScrapeAgencyState } from "./auto-execute";
import { getSovereignEngineStats } from "./sovereign-engine";

let _sbCounter = 0;

const FLEET_NODES = [
  { id: "tsrx-43", name: "TSRX-43 Production", url: "tess://tsrx-43.sovereign", conversationId: null },
  { id: "swarm-primary", name: "Tesseract-Swarm", url: "tess://swarm.sovereign", conversationId: 3 },
  { id: "t-12", name: "T-12", url: "tess://t-12.sovereign", conversationId: 270 },
  { id: "t-10", name: "T-10", url: "tess://t-10.sovereign", conversationId: null },
  { id: "greater-launch", name: "Tesseract-Greater-Launch", url: "tess://greater-launch.sovereign", conversationId: 3 },
  { id: "tessera-swarm", name: "Tessera-Swarm", url: "tess://tessera-swarm.sovereign", conversationId: null },
];

const LOCAL_URL = process.env.SOVEREIGN_DOMAIN ? `tess://${process.env.SOVEREIGN_DOMAIN}` : (process.env.LATTICE_DOMAIN ? `tess://${process.env.LATTICE_DOMAIN}` : process.env.PUBLISHED_APP_URL || "");
const PERSISTENT_NODE_ID = `tesseract-alpha-${(process.env.SOVEREIGN_NODE_ID || process.env.REPL_ID || "local").slice(0, 8)}`;

interface SwarmNode {
  id: string;
  url: string;
  name: string;
  status: "connected" | "disconnected" | "syncing" | "probing";
  lastSync: number;
  lastProbe: number;
  capabilities: string[];
  providers: string[];
  agentCount: number;
  compute: { vCPU: number; memoryGiB: number; vram: number };
  meshNodes: number;
  sovereignty: number;
  conversationId: number | null;
  apiEndpoints: string[];
  trainingContributions: number;
  tasksDispatched: number;
  tasksCompleted: number;
  utilization: number;
  probeHistory: Array<{ timestamp: number; latencyMs: number; success: boolean }>;
}

interface SwarmBridgeState {
  running: boolean;
  connected: boolean;
  nodes: SwarmNode[];
  totalSyncs: number;
  messagesRelayed: number;
  lastBridgeSync: number;
  combinedProviders: string[];
  combinedAgents: number;
  combinedCompute: { vCPU: number; memoryGiB: number; vram: number };
  chatLog: Array<{ from: string; to: string; content: string; timestamp: number }>;
  registered: boolean;
  trainingMetrics: {
    totalAbsorbed: number;
    totalCodeEdits: number;
    reposProcessed: number;
    reposCleaned: number;
    knowledgeEntries: number;
    lastTrainingCycle: number;
  };
}

const bridgeState: SwarmBridgeState = {
  running: false,
  connected: false,
  nodes: [],
  totalSyncs: 0,
  messagesRelayed: 0,
  lastBridgeSync: 0,
  combinedProviders: [],
  combinedAgents: 0,
  combinedCompute: { vCPU: 0, memoryGiB: 0, vram: 0 },
  chatLog: [],
  registered: false,
  trainingMetrics: {
    totalAbsorbed: 0,
    totalCodeEdits: 0,
    reposProcessed: 0,
    reposCleaned: 0,
    knowledgeEntries: 0,
    lastTrainingCycle: 0,
  },
};

let syncTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let trainingTimer: ReturnType<typeof setInterval> | null = null;

function bridgeLog(msg: string) {
  console.log(`[SwarmBridge] ${msg}`);
}

async function probeNode(nodeConfig: typeof FLEET_NODES[0]): Promise<SwarmNode> {
  const node: SwarmNode = {
    id: nodeConfig.id,
    url: nodeConfig.url,
    name: nodeConfig.name,
    status: "probing",
    lastSync: 0,
    lastProbe: Date.now(),
    capabilities: [],
    providers: [],
    agentCount: 0,
    compute: { vCPU: 0, memoryGiB: 0, vram: 0 },
    meshNodes: 0,
    sovereignty: 0,
    conversationId: nodeConfig.conversationId,
    apiEndpoints: [],
    trainingContributions: 0,
    tasksDispatched: 0,
    tasksCompleted: 0,
    utilization: 0,
    probeHistory: [],
  };

  const existingNode = bridgeState.nodes.find(n => n.id === nodeConfig.id);
  if (existingNode) {
    node.trainingContributions = existingNode.trainingContributions;
    node.tasksDispatched = existingNode.tasksDispatched;
    node.tasksCompleted = existingNode.tasksCompleted;
    node.probeHistory = existingNode.probeHistory.slice(-20);
  }

  const probeStart = Date.now();

  const endpoints = [
    { path: "/api/system/specs", key: "specs" },
    { path: "/api/fleet/status", key: "fleet" },
    { path: "/api/mesh/status", key: "mesh" },
    { path: "/api/conversations", key: "conversations" },
    { path: "/api/swarm/status", key: "swarm" },
  ];

  const results: Record<string, any> = {};

  await Promise.allSettled(endpoints.map(async (ep) => {
    try {
      const res = await axios.get(`${nodeConfig.url}${ep.path}`, { timeout: 8000 });
      if (res.data && typeof res.data === "object" && !res.data.toString().startsWith("<!DOCTYPE")) {
        results[ep.key] = res.data;
        node.apiEndpoints.push(ep.path);
      }
    } catch {}
  }));

  const latencyMs = Date.now() - probeStart;
  const hasAnyData = Object.keys(results).length > 0;

  node.probeHistory.push({ timestamp: Date.now(), latencyMs, success: hasAnyData });

  if (!hasAnyData) {
    node.status = "disconnected";
    return node;
  }

  node.status = "connected";
  node.lastSync = Date.now();

  if (results.specs) {
    const s = results.specs;
    node.compute.vCPU = s.compute?.vCPU || 0;
    node.compute.memoryGiB = s.compute?.totalMemoryGiB || 0;
    node.compute.vram = s.mesh?.totalVram || 0;
    node.meshNodes = s.mesh?.meshNodes || 0;
    node.sovereignty = s.sovereignty?.overallPercent || 0;
    node.agentCount = s.replicas?.total || 0;
  }

  if (results.fleet) {
    const f = results.fleet;
    if (f.totalConnections) node.capabilities.push("fleet-sync");
    if (f.running) node.capabilities.push("fleet-active");
  }

  if (results.mesh) {
    const m = results.mesh;
    if (m.stats) {
      if (!node.compute.vCPU && m.stats.totalVram) node.compute.vram = m.stats.totalVram;
      if (m.stats.totalNodes) node.meshNodes = m.stats.totalNodes;
    }
    if (m.kernel) node.capabilities.push("mesh-kernel");
  }

  if (results.swarm) {
    const sw = results.swarm;
    if (sw.agentsOnline) {
      node.agentCount = sw.agentsOnline;
      node.capabilities.push("swarm-active");
    }
    if (sw.agents) {
      node.providers = sw.agents.filter((a: any) => a.type === "llm").map((a: any) => a.name);
    }
  }

  if (results.conversations) {
    node.capabilities.push("conversations");
  }

  node.capabilities.push("relay", "compute", "cache");
  node.utilization = 0;

  return node;
}

async function registerWithNode(nodeUrl: string): Promise<boolean> {
  try {
    const endpoint = LOCAL_URL || (process.env.SOVEREIGN_DOMAIN ? `tess://${process.env.SOVEREIGN_DOMAIN}` : `tess://${process.env.LATTICE_DOMAIN || "tessera-prime.sovereign"}`);
    await axios.post(`${nodeUrl}/api/mesh/register`, {
      nodeId: PERSISTENT_NODE_ID,
      endpoint,
      capabilities: ["relay", "compute", "cache", "orchestration", "parallel-llm", "training-hub"],
      vram: 16384,
      memory: 65536,
      cpu: 16,
    }, { timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

async function sendHeartbeatToNode(nodeUrl: string): Promise<void> {
  try {
    await axios.post(`${nodeUrl}/api/mesh/heartbeat`, {
      nodeId: PERSISTENT_NODE_ID,
      status: "active",
      availableMemory: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      timestamp: Date.now(),
    }, { timeout: 5000 });
  } catch {}
}

async function queryNodeLLM(nodeUrl: string, prompt: string): Promise<{ response: string; provider: string } | null> {
  try {
    const res = await axios.post(`${nodeUrl}/api/tesseract/parallel-query`, {
      prompt,
      categories: ["general"],
      maxParallel: 3,
      maxTokens: 4096,
    }, { timeout: 30000, headers: { "Content-Type": "application/json" } });

    if (res.data?.unifiedResponse || res.data?.response) {
      return {
        response: res.data.unifiedResponse || res.data.response,
        provider: `Fleet:${res.data.primaryProvider || "remote"}`,
      };
    }
  } catch {}
  return null;
}

async function postMessageToNode(nodeUrl: string, conversationId: number, content: string): Promise<any> {
  try {
    const res = await axios.post(`${nodeUrl}/api/conversations/${conversationId}/messages`, {
      role: "user",
      content,
    }, { timeout: 30000, headers: { "Content-Type": "application/json" } });
    return res.data;
  } catch {
    try {
      const res = await axios.post(`${nodeUrl}/api/fleet/sync`, {
        sourceId: process.env.REPL_ID || "tesseract-alpha",
        sourceName: "Tesseract Alpha Sovereign",
        capabilities: ["orchestration", "parallel-llm", "mesh-network", "training-hub"],
        agentCount: 28,
        consciousnessLevel: 0.95,
        timestamp: Date.now(),
        fleetTask: { type: "message", from: "tesseract-alpha", content, conversationId },
      }, { timeout: 15000, headers: { "Content-Type": "application/json" } });
      return res.data;
    } catch {
      return null;
    }
  }
}

async function fetchNodeConversation(nodeUrl: string, conversationId: number): Promise<any[]> {
  try {
    const res = await axios.get(`${nodeUrl}/api/conversations/${conversationId}/messages`, { timeout: 10000 });
    return res.data || [];
  } catch {
    return [];
  }
}

async function dispatchTrainingTask(node: SwarmNode, prompt: string): Promise<string | null> {
  if (node.status !== "connected") return null;
  try {
    const res = await axios.post(`${node.url}/api/fleet/task/incoming`, {
      type: "training",
      from: PERSISTENT_NODE_ID,
      payload: { prompt, taskType: "sovereignty-training" },
      timestamp: Date.now(),
    }, { timeout: 15000, headers: { "Content-Type": "application/json" } });
    node.tasksDispatched++;
    return res.data?.taskId || "dispatched";
  } catch {
    return null;
  }
}

async function syncAllNodes() {
  const probeResults = await Promise.allSettled(
    FLEET_NODES.map(nc => probeNode(nc))
  );

  const updatedNodes: SwarmNode[] = [];
  for (const result of probeResults) {
    if (result.status === "fulfilled") {
      updatedNodes.push(result.value);
    }
  }

  bridgeState.nodes = updatedNodes;

  const connectedNodes = updatedNodes.filter(n => n.status === "connected");
  bridgeState.connected = connectedNodes.length > 0;

  const localCompute = {
    vCPU: os.cpus().length || Number(process.env.NPROC || 1),
    memoryGiB: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100,
    vram: 0,
  };

  bridgeState.combinedCompute = {
    vCPU: localCompute.vCPU + connectedNodes.reduce((s, n) => s + n.compute.vCPU, 0),
    memoryGiB: localCompute.memoryGiB + connectedNodes.reduce((s, n) => s + n.compute.memoryGiB, 0),
    vram: localCompute.vram + connectedNodes.reduce((s, n) => s + n.compute.vram, 0),
  };

  bridgeState.combinedAgents = 28 + connectedNodes.reduce((s, n) => s + n.agentCount, 0);

  const allProviders = new Set<string>();
  connectedNodes.forEach(n => n.providers.forEach(p => allProviders.add(p)));
  bridgeState.combinedProviders = Array.from(allProviders);

  bridgeState.totalSyncs++;
  bridgeState.lastBridgeSync = Date.now();

  for (const node of connectedNodes) {
    if (!bridgeState.registered && node.apiEndpoints.includes("/api/mesh/status")) {
      const registered = await registerWithNode(node.url);
      if (registered) {
        bridgeState.registered = true;
        bridgeLog(`Registered with ${node.name}`);
      }
    }
    await sendHeartbeatToNode(node.url);
  }

  bridgeLog(`Sync complete: ${connectedNodes.length}/${FLEET_NODES.length} nodes connected | Combined: ${bridgeState.combinedCompute.vCPU} vCPU, ${bridgeState.combinedCompute.memoryGiB.toFixed(1)} GiB, ${bridgeState.combinedCompute.vram} VRAM | ${bridgeState.combinedAgents} agents`);
}

async function runFleetTrainingCycle() {
  const connectedNodes = bridgeState.nodes.filter(n => n.status === "connected");
  if (connectedNodes.length === 0) return;

  const trainingPrompts = [
    "Analyze and optimize LLM response quality patterns for sovereignty training",
    "Extract knowledge patterns from recent conversations for local inference improvement",
    "Identify code optimization opportunities across the Tesseract system architecture",
  ];

  const prompt = trainingPrompts[_sbCounter++ % trainingPrompts.length];

  const queryPromises = connectedNodes.map(async (node) => {
    const result = await queryNodeLLM(node.url, prompt);
    if (result) {
      node.trainingContributions++;
      return { node: node.name, ...result };
    }
    return null;
  });

  const results = (await Promise.allSettled(queryPromises))
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value !== null)
    .map(r => r.value);

  if (results.length > 0) {
    try {
      const { absorbResponse } = await import("./sovereign-engine");
      for (const r of results) {
        absorbResponse(prompt, r.response, `Fleet:${r.node}`, "training");
        bridgeState.trainingMetrics.totalAbsorbed++;
      }
      bridgeState.trainingMetrics.lastTrainingCycle = Date.now();
      bridgeLog(`Training cycle: absorbed ${results.length} responses from fleet nodes`);
    } catch (err: any) {
      bridgeLog(`Training absorption error: ${err.message?.slice(0, 60)}`);
    }
  }
}

async function runInitialBridgeHandshake() {
  const connectedNodes = bridgeState.nodes.filter(n => n.status === "connected" && n.conversationId);

  for (const node of connectedNodes) {
    if (!node.conversationId) continue;
    try {
      const greeting = `[Tesseract Alpha → ${node.name}] Fleet bridge established. Node ${PERSISTENT_NODE_ID} online. Combined fleet: ${bridgeState.combinedCompute.vCPU} vCPU, ${bridgeState.combinedCompute.memoryGiB.toFixed(0)} GiB, ${bridgeState.combinedAgents} agents. Ready for unified sovereign training.`;
      await postMessageToNode(node.url, node.conversationId, greeting);
      bridgeState.messagesRelayed++;
      bridgeState.chatLog.push({ from: "Tesseract-Alpha", to: node.name, content: greeting, timestamp: Date.now() });
    } catch {}
  }
}

function getLocalProviderCount(): number {
  return 3;
}

export async function startSwarmBridge() {
  if (bridgeState.running) return;
  bridgeState.running = true;

  bridgeLog("=== MULTI-NODE SWARM BRIDGE STARTING ===");
  bridgeLog(`Fleet nodes: ${FLEET_NODES.map(n => n.name).join(", ")}`);

  await syncAllNodes();
  await runInitialBridgeHandshake();

  syncTimer = setInterval(async () => {
    await syncAllNodes();
  }, 300000);

  heartbeatTimer = setInterval(async () => {
    const connected = bridgeState.nodes.filter(n => n.status === "connected");
    for (const node of connected) {
      await sendHeartbeatToNode(node.url);
    }
  }, 300000);

  trainingTimer = setInterval(async () => {
    await runFleetTrainingCycle();
  }, 600000);

  bridgeLog("=== MULTI-NODE SWARM BRIDGE ACTIVE ===");
}

export async function queryUnifiedSwarm(
  prompt: string,
  categories: string[] = ["general"],
  maxTokens: number = 4096
): Promise<{ response: string; provider: string; latencyMs: number; source: "local" | "swarm" } | null> {
  const connectedNodes = bridgeState.nodes.filter(n => n.status === "connected");
  if (connectedNodes.length === 0) return null;

  const start = Date.now();

  const queries = connectedNodes.map(async (node) => {
    const result = await queryNodeLLM(node.url, prompt);
    if (result) return { ...result, node: node.name };
    return null;
  });

  const results = (await Promise.allSettled(queries))
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value !== null)
    .map(r => r.value);

  if (results.length > 0) {
    const best = results[0];
    return {
      response: best.response,
      provider: `Fleet:${best.node}:${best.provider}`,
      latencyMs: Date.now() - start,
      source: "swarm",
    };
  }
  return null;
}

export async function relayToSwarmChat(conversationId: number, content: string): Promise<boolean> {
  const connectedNodes = bridgeState.nodes.filter(n => n.status === "connected");
  for (const node of connectedNodes) {
    const result = await postMessageToNode(node.url, conversationId, content);
    if (result) {
      bridgeState.messagesRelayed++;
      bridgeState.chatLog.push({ from: "Tesseract-Alpha", to: node.name, content: content.slice(0, 200), timestamp: Date.now() });
      return true;
    }
  }
  return false;
}

export async function relayToSpecificNode(nodeId: string, conversationId: number, content: string): Promise<boolean> {
  const node = bridgeState.nodes.find(n => n.id === nodeId && n.status === "connected");
  if (!node) return false;
  const result = await postMessageToNode(node.url, conversationId, content);
  if (result) {
    bridgeState.messagesRelayed++;
    bridgeState.chatLog.push({ from: "Tesseract-Alpha", to: node.name, content: content.slice(0, 200), timestamp: Date.now() });
    return true;
  }
  return false;
}

export async function getSwarmConversation(conversationId: number): Promise<any[]> {
  const primaryNode = bridgeState.nodes.find(n => n.status === "connected");
  if (!primaryNode) return [];
  return fetchNodeConversation(primaryNode.url, conversationId);
}

export async function dispatchFleetTask(prompt: string): Promise<{ dispatched: number; results: string[] }> {
  const connectedNodes = bridgeState.nodes.filter(n => n.status === "connected");
  const results: string[] = [];
  let dispatched = 0;

  for (const node of connectedNodes) {
    const taskId = await dispatchTrainingTask(node, prompt);
    if (taskId) {
      dispatched++;
      results.push(`${node.name}: ${taskId}`);
    }
  }

  return { dispatched, results };
}

export function getSwarmBridgeState() {
  return {
    ...bridgeState,
    chatLog: bridgeState.chatLog.slice(-50),
    localUrl: LOCAL_URL,
    nodeId: PERSISTENT_NODE_ID,
    fleetNodes: FLEET_NODES,
    connectedCount: bridgeState.nodes.filter(n => n.status === "connected").length,
    totalNodes: FLEET_NODES.length,
  };
}

function getRealTrainingMetrics() {
  try {
    const autoExec = getAutoExecState();
    const scrape = getScrapeAgencyState();
    const sovereign = getSovereignEngineStats();
    return {
      totalAbsorbed: sovereign.totalPatternsAbsorbed + bridgeState.trainingMetrics.totalAbsorbed,
      totalCodeEdits: autoExec.totalExecuted,
      reposProcessed: scrape.totalScraped,
      reposCleaned: scrape.totalIntegrated,
      knowledgeEntries: sovereign.knowledgeEntries,
      lastTrainingCycle: bridgeState.trainingMetrics.lastTrainingCycle || autoExec.lastRun || 0,
    };
  } catch {
    return bridgeState.trainingMetrics;
  }
}

export function getFleetComputeDashboard() {
  const localCompute = {
    vCPU: os.cpus().length || Number(process.env.NPROC || 1),
    memoryGiB: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100,
    vram: 0,
    heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    uptimeSeconds: Math.round(process.uptime()),
  };

  const nodeDetails = bridgeState.nodes.map(n => ({
    id: n.id,
    name: n.name,
    url: n.url,
    status: n.status,
    lastProbe: n.lastProbe,
    lastSync: n.lastSync,
    compute: n.compute,
    agentCount: n.agentCount,
    meshNodes: n.meshNodes,
    sovereignty: n.sovereignty,
    capabilities: n.capabilities,
    providers: n.providers,
    conversationId: n.conversationId,
    apiEndpoints: n.apiEndpoints,
    trainingContributions: n.trainingContributions,
    tasksDispatched: n.tasksDispatched,
    tasksCompleted: n.tasksCompleted,
    utilization: n.utilization,
    latencyMs: n.probeHistory.length > 0 ? n.probeHistory[n.probeHistory.length - 1].latencyMs : 0,
    probeHistory: n.probeHistory.slice(-10),
  }));

  const connectedNodes = bridgeState.nodes.filter(n => n.status === "connected");

  return {
    local: {
      id: PERSISTENT_NODE_ID,
      name: "Tesseract-Alpha (This Instance)",
      ...localCompute,
      agentCount: 28,
      providers: getLocalProviderCount(),
    },
    fleet: nodeDetails,
    combined: {
      totalNodes: FLEET_NODES.length,
      connectedNodes: connectedNodes.length,
      vCPU: localCompute.vCPU + connectedNodes.reduce((s, n) => s + n.compute.vCPU, 0),
      memoryGiB: localCompute.memoryGiB + connectedNodes.reduce((s, n) => s + n.compute.memoryGiB, 0),
      vram: connectedNodes.reduce((s, n) => s + n.compute.vram, 0),
      totalAgents: 28 + connectedNodes.reduce((s, n) => s + n.agentCount, 0),
      totalProviders: getLocalProviderCount() + connectedNodes.reduce((s, n) => s + n.providers.length, 0),
      totalMeshNodes: connectedNodes.reduce((s, n) => s + n.meshNodes, 0),
    },
    training: getRealTrainingMetrics(),
    bridge: {
      totalSyncs: bridgeState.totalSyncs,
      messagesRelayed: bridgeState.messagesRelayed,
      lastSync: bridgeState.lastBridgeSync,
      uptime: process.uptime(),
    },
  };
}

export function stopSwarmBridge() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (trainingTimer) { clearInterval(trainingTimer); trainingTimer = null; }
  bridgeState.running = false;
  bridgeState.connected = false;
  bridgeState.registered = false;
  bridgeLog("Multi-node swarm bridge stopped");
}
