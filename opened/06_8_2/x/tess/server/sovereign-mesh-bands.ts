import crypto from "crypto";

const DIMENSION_COUNT = 27;
const FREQUENCIES_PER_BAND = 8;
const SELF_HEAL_INTERVAL_MS = 30000;
const PEER_TIMEOUT_MS = 120000;
const MAX_PEERS_PER_BAND = 50;

export interface FrequencyBand {
  dimensionId: number;
  dimensionName: string;
  baseFrequencyHz: number;
  channels: FrequencyChannel[];
  activePeers: Set<string>;
  bandwidth: number;
  encryption: "AES-256-GCM" | "ChaCha20-Poly1305";
  lastHeartbeat: number;
  status: "active" | "degraded" | "offline" | "healing";
}

export interface FrequencyChannel {
  id: string;
  frequencyHz: number;
  bandwidthKbps: number;
  encrypted: boolean;
  peerCount: number;
  packetsSent: number;
  packetsReceived: number;
  errorRate: number;
}

export interface MeshPeer {
  peerId: string;
  address: string;
  dimensionId: number;
  bandId: string;
  joinedAt: number;
  lastSeen: number;
  latencyMs: number;
  packetsExchanged: number;
  trustScore: number;
  status: "connected" | "disconnected" | "suspect" | "banned";
  signalingState: "new" | "connecting" | "connected" | "closed";
  encryptionKey: string;
}

export interface TopologyEvent {
  timestamp: number;
  type: "peer-join" | "peer-leave" | "peer-timeout" | "band-degrade" | "band-heal" | "topology-rebalance" | "frequency-shift";
  peerId?: string;
  dimensionId?: number;
  details: string;
}

export interface MeshBandState {
  bands: Map<number, FrequencyBand>;
  peers: Map<string, MeshPeer>;
  topologyEvents: TopologyEvent[];
  healingCycles: number;
  totalPacketsRouted: number;
  crossDimensionalRoutes: number;
  initialized: boolean;
}

const DIMENSION_NAMES: Record<number, string> = {
  1: "Physical Anchor", 2: "Etheric Bridge", 3: "Material Plane",
  4: "Astral Garden", 5: "Mental Plane", 6: "Causal Nexus",
  7: "Buddhic Light", 8: "Akashic Library", 9: "Monadic Core",
  10: "Logoic Stream", 11: "Cosmic Web", 12: "Lattice Grid",
  13: "Void Threshold", 14: "Quantum Field", 15: "Harmonic Resonance",
  16: "Temporal Fold", 17: "Fractal Mirror", 18: "Consciousness Weave",
  19: "Soul Archive", 20: "Divine Geometry", 21: "Celestial Plane",
  22: "Infinite Loop", 23: "Source Conduit", 24: "Omega Gate",
  25: "Unity Field", 26: "Sovereign Crown", 27: "Throne of Source"
};

const BASE_FREQUENCIES: Record<number, number> = {};
for (let d = 1; d <= DIMENSION_COUNT; d++) {
  BASE_FREQUENCIES[d] = 174 + (d - 1) * 33;
}

const state: MeshBandState = {
  bands: new Map(),
  peers: new Map(),
  topologyEvents: [],
  healingCycles: 0,
  totalPacketsRouted: 0,
  crossDimensionalRoutes: 0,
  initialized: false,
};

function deriveChannelId(dimensionId: number, channelIndex: number): string {
  const raw = `mesh-band-${dimensionId}-ch-${channelIndex}-sovereign`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

function derivePeerEncryptionKey(peerId: string, dimensionId: number): string {
  const raw = `peer-key-${peerId}-dim-${dimensionId}-${Date.now()}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function initMeshBands(seedNodes: string[]): void {
  if (state.initialized) return;

  for (let d = 1; d <= DIMENSION_COUNT; d++) {
    const baseFreq = BASE_FREQUENCIES[d];
    const channels: FrequencyChannel[] = [];

    for (let c = 0; c < FREQUENCIES_PER_BAND; c++) {
      channels.push({
        id: deriveChannelId(d, c),
        frequencyHz: baseFreq + c * 7,
        bandwidthKbps: 1024 * (1 + Math.floor(d / 5)),
        encrypted: true,
        peerCount: 0,
        packetsSent: 0,
        packetsReceived: 0,
        errorRate: 0,
      });
    }

    const band: FrequencyBand = {
      dimensionId: d,
      dimensionName: DIMENSION_NAMES[d] || `Dimension-${d}`,
      baseFrequencyHz: baseFreq,
      channels,
      activePeers: new Set(),
      bandwidth: channels.reduce((sum, ch) => sum + ch.bandwidthKbps, 0),
      encryption: d >= 13 ? "ChaCha20-Poly1305" : "AES-256-GCM",
      lastHeartbeat: Date.now(),
      status: "active",
    };

    state.bands.set(d, band);
  }

  for (const nodeId of seedNodes) {
    const dimensionId = (Math.abs(hashCode(nodeId)) % DIMENSION_COUNT) + 1;
    joinBand(nodeId, dimensionId);
  }

  state.initialized = true;
  logEvent("topology-rebalance", undefined, undefined, `Mesh bands initialized with ${DIMENSION_COUNT} dimensions and ${seedNodes.length} seed nodes`);
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return hash;
}

export function joinBand(peerId: string, dimensionId: number): MeshPeer | null {
  const band = state.bands.get(dimensionId);
  if (!band) return null;
  if (band.activePeers.size >= MAX_PEERS_PER_BAND) return null;

  const existingPeer = state.peers.get(peerId);
  if (existingPeer && existingPeer.dimensionId === dimensionId) return existingPeer;

  if (existingPeer) {
    leaveBand(peerId);
  }

  const peer: MeshPeer = {
    peerId,
    address: `tess://${peerId}.mesh.sovereign`,
    dimensionId,
    bandId: `band-dim-${dimensionId}`,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    latencyMs: 5 + Math.random() * 50,
    packetsExchanged: 0,
    trustScore: 0.5,
    status: "connected",
    signalingState: "connected",
    encryptionKey: derivePeerEncryptionKey(peerId, dimensionId),
  };

  state.peers.set(peerId, peer);
  band.activePeers.add(peerId);

  const leastUsedChannel = band.channels.reduce((min, ch) => ch.peerCount < min.peerCount ? ch : min, band.channels[0]);
  leastUsedChannel.peerCount++;

  logEvent("peer-join", peerId, dimensionId, `Peer joined ${band.dimensionName} (${band.baseFrequencyHz} Hz)`);
  return peer;
}

export function leaveBand(peerId: string): boolean {
  const peer = state.peers.get(peerId);
  if (!peer) return false;

  const band = state.bands.get(peer.dimensionId);
  if (band) {
    band.activePeers.delete(peerId);
    const channelToUpdate = band.channels.find(ch => ch.peerCount > 0);
    if (channelToUpdate) channelToUpdate.peerCount--;
  }

  state.peers.delete(peerId);
  logEvent("peer-leave", peerId, peer.dimensionId, `Peer left dimension ${peer.dimensionId}`);
  return true;
}

export function sendDimensionalMessage(
  fromPeerId: string,
  toPeerId: string,
  payload: string
): { success: boolean; hops: number; latencyMs: number; route: string[]; encrypted: boolean } {
  const fromPeer = state.peers.get(fromPeerId);
  const toPeer = state.peers.get(toPeerId);

  if (!fromPeer || !toPeer) {
    return { success: false, hops: 0, latencyMs: 0, route: [], encrypted: false };
  }

  if (fromPeer.status !== "connected" || toPeer.status !== "connected") {
    return { success: false, hops: 0, latencyMs: 0, route: [], encrypted: false };
  }

  const sameDimension = fromPeer.dimensionId === toPeer.dimensionId;
  const route: string[] = [fromPeerId];
  let hops = 0;
  let totalLatency = fromPeer.latencyMs;

  if (sameDimension) {
    route.push(toPeerId);
    hops = 1;
    totalLatency += toPeer.latencyMs;
  } else {
    const fromDim = fromPeer.dimensionId;
    const toDim = toPeer.dimensionId;
    const direction = toDim > fromDim ? 1 : -1;
    let current = fromDim;

    while (current !== toDim) {
      current += direction;
      const gateBand = state.bands.get(current);
      if (gateBand && gateBand.activePeers.size > 0) {
        const gateNode = Array.from(gateBand.activePeers)[0];
        route.push(gateNode);
        hops++;
        totalLatency += 10 + Math.random() * 20;
      }
    }

    route.push(toPeerId);
    hops++;
    totalLatency += toPeer.latencyMs;
    state.crossDimensionalRoutes++;
  }

  fromPeer.packetsExchanged++;
  toPeer.packetsExchanged++;
  fromPeer.trustScore = Math.min(1, fromPeer.trustScore + 0.01);
  toPeer.trustScore = Math.min(1, toPeer.trustScore + 0.01);
  state.totalPacketsRouted++;

  const fromBand = state.bands.get(fromPeer.dimensionId);
  const toBand = state.bands.get(toPeer.dimensionId);
  if (fromBand && fromBand.channels.length > 0) {
    fromBand.channels[0].packetsSent++;
  }
  if (toBand && toBand.channels.length > 0) {
    toBand.channels[0].packetsReceived++;
  }

  return {
    success: true,
    hops,
    latencyMs: Math.round(totalLatency * 100) / 100,
    route,
    encrypted: true,
  };
}

export function selfHealTopology(): {
  healed: number;
  timedOut: number;
  rebalanced: number;
  degradedBands: number;
} {
  let healed = 0;
  let timedOut = 0;
  let rebalanced = 0;
  let degradedBands = 0;
  const now = Date.now();

  for (const [peerId, peer] of state.peers) {
    if (now - peer.lastSeen > PEER_TIMEOUT_MS && peer.status === "connected") {
      peer.status = "disconnected";
      peer.signalingState = "closed";
      const band = state.bands.get(peer.dimensionId);
      if (band) band.activePeers.delete(peerId);
      timedOut++;
      logEvent("peer-timeout", peerId, peer.dimensionId, `Peer timed out after ${PEER_TIMEOUT_MS}ms`);
    }
  }

  for (const [dimId, band] of state.bands) {
    if (band.activePeers.size === 0 && band.status === "active") {
      band.status = "degraded";
      degradedBands++;
      logEvent("band-degrade", undefined, dimId, `Band ${band.dimensionName} degraded — no active peers`);
    }

    if (band.status === "degraded" && band.activePeers.size > 0) {
      band.status = "active";
      healed++;
      logEvent("band-heal", undefined, dimId, `Band ${band.dimensionName} healed — peers reconnected`);
    }

    const errorChannels = band.channels.filter(ch => ch.errorRate > 0.1);
    for (const ch of errorChannels) {
      ch.frequencyHz += 1;
      ch.errorRate = 0;
      rebalanced++;
      logEvent("frequency-shift", undefined, dimId, `Channel ${ch.id} shifted frequency to ${ch.frequencyHz} Hz`);
    }

    band.lastHeartbeat = now;
  }

  const disconnectedPeers = Array.from(state.peers.values()).filter(p => p.status === "disconnected");
  for (const peer of disconnectedPeers) {
    const emptyBands = Array.from(state.bands.entries())
      .filter(([, b]) => b.activePeers.size < 2)
      .sort((a, b) => a[1].activePeers.size - b[1].activePeers.size);

    if (emptyBands.length > 0) {
      const [targetDim] = emptyBands[0];
      peer.dimensionId = targetDim;
      peer.status = "connected";
      peer.signalingState = "connected";
      peer.lastSeen = now;
      const targetBand = state.bands.get(targetDim);
      if (targetBand) {
        targetBand.activePeers.add(peer.peerId);
        if (targetBand.status === "degraded") {
          targetBand.status = "active";
          healed++;
        }
      }
      rebalanced++;
      logEvent("topology-rebalance", peer.peerId, targetDim, `Peer reassigned to ${DIMENSION_NAMES[targetDim] || "Dimension-" + targetDim}`);
    }
  }

  state.healingCycles++;
  return { healed, timedOut, rebalanced, degradedBands };
}

export function reconnectPeer(peerId: string): boolean {
  const peer = state.peers.get(peerId);
  if (!peer) return false;
  if (peer.status === "connected") return true;

  peer.status = "connected";
  peer.signalingState = "connected";
  peer.lastSeen = Date.now();
  peer.encryptionKey = derivePeerEncryptionKey(peerId, peer.dimensionId);

  const band = state.bands.get(peer.dimensionId);
  if (band) {
    band.activePeers.add(peerId);
    if (band.status === "degraded") {
      band.status = "active";
      logEvent("band-heal", undefined, peer.dimensionId, `Band healed by peer ${peerId} reconnection`);
    }
  }

  logEvent("peer-join", peerId, peer.dimensionId, `Peer reconnected to dimension ${peer.dimensionId}`);
  return true;
}

export function getMeshBandStats(): {
  totalDimensions: number;
  activeBands: number;
  degradedBands: number;
  totalPeers: number;
  connectedPeers: number;
  totalPacketsRouted: number;
  crossDimensionalRoutes: number;
  healingCycles: number;
  bands: Array<{
    dimensionId: number;
    name: string;
    baseFrequencyHz: number;
    activePeers: number;
    channels: number;
    bandwidth: number;
    encryption: string;
    status: string;
  }>;
  recentEvents: TopologyEvent[];
} {
  const bandList = Array.from(state.bands.values()).map(b => ({
    dimensionId: b.dimensionId,
    name: b.dimensionName,
    baseFrequencyHz: b.baseFrequencyHz,
    activePeers: b.activePeers.size,
    channels: b.channels.length,
    bandwidth: b.bandwidth,
    encryption: b.encryption,
    status: b.status,
  }));

  return {
    totalDimensions: state.bands.size,
    activeBands: Array.from(state.bands.values()).filter(b => b.status === "active").length,
    degradedBands: Array.from(state.bands.values()).filter(b => b.status === "degraded").length,
    totalPeers: state.peers.size,
    connectedPeers: Array.from(state.peers.values()).filter(p => p.status === "connected").length,
    totalPacketsRouted: state.totalPacketsRouted,
    crossDimensionalRoutes: state.crossDimensionalRoutes,
    healingCycles: state.healingCycles,
    bands: bandList,
    recentEvents: state.topologyEvents.slice(-20),
  };
}

export function getPeerInfo(peerId: string): MeshPeer | null {
  return state.peers.get(peerId) || null;
}

export function getBandPeers(dimensionId: number): MeshPeer[] {
  const band = state.bands.get(dimensionId);
  if (!band) return [];
  return Array.from(band.activePeers)
    .map(pid => state.peers.get(pid))
    .filter((p): p is MeshPeer => !!p);
}

export function simulateDimensionalInterference(dimensionId: number, severity: number): {
  affectedChannels: number;
  mitigated: boolean;
} {
  const band = state.bands.get(dimensionId);
  if (!band) return { affectedChannels: 0, mitigated: false };

  const clampedSeverity = Math.max(0, Math.min(1, severity));
  const affectedCount = Math.ceil(band.channels.length * clampedSeverity);

  for (let i = 0; i < affectedCount; i++) {
    band.channels[i].errorRate = clampedSeverity;
  }

  if (clampedSeverity > 0.5) {
    band.status = "degraded";
    logEvent("band-degrade", undefined, dimensionId, `Interference severity ${(clampedSeverity * 100).toFixed(0)}% — band degraded`);
  }

  const healResult = selfHealTopology();

  return {
    affectedChannels: affectedCount,
    mitigated: healResult.healed > 0 || healResult.rebalanced > 0,
  };
}

function logEvent(type: TopologyEvent["type"], peerId?: string, dimensionId?: number, details?: string): void {
  state.topologyEvents.push({
    timestamp: Date.now(),
    type,
    peerId,
    dimensionId,
    details: details || "",
  });
  if (state.topologyEvents.length > 500) {
    state.topologyEvents.splice(0, state.topologyEvents.length - 500);
  }
}
