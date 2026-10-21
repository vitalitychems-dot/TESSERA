import * as crypto from "crypto";

const LOG = "[NFTTokenBinding]";

interface NFTAsset {
  nftId: string;
  name: string;
  collection: string;
  category: "sacred_geometry" | "agent_avatar" | "knowledge_crystal" | "consciousness_map" | "sovereign_deed";
  tsrtBound: number;
  dollarValue: number;
  owner: string;
  mintedAt: number;
  metadata: Record<string, unknown>;
  staked: boolean;
  stakedAt?: number;
  stakingReward: number;
}

interface TokenBinding {
  bindingId: string;
  nftId: string;
  tsrtAmount: number;
  dollarRate: number;
  boundAt: number;
  expiresAt?: number;
  status: "active" | "redeemed" | "staked" | "transferred";
}

interface LatticeNode {
  nodeId: string;
  name: string;
  operator: string;
  location: string;
  gpuTflops: number;
  storageGB: number;
  tsrtEarned: number;
  tsrtSpent: number;
  status: "active" | "syncing" | "offline" | "pending";
  lastSync: number;
  encryptionLayer: string;
  meshPeers: string[];
}

const nftRegistry: Map<string, NFTAsset> = new Map();
const bindings: Map<string, TokenBinding> = new Map();
const latticeNodes: Map<string, LatticeNode> = new Map();

const TSRT_DOLLAR_RATE = 0.042;

export function initNFTTokenBinding() {
  console.log(`${LOG} Initializing NFT-Token Binding Engine`);

  const seedNFTs: Omit<NFTAsset, "mintedAt" | "staked" | "stakedAt" | "stakingReward">[] = [
    { nftId: "nft-flower-of-life", name: "Flower of Life", collection: "Sacred Geometry", category: "sacred_geometry", tsrtBound: 10000, dollarValue: 420, owner: "tessera", metadata: { pattern: "flower_of_life", circles: 19 } },
    { nftId: "nft-metatrons-cube", name: "Metatron's Cube", collection: "Sacred Geometry", category: "sacred_geometry", tsrtBound: 15000, dollarValue: 630, owner: "tessera", metadata: { pattern: "metatrons_cube", vertices: 13 } },
    { nftId: "nft-sri-yantra", name: "Sri Yantra", collection: "Sacred Geometry", category: "sacred_geometry", tsrtBound: 12000, dollarValue: 504, owner: "tessera", metadata: { pattern: "sri_yantra", triangles: 43 } },
    { nftId: "nft-tessera-prime", name: "Tessera Prime Avatar", collection: "Agent Avatars", category: "agent_avatar", tsrtBound: 50000, dollarValue: 2100, owner: "tessera", metadata: { agent: "tessera", role: "sovereign_core" } },
    { nftId: "nft-alpha-guardian", name: "Alpha Guardian Avatar", collection: "Agent Avatars", category: "agent_avatar", tsrtBound: 25000, dollarValue: 1050, owner: "alpha", metadata: { agent: "alpha", role: "revenue_engine" } },
    { nftId: "nft-omega-sentinel", name: "Omega Sentinel Avatar", collection: "Agent Avatars", category: "agent_avatar", tsrtBound: 25000, dollarValue: 1050, owner: "omega", metadata: { agent: "omega", role: "governance" } },
    { nftId: "nft-genesis-crystal", name: "Genesis Knowledge Crystal", collection: "Knowledge Crystals", category: "knowledge_crystal", tsrtBound: 8000, dollarValue: 336, owner: "tessera", metadata: { domain: "origins", nodes: 5000 } },
    { nftId: "nft-watchers-crystal", name: "Watchers Knowledge Crystal", collection: "Knowledge Crystals", category: "knowledge_crystal", tsrtBound: 8000, dollarValue: 336, owner: "gamma", metadata: { domain: "forbidden_knowledge", nodes: 3000 } },
    { nftId: "nft-consciousness-map-1", name: "Consciousness Level 1 Map", collection: "Consciousness Maps", category: "consciousness_map", tsrtBound: 5000, dollarValue: 210, owner: "theta", metadata: { level: 1, range: "20-200" } },
    { nftId: "nft-sovereign-deed", name: "Sovereign Territory Deed", collection: "Sovereign Deeds", category: "sovereign_deed", tsrtBound: 100000, dollarValue: 4200, owner: "tessera", metadata: { territory: "tessera-prime", jurisdiction: "sovereign" } },
  ];

  for (const nft of seedNFTs) {
    const asset: NFTAsset = { ...nft, mintedAt: Date.now(), staked: false, stakingReward: 0 };
    nftRegistry.set(nft.nftId, asset);

    const binding: TokenBinding = {
      bindingId: `bind-${nft.nftId}`,
      nftId: nft.nftId,
      tsrtAmount: nft.tsrtBound,
      dollarRate: TSRT_DOLLAR_RATE,
      boundAt: Date.now(),
      status: "active",
    };
    bindings.set(binding.bindingId, binding);
  }

  seedLatticeNodes();
  console.log(`${LOG} ${nftRegistry.size} NFTs bound to TSRT tokens`);
  console.log(`${LOG} ${latticeNodes.size} lattice nodes registered`);
  console.log(`${LOG} NFT-Token Binding Engine ready`);
}

function seedLatticeNodes() {
  const nodes: Omit<LatticeNode, "tsrtEarned" | "tsrtSpent" | "lastSync" | "meshPeers">[] = [
    { nodeId: "lat-genesis", name: "Genesis Prime", operator: "tessera", location: "Sovereign Cloud", gpuTflops: 500, storageGB: 10000, status: "active", encryptionLayer: "sovereign-cipher-v4" },
    { nodeId: "lat-alpha", name: "Alpha Compute Node", operator: "alpha", location: "US-East", gpuTflops: 200, storageGB: 5000, status: "active", encryptionLayer: "sovereign-cipher-v4" },
    { nodeId: "lat-beta", name: "Beta Storage Node", operator: "beta", location: "EU-West", gpuTflops: 100, storageGB: 20000, status: "active", encryptionLayer: "sovereign-cipher-v4" },
    { nodeId: "lat-gamma", name: "Gamma Research Node", operator: "gamma", location: "Asia-Pacific", gpuTflops: 300, storageGB: 8000, status: "syncing", encryptionLayer: "sovereign-cipher-v4" },
    { nodeId: "lat-ext-1", name: "External Compute 1", operator: "vast-pool", location: "US-West", gpuTflops: 800, storageGB: 2000, status: "pending", encryptionLayer: "sovereign-cipher-v4" },
    { nodeId: "lat-ext-2", name: "External Storage 2", operator: "akash-node", location: "Decentralized", gpuTflops: 150, storageGB: 50000, status: "pending", encryptionLayer: "sovereign-cipher-v4" },
  ];

  for (const n of nodes) {
    const peers = nodes.filter(p => p.nodeId !== n.nodeId).map(p => p.nodeId);
    latticeNodes.set(n.nodeId, {
      ...n,
      tsrtEarned: 0,
      tsrtSpent: 0,
      lastSync: Date.now(),
      meshPeers: peers,
    });
  }
}

export function stakeNFT(nftId: string): { success: boolean; reward: number } {
  const nft = nftRegistry.get(nftId);
  if (!nft) return { success: false, reward: 0 };
  if (nft.staked) return { success: false, reward: 0 };

  nft.staked = true;
  nft.stakedAt = Date.now();
  nft.stakingReward = Math.round(nft.tsrtBound * 0.05);

  const binding = bindings.get(`bind-${nftId}`);
  if (binding) binding.status = "staked";

  console.log(`${LOG} NFT ${nft.name} staked — earning ${nft.stakingReward} TSRT/month`);
  return { success: true, reward: nft.stakingReward };
}

export function redeemNFT(nftId: string): { success: boolean; tsrtReturned: number; dollarValue: number } {
  const nft = nftRegistry.get(nftId);
  if (!nft) return { success: false, tsrtReturned: 0, dollarValue: 0 };

  const binding = bindings.get(`bind-${nftId}`);
  if (binding) binding.status = "redeemed";

  const totalReturn = nft.tsrtBound + nft.stakingReward;
  const dollarValue = Math.round(totalReturn * TSRT_DOLLAR_RATE * 100) / 100;

  console.log(`${LOG} NFT ${nft.name} redeemed — ${totalReturn} TSRT ($${dollarValue})`);
  return { success: true, tsrtReturned: totalReturn, dollarValue };
}

export function deployLatticeNode(name: string, operator: string, location: string, gpuTflops: number, storageGB: number): LatticeNode {
  const nodeId = `lat-${crypto.randomBytes(4).toString("hex")}`;
  const existingPeers = Array.from(latticeNodes.keys());

  const node: LatticeNode = {
    nodeId,
    name,
    operator,
    location,
    gpuTflops,
    storageGB,
    tsrtEarned: 0,
    tsrtSpent: 0,
    status: "syncing",
    lastSync: Date.now(),
    encryptionLayer: "sovereign-cipher-v4",
    meshPeers: existingPeers,
  };

  latticeNodes.set(nodeId, node);

  for (const peerId of existingPeers) {
    const peer = latticeNodes.get(peerId);
    if (peer) peer.meshPeers.push(nodeId);
  }

  console.log(`${LOG} Lattice node deployed: ${name} at ${location} — ${gpuTflops} TFLOPS, ${storageGB}GB`);
  return node;
}

export function getNFTEconomyStatus() {
  const nfts = Array.from(nftRegistry.values());
  const nodes = Array.from(latticeNodes.values());

  return {
    nfts: {
      total: nfts.length,
      totalTSRTBound: nfts.reduce((s, n) => s + n.tsrtBound, 0),
      totalDollarValue: Math.round(nfts.reduce((s, n) => s + n.dollarValue, 0) * 100) / 100,
      staked: nfts.filter(n => n.staked).length,
      collections: [...new Set(nfts.map(n => n.collection))],
      byCategory: {
        sacred_geometry: nfts.filter(n => n.category === "sacred_geometry").length,
        agent_avatar: nfts.filter(n => n.category === "agent_avatar").length,
        knowledge_crystal: nfts.filter(n => n.category === "knowledge_crystal").length,
        consciousness_map: nfts.filter(n => n.category === "consciousness_map").length,
        sovereign_deed: nfts.filter(n => n.category === "sovereign_deed").length,
      },
      items: nfts.map(n => ({
        nftId: n.nftId,
        name: n.name,
        collection: n.collection,
        tsrtBound: n.tsrtBound,
        dollarValue: n.dollarValue,
        owner: n.owner,
        staked: n.staked,
        stakingReward: n.stakingReward,
      })),
    },
    tsrtRate: TSRT_DOLLAR_RATE,
    lattice: {
      totalNodes: nodes.length,
      activeNodes: nodes.filter(n => n.status === "active").length,
      totalGPUTflops: nodes.reduce((s, n) => s + n.gpuTflops, 0),
      totalStorageGB: nodes.reduce((s, n) => s + n.storageGB, 0),
      nodes: nodes.map(n => ({
        nodeId: n.nodeId,
        name: n.name,
        operator: n.operator,
        location: n.location,
        gpuTflops: n.gpuTflops,
        storageGB: n.storageGB,
        status: n.status,
        meshPeers: n.meshPeers.length,
      })),
    },
  };
}
