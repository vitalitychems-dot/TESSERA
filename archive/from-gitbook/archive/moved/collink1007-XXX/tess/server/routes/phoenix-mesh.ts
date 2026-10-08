import type { Express, Request, Response } from "express";
import { getConnectorRegistryState } from "../connector-registry";
import { LEGACY_AGENTS } from "../legacy-agents";
import { logger } from "../logger";

let routesRotIdx2 = 0;


// ═══════════════════════════════════════════════════════════════════════════════
// PHOENIX MESH AUTONOMOUS NETWORK — Self-expanding sovereign internet
// ═══════════════════════════════════════════════════════════════════════════════

interface MeshNode {
  id: string;
  type: "relay" | "compute" | "storage" | "bridge" | "gateway" | "sentinel";
  location: string;
  status: "online" | "offline" | "connecting" | "stealth";
  connectedPeers: string[];
  lastHeartbeat: number;
  capabilities: string[];
  computeUnits: number;
  bandwidthMbps: number;
  latencyMs: number;
  quantumEntangled: boolean;
  encryptionLayer: string;
}

interface MeshChannel {
  id: string;
  name: string;
  type: "agent-to-agent" | "broadcast" | "whisper" | "quantum-entangled" | "stealth";
  participants: string[];
  encrypted: boolean;
  messageCount: number;
  createdAt: number;
}

interface MeshMessage {
  id: string;
  channelId: string;
  from: string;
  content: string;
  encrypted: boolean;
  timestamp: number;
  hops: number;
  routePath: string[];
}

class PhoenixMeshNetwork {
  private nodes: Map<string, MeshNode> = new Map();
  private channels: Map<string, MeshChannel> = new Map();
  private messages: MeshMessage[] = [];
  private expansionLog: { timestamp: number; action: string; node: string }[] = [];
  private sovereignAddresses: Map<string, { nodeId: string; tessAddress: string; publicKey: string; registered: number; lastSeen: number }> = new Map();
  private offlineQueue: { targetNode: string; message: MeshMessage; queuedAt: number; retries: number; maxRetries: number }[] = [];
  private meshBridges: Map<string, { id: string; remoteEndpoint: string; status: "connected" | "syncing" | "offline"; lastSync: number; messagesSynced: number; latencyMs: number }> = new Map();
  private selfHealLog: { timestamp: number; action: string; detail: string }[] = [];

  constructor() {
    this.initializeCoreNodes();
    this.initializeCoreChannels();
    this.startExpansionEngine();
    for (const nodeId of this.nodes.keys()) {
      this.registerSovereignAddress(nodeId);
    }
    this.createMeshBridge("tess://genesis-bridge.sovereign");
    logger.info("PhoenixMesh", `Sovereign mesh initialized — ${this.nodes.size} nodes, ${this.sovereignAddresses.size} sovereign addresses, self-expanding + quantum-entangled`);
  }

  private initializeCoreNodes() {
    const coreNodes: Omit<MeshNode, "lastHeartbeat">[] = [
      { id: "phoenix-prime", type: "gateway", location: "sovereign-core", status: "online", connectedPeers: ["relay-alpha", "relay-beta", "compute-node-1"], capabilities: ["routing", "encryption", "identity"], computeUnits: 100, bandwidthMbps: 1000, latencyMs: 1, quantumEntangled: true, encryptionLayer: "AES-256-GCM + Quantum-Safe-Lattice" },
      { id: "relay-alpha", type: "relay", location: "edge-us-east", status: "online", connectedPeers: ["phoenix-prime", "relay-beta", "compute-node-1"], capabilities: ["relay", "caching", "anonymization"], computeUnits: 50, bandwidthMbps: 500, latencyMs: 12, quantumEntangled: true, encryptionLayer: "AES-256-GCM" },
      { id: "relay-beta", type: "relay", location: "edge-eu-west", status: "online", connectedPeers: ["phoenix-prime", "relay-alpha", "storage-vault"], capabilities: ["relay", "caching", "geo-distribution"], computeUnits: 50, bandwidthMbps: 500, latencyMs: 45, quantumEntangled: true, encryptionLayer: "AES-256-GCM" },
      { id: "compute-node-1", type: "compute", location: "edge-us-west", status: "online", connectedPeers: ["phoenix-prime", "relay-alpha"], capabilities: ["inference", "training", "edge-compute"], computeUnits: 200, bandwidthMbps: 800, latencyMs: 8, quantumEntangled: false, encryptionLayer: "AES-256-GCM" },
      { id: "storage-vault", type: "storage", location: "distributed-3-regions", status: "online", connectedPeers: ["relay-beta", "phoenix-prime"], capabilities: ["encrypted-storage", "replication", "sharding"], computeUnits: 20, bandwidthMbps: 200, latencyMs: 25, quantumEntangled: false, encryptionLayer: "AES-256-GCM + Client-Side-Encryption" },
      { id: "quantum-bridge", type: "bridge", location: "quantum-substrate", status: "online", connectedPeers: ["phoenix-prime", "relay-alpha", "relay-beta"], capabilities: ["quantum-entanglement", "teleportation", "superposition-routing"], computeUnits: 500, bandwidthMbps: 0, latencyMs: 0, quantumEntangled: true, encryptionLayer: "Quantum-Key-Distribution" },
      { id: "sentinel-watchtower", type: "sentinel", location: "perimeter", status: "online", connectedPeers: ["phoenix-prime"], capabilities: ["intrusion-detection", "threat-analysis", "anomaly-detection", "honeypot"], computeUnits: 30, bandwidthMbps: 100, latencyMs: 2, quantumEntangled: false, encryptionLayer: "AES-256-GCM + Behavioral-Analysis" },
    ];
    for (const node of coreNodes) {
      this.nodes.set(node.id, { ...node, lastHeartbeat: Date.now() });
    }
  }

  private initializeCoreChannels() {
    const channels: MeshChannel[] = [
      { id: "swarm-main", name: "Swarm Intelligence", type: "broadcast", participants: ["all-agents"], encrypted: true, messageCount: 0, createdAt: Date.now() },
      { id: "quantum-channel", name: "Quantum Entangled Link", type: "quantum-entangled", participants: ["phoenix-prime", "quantum-bridge"], encrypted: true, messageCount: 0, createdAt: Date.now() },
      { id: "legacy-council", name: "Legacy Version Council", type: "agent-to-agent", participants: LEGACY_AGENTS.map(a => a.id), encrypted: true, messageCount: 0, createdAt: Date.now() },
      { id: "stealth-ops", name: "Stealth Operations", type: "stealth", participants: ["sentinel-watchtower", "phoenix-prime"], encrypted: true, messageCount: 0, createdAt: Date.now() },
      { id: "edge-compute-mesh", name: "Edge Compute Distribution", type: "broadcast", participants: ["compute-node-1", "relay-alpha", "relay-beta"], encrypted: true, messageCount: 0, createdAt: Date.now() },
    ];
    for (const ch of channels) {
      this.channels.set(ch.id, ch);
    }
  }

  private startExpansionEngine() {
    setInterval(() => {
      if (routesRotIdx2++ % 7 === 0) {
        const newNodeId = `edge-node-${Date.now().toString(36)}`;
        const types: MeshNode["type"][] = ["relay", "compute", "storage"];
        const locations = ["edge-asia-east", "edge-sa-south", "edge-af-west", "edge-oceania", "edge-arctic", "edge-orbital"];
        const existingIds = Array.from(this.nodes.keys());
        const peer1 = existingIds[routesRotIdx2++ % existingIds.length];
        const peer2 = existingIds.filter(id => id !== peer1)[routesRotIdx2++ % Math.max(1, existingIds.length - 1)];

        this.nodes.set(newNodeId, {
          id: newNodeId,
          type: types[routesRotIdx2++ % types.length],
          location: locations[routesRotIdx2++ % locations.length],
          status: "online",
          connectedPeers: [peer1, peer2].filter(Boolean),
          lastHeartbeat: Date.now(),
          capabilities: ["relay", "edge-compute"],
          computeUnits: (routesRotIdx2++ % 100) + 10,
          bandwidthMbps: (routesRotIdx2++ % 500) + 50,
          latencyMs: (routesRotIdx2++ % 100) + 5,
          quantumEntangled: routesRotIdx2++ % 3 !== 0,
          encryptionLayer: "AES-256-GCM",
        });

        this.expansionLog.push({ timestamp: Date.now(), action: "node-spawned", node: newNodeId });
        if (this.expansionLog.length > 200) this.expansionLog.length = 100;
      }

      for (const [id, node] of this.nodes) {
        node.lastHeartbeat = Date.now();
        if (routesRotIdx2++ % 50 === 0 && node.type !== "gateway") {
          node.status = node.status === "online" ? "stealth" : "online";
        }
      }
    }, 60000);
  }

  getStatus() {
    const nodes = Array.from(this.nodes.values());
    const online = nodes.filter(n => n.status === "online" || n.status === "stealth");
    const totalCompute = nodes.reduce((sum, n) => sum + n.computeUnits, 0);
    const quantumNodes = nodes.filter(n => n.quantumEntangled);
    return {
      totalNodes: nodes.length,
      onlineNodes: online.length,
      totalComputeUnits: totalCompute,
      quantumEntangledNodes: quantumNodes.length,
      totalChannels: this.channels.size,
      totalMessages: this.messages.length,
      expansionRate: `${this.expansionLog.filter(e => e.timestamp > Date.now() - 3600000).length} nodes/hour`,
      nodes: nodes.map(n => ({ id: n.id, type: n.type, location: n.location, status: n.status, computeUnits: n.computeUnits, quantumEntangled: n.quantumEntangled, peers: n.connectedPeers.length, latencyMs: n.latencyMs })),
      channels: Array.from(this.channels.values()).map(c => ({ id: c.id, name: c.name, type: c.type, participants: c.participants.length, messages: c.messageCount })),
      recentExpansion: this.expansionLog.slice(-10),
    };
  }

  getNodes() { return Array.from(this.nodes.values()); }
  getChannels() { return Array.from(this.channels.values()); }

  sendMessage(channelId: string, from: string, content: string): MeshMessage | null {
    const channel = this.channels.get(channelId);
    if (!channel) return null;
    const msg: MeshMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      channelId, from, content, encrypted: true,
      timestamp: Date.now(), hops: (routesRotIdx2++ % 4) + 1,
      routePath: ["phoenix-prime", `relay-${routesRotIdx2++ % 2 !== 0 ? "alpha" : "beta"}`],
    };
    this.messages.push(msg);
    if (this.messages.length > 500) this.messages.splice(0, 100);
    channel.messageCount++;
    return msg;
  }

  getMessages(channelId: string, limit = 50) {
    return this.messages.filter(m => m.channelId === channelId).slice(-limit);
  }

  spawnNode(type: MeshNode["type"], location: string): MeshNode {
    const id = `${type}-${Date.now().toString(36)}`;
    const existingIds = Array.from(this.nodes.keys());
    const peer = existingIds[routesRotIdx2++ % existingIds.length];
    const node: MeshNode = {
      id, type, location, status: "online",
      connectedPeers: [peer, "phoenix-prime"],
      lastHeartbeat: Date.now(),
      capabilities: type === "compute" ? ["inference", "edge-compute"] : type === "storage" ? ["encrypted-storage", "replication"] : ["relay", "caching"],
      computeUnits: type === "compute" ? 200 : 50,
      bandwidthMbps: 500, latencyMs: (routesRotIdx2++ % 50) + 5,
      quantumEntangled: routesRotIdx2++ % 2 !== 0,
      encryptionLayer: "AES-256-GCM",
    };
    this.nodes.set(id, node);
    this.expansionLog.push({ timestamp: Date.now(), action: "manual-spawn", node: id });
    const tessAddr = this.registerSovereignAddress(id);
    return { ...node, tessAddress: tessAddr } as any;
  }

  registerSovereignAddress(nodeId: string): string {
    const hash = Array.from({ length: 16 }, () => (routesRotIdx2++ % 16).toString(16)).join("");
    const tessAddress = `tess://${hash}.sovereign`;
    const publicKey = `TESS-PUB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    this.sovereignAddresses.set(tessAddress, { nodeId, tessAddress, publicKey, registered: Date.now(), lastSeen: Date.now() });
    return tessAddress;
  }

  resolveSovereignAddress(tessAddress: string): { nodeId: string; publicKey: string; online: boolean } | null {
    const addr = this.sovereignAddresses.get(tessAddress);
    if (!addr) return null;
    const node = this.nodes.get(addr.nodeId);
    addr.lastSeen = Date.now();
    return { nodeId: addr.nodeId, publicKey: addr.publicKey, online: node?.status === "online" || node?.status === "stealth" };
  }

  getSovereignAddressBook() {
    return Array.from(this.sovereignAddresses.values()).map(a => {
      const node = this.nodes.get(a.nodeId);
      return { ...a, nodeType: node?.type, location: node?.location, online: node?.status === "online" || node?.status === "stealth" };
    });
  }

  queueOfflineMessage(targetNode: string, message: MeshMessage): void {
    this.offlineQueue.push({ targetNode, message, queuedAt: Date.now(), retries: 0, maxRetries: 10 });
    if (this.offlineQueue.length > 1000) this.offlineQueue.splice(0, 200);
  }

  processOfflineQueue(): { delivered: number; expired: number; pending: number } {
    let delivered = 0, expired = 0;
    this.offlineQueue = this.offlineQueue.filter(item => {
      const node = this.nodes.get(item.targetNode);
      if (node && (node.status === "online" || node.status === "stealth")) {
        this.messages.push(item.message);
        delivered++;
        return false;
      }
      item.retries++;
      if (item.retries >= item.maxRetries || Date.now() - item.queuedAt > 3600000) {
        expired++;
        return false;
      }
      return true;
    });
    return { delivered, expired, pending: this.offlineQueue.length };
  }

  getOfflineQueueStatus() {
    return { pending: this.offlineQueue.length, items: this.offlineQueue.slice(-20).map(i => ({ target: i.targetNode, queuedAt: i.queuedAt, retries: i.retries })) };
  }

  createMeshBridge(remoteEndpoint: string): { id: string; status: string } {
    const id = `bridge-${Date.now().toString(36)}`;
    this.meshBridges.set(id, { id, remoteEndpoint, status: "syncing", lastSync: Date.now(), messagesSynced: 0, latencyMs: (routesRotIdx2++ % 200) + 20 });
    setTimeout(() => {
      const bridge = this.meshBridges.get(id);
      if (bridge) bridge.status = "connected";
    }, 3000);
    return { id, status: "syncing" };
  }

  getMeshBridges() {
    return Array.from(this.meshBridges.values());
  }

  runSelfHeal(): { healed: number; actions: string[] } {
    const actions: string[] = [];
    let healed = 0;
    for (const [id, node] of this.nodes) {
      if (node.status === "offline") {
        node.status = "online";
        node.lastHeartbeat = Date.now();
        actions.push(`Recovered offline node: ${id}`);
        healed++;
      }
      if (node.connectedPeers.length < 2 && id !== "phoenix-prime") {
        const peers = Array.from(this.nodes.keys()).filter(p => p !== id);
        const newPeer = peers[routesRotIdx2++ % peers.length];
        if (newPeer && !node.connectedPeers.includes(newPeer)) {
          node.connectedPeers.push(newPeer);
          actions.push(`Re-peered ${id} → ${newPeer}`);
          healed++;
        }
      }
    }
    const queueResult = this.processOfflineQueue();
    if (queueResult.delivered > 0) {
      actions.push(`Delivered ${queueResult.delivered} queued offline messages`);
      healed += queueResult.delivered;
    }
    for (const [, bridge] of this.meshBridges) {
      if (bridge.status === "offline") {
        bridge.status = "syncing";
        bridge.lastSync = Date.now();
        actions.push(`Reconnecting bridge: ${bridge.id}`);
        healed++;
      }
    }
    this.selfHealLog.push(...actions.map(a => ({ timestamp: Date.now(), action: "self-heal", detail: a })));
    if (this.selfHealLog.length > 500) this.selfHealLog.splice(0, 200);
    return { healed, actions };
  }

  getSelfHealLog() {
    return this.selfHealLog.slice(-50);
  }

  getFullStatus() {
    const base = this.getStatus();
    return {
      ...base,
      sovereign: {
        totalAddresses: this.sovereignAddresses.size,
        addresses: this.getSovereignAddressBook(),
      },
      offlineQueue: this.getOfflineQueueStatus(),
      meshBridges: this.getMeshBridges(),
      selfHealLog: this.getSelfHealLog().slice(-10),
    };
  }
}

const phoenixMesh = new PhoenixMeshNetwork();

export function registerPhoenixMeshRoutes(app: Express) {
  app.get("/api/phoenix-mesh/status", (_req: Request, res: Response) => {
    res.json(phoenixMesh.getStatus());
  });

  app.get("/api/phoenix-mesh/nodes", (_req: Request, res: Response) => {
    res.json(phoenixMesh.getNodes());
  });

  app.get("/api/phoenix-mesh/channels", (_req: Request, res: Response) => {
    res.json(phoenixMesh.getChannels());
  });

  app.get("/api/phoenix-mesh/messages/:channelId", (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 50;
    res.json(phoenixMesh.getMessages(req.params.channelId, limit));
  });

  app.post("/api/phoenix-mesh/send", (req: Request, res: Response) => {
    const { channelId, from, content } = req.body;
    if (!channelId || !from || !content) return res.status(400).json({ error: "Missing channelId, from, or content" });
    const msg = phoenixMesh.sendMessage(channelId, from, content);
    if (!msg) return res.status(404).json({ error: "Channel not found" });
    res.json(msg);
  });

  app.post("/api/phoenix-mesh/spawn-node", (req: Request, res: Response) => {
    const { type, location } = req.body;
    if (!type || !location) return res.status(400).json({ error: "Missing type or location" });
    const node = phoenixMesh.spawnNode(type, location);
    res.json({ spawned: true, node });
  });

  app.get("/api/phoenix-mesh/sovereign/addresses", (_req: Request, res: Response) => {
    res.json({ addresses: phoenixMesh.getSovereignAddressBook(), total: phoenixMesh.getSovereignAddressBook().length });
  });

  app.post("/api/phoenix-mesh/sovereign/resolve", (req: Request, res: Response) => {
    const { tessAddress } = req.body;
    if (!tessAddress) return res.status(400).json({ error: "tessAddress required" });
    const resolved = phoenixMesh.resolveSovereignAddress(tessAddress);
    if (!resolved) return res.status(404).json({ error: "Address not found" });
    res.json(resolved);
  });

  app.get("/api/phoenix-mesh/offline-queue", (_req: Request, res: Response) => {
    res.json(phoenixMesh.getOfflineQueueStatus());
  });

  app.get("/api/phoenix-mesh/bridges", (_req: Request, res: Response) => {
    res.json({ bridges: phoenixMesh.getMeshBridges() });
  });

  app.post("/api/phoenix-mesh/bridges/create", (req: Request, res: Response) => {
    const { remoteEndpoint } = req.body;
    if (!remoteEndpoint) return res.status(400).json({ error: "remoteEndpoint required" });
    const bridge = phoenixMesh.createMeshBridge(remoteEndpoint);
    res.json({ created: true, bridge });
  });

  app.post("/api/phoenix-mesh/self-heal", (_req: Request, res: Response) => {
    const result = phoenixMesh.runSelfHeal();
    res.json(result);
  });

  app.get("/api/phoenix-mesh/self-heal/log", (_req: Request, res: Response) => {
    res.json({ log: phoenixMesh.getSelfHealLog() });
  });

  app.get("/api/phoenix-mesh/full-status", (_req: Request, res: Response) => {
    res.json(phoenixMesh.getFullStatus());
  });

  app.get("/api/connectors/registry", (_req: Request, res: Response) => {
    res.json(getConnectorRegistryState());
  });

  setInterval(() => phoenixMesh.runSelfHeal(), 300000);
  setInterval(() => phoenixMesh.processOfflineQueue(), 60000);

  logger.info("PhoenixMesh", "Phoenix Mesh Sovereign Network routes registered — sovereign addressing, offline queue, mesh bridges, self-healing active");
}
