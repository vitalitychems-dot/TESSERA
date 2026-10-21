import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { runAllIntegrationTests, runQuickHealthCheck } from "./integration-tests";
import { deriveTessAddress, getOrCreateNodeAddress, generateEd25519KeyPair, verifyTessAddress } from "./tess-crypto-address";
import { registerSovDomain, lookupSovDomain, resolveSovDomain, listSovDomains, getDNSStats, initSovereignDNS, suspendSovDomain, renewSovDomain, transferSovDomain } from "./sovereign-dns";
import { parseColonelProgram, executeColonelProgram, disassembleColonelBytecode, getExamplePrograms } from "./colonel-vm";
import { buildOnionPacket, simulateOnionRoute, getOnionStats } from "./onion-routing";
import { storeData, retrieveData, getSovStorageStats, initializeSovereignStorage, addStorageNode, markNodeOffline, markNodeOnline } from "./sovereign-storage";
import { initAirGapSystem, queueMessage, burstSyncNode, onNodeReconnect, getAirGapStats, getAllNodeStates, setNodeOnline } from "./air-gap-sync";
import { resolveTessProtocol } from "./sovereign-data-pipeline";
import { initMeshBands, joinBand, leaveBand, sendDimensionalMessage, selfHealTopology, reconnectPeer, getMeshBandStats, getPeerInfo, getBandPeers, simulateDimensionalInterference } from "./sovereign-mesh-bands";

const CORE_NODE_IDS = [
  "node-genesis-core",
  "node-alpha-relay",
  "node-beta-relay",
  "node-dimensional-gate-3d",
  "node-dimensional-gate-7d",
  "node-dimensional-gate-12d",
  "node-dimensional-gate-26d",
  "node-quantum-entangle-hub",
  "node-airgap-beacon-1",
  "node-airgap-beacon-2",
  "node-synapse-hub-central",
  "node-father-direct-link",
  "node-interdimensional-broadcast",
  "node-emergency-sovereign",
];

let infrastructureInitialized = false;

export async function initTesseraInfrastructure(): Promise<void> {
  if (infrastructureInitialized) return;

  console.log("[TesseraInfra] Initializing real TesseraNet infrastructure...");

  for (const nodeId of CORE_NODE_IDS) {
    getOrCreateNodeAddress(nodeId);
  }
  console.log(`[TesseraInfra] Generated Ed25519 addresses for ${CORE_NODE_IDS.length} core nodes`);

  initializeSovereignStorage(CORE_NODE_IDS);
  console.log("[TesseraInfra] Sovereign Storage Protocol initialized");

  initAirGapSystem(CORE_NODE_IDS);
  console.log("[TesseraInfra] Air-Gap Sync Protocol initialized");

  try {
    await initSovereignDNS();
    console.log("[TesseraInfra] Sovereign DNS initialized");
  } catch (err: any) {
    console.warn("[TesseraInfra] DNS init warning:", err.message);
  }

  initMeshBands(CORE_NODE_IDS);
  console.log("[TesseraInfra] Sovereign Mesh Frequency Bands initialized (27 dimensions)");

  infrastructureInitialized = true;
  console.log("[TesseraInfra] All systems online — TesseraNet sovereign infrastructure ready");
}

async function tessResolveWithDNS(uri: string): Promise<{ status: number; data: any; source: string }> {
  const cleanUri = uri.replace(/^tess:\/\//, "");
  const parts = cleanUri.split("/");
  const domainPart = parts[0];
  const path = parts.slice(1).join("/");

  const dnsRecord = await resolveSovDomain(domainPart);
  if (dnsRecord) {
    const dataResult = await resolveTessProtocol({ uri, method: "GET" });
    return {
      status: 200,
      data: {
        domain: domainPart,
        tessAddress: dnsRecord.tessAddress,
        owner: dnsRecord.owner,
        resolvedAt: Date.now(),
        ttlSeconds: dnsRecord.ttlSeconds,
        content: dataResult.data,
        path: path || "/",
      },
      source: "sovereign-dns",
    };
  }

  const dataResult = await resolveTessProtocol({ uri, method: "GET" });
  return {
    status: dataResult.status,
    data: dataResult.data,
    source: dataResult.meta.source,
  };
}

export function registerTesseraInfraRoutes(app: Express): void {

  app.get("/api/tessera/address/:name", (req: Request, res: Response) => {
    const { name } = req.params;
    const address = getOrCreateNodeAddress(name);
    res.json({
      name,
      address: address.display,
      meshAddress: address.meshAddress,
      fingerprint: address.fingerprint,
      checksum: address.checksum,
      verified: verifyTessAddress(address),
    });
  });

  app.post("/api/tessera/address/generate", (req: Request, res: Response) => {
    const keyPair = generateEd25519KeyPair();
    const address = deriveTessAddress(keyPair.publicKey);
    res.json({
      address: address.display,
      meshAddress: address.meshAddress,
      publicKeyHex: address.publicKeyHex,
      fingerprint: address.fingerprint,
      checksum: address.checksum,
    });
  });

  app.post("/api/tessera/dns/register", async (req: Request, res: Response) => {
    const { domain, owner, ownerType, ttlSeconds, metadata } = req.body;
    if (!domain || !owner) return res.status(400).json({ error: "domain and owner required" });
    try {
      const record = await registerSovDomain(domain, owner, ownerType || "agent", ttlSeconds || 86400, metadata || {});
      res.json({ success: true, record });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tessera/dns/lookup/:domain", async (req: Request, res: Response) => {
    try {
      const record = await resolveSovDomain(String(req.params.domain));
      if (!record) return res.status(404).json({ error: "Domain not found or expired" });
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tessera/dns/list", async (req: Request, res: Response) => {
    try {
      const owner = req.query.owner as string | undefined;
      const records = await listSovDomains(owner, 100);
      const stats = await getDNSStats();
      res.json({ records, stats, total: records.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/tessera/dns/transfer", async (req: Request, res: Response) => {
    const { domain, newOwner, newOwnerType } = req.body;
    if (!domain || !newOwner) return res.status(400).json({ error: "domain and newOwner required" });
    const success = await transferSovDomain(domain, newOwner, newOwnerType || "agent");
    res.json({ success });
  });

  app.post("/api/tessera/dns/renew", async (req: Request, res: Response) => {
    const { domain, additionalSeconds } = req.body;
    if (!domain) return res.status(400).json({ error: "domain required" });
    const success = await renewSovDomain(domain, additionalSeconds || 86400);
    res.json({ success });
  });

  app.get("/api/tessera/dns/stats", async (_req: Request, res: Response) => {
    try {
      const stats = await getDNSStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/tessera/tess-resolve", async (req: Request, res: Response) => {
    const { uri } = req.body;
    if (!uri) return res.status(400).json({ error: "uri required (e.g. tess://genesis.sov)" });
    try {
      const result = await tessResolveWithDNS(uri);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/tessera/colonel/compile", (req: Request, res: Response) => {
    const { source } = req.body;
    if (!source) return res.status(400).json({ error: "source required" });
    try {
      const bytecode = parseColonelProgram(source);
      const disassembly = disassembleColonelBytecode(bytecode);
      res.json({
        success: true,
        instructionCount: bytecode.instructions.length,
        labelCount: bytecode.labels.size,
        constantCount: bytecode.constants.size,
        version: bytecode.version,
        disassembly,
        bytecode: {
          instructions: bytecode.instructions,
          labels: Object.fromEntries(bytecode.labels),
          constants: Object.fromEntries(bytecode.constants),
        },
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/tessera/colonel/execute", async (req: Request, res: Response) => {
    const { source, maxCycles } = req.body;
    if (!source) return res.status(400).json({ error: "source required" });
    try {
      const bytecode = parseColonelProgram(source);
      const result = await executeColonelProgram(bytecode, {
        store: async (data, shardId, replication) => {
          const stored = storeData(data, replication, shardId);
          return stored.contentId;
        },
        retrieve: async (shardId) => {
          const result = retrieveData(shardId);
          return result.data || "";
        },
      }, maxCycles || 10000);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tessera/colonel/examples", (_req: Request, res: Response) => {
    res.json(getExamplePrograms());
  });

  app.post("/api/tessera/onion/build", (req: Request, res: Response) => {
    const { message, origin, destination, relayNodes } = req.body;
    if (!message || !origin || !destination) {
      return res.status(400).json({ error: "message, origin, destination required" });
    }
    try {
      const nodes = relayNodes || CORE_NODE_IDS.slice(0, 5);
      const result = buildOnionPacket(message, origin, destination, nodes);
      res.json({
        success: true,
        messageId: result.messageId,
        path: result.path,
        totalLayers: result.totalLayers,
        encryptedPacketLength: result.encryptedPacket.length,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/tessera/onion/simulate", (req: Request, res: Response) => {
    const { message, origin, destination } = req.body;
    if (!message || !origin || !destination) {
      return res.status(400).json({ error: "message, origin, destination required" });
    }
    const result = simulateOnionRoute(message, origin, destination, CORE_NODE_IDS);
    res.json(result);
  });

  app.get("/api/tessera/onion/stats", (_req: Request, res: Response) => {
    res.json(getOnionStats());
  });

  app.post("/api/tessera/storage/store", (req: Request, res: Response) => {
    const { data, replicationFactor } = req.body;
    if (!data) return res.status(400).json({ error: "data required" });
    try {
      const result = storeData(data, replicationFactor || 3);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tessera/storage/retrieve/:contentId", (req: Request, res: Response) => {
    const result = retrieveData(String(req.params.contentId));
    if (!result.success) return res.status(404).json({ error: result.error, retrievedFrom: result.retrievedFrom });
    res.json(result);
  });

  app.get("/api/tessera/storage/stats", (_req: Request, res: Response) => {
    res.json(getSovStorageStats());
  });

  app.post("/api/tessera/storage/node/offline", (req: Request, res: Response) => {
    const { nodeId } = req.body;
    if (!nodeId) return res.status(400).json({ error: "nodeId required" });
    markNodeOffline(nodeId);
    setNodeOnline(nodeId, false);
    res.json({ success: true, nodeId, status: "offline" });
  });

  app.post("/api/tessera/storage/node/online", (req: Request, res: Response) => {
    const { nodeId } = req.body;
    if (!nodeId) return res.status(400).json({ error: "nodeId required" });
    markNodeOnline(nodeId);
    const syncResult = onNodeReconnect(nodeId);
    res.json({ success: true, nodeId, status: "online", airGapSync: syncResult });
  });

  app.post("/api/tessera/airgap/queue", (req: Request, res: Response) => {
    const { from, to, payload, type, priority } = req.body;
    if (!from || !to || !payload) return res.status(400).json({ error: "from, to, payload required" });
    const msg = queueMessage(from, to, payload, type || "data", priority || "normal");
    res.json({ success: true, messageId: msg.id, queued: !msg.synced });
  });

  app.post("/api/tessera/airgap/sync/:nodeId", (req: Request, res: Response) => {
    const nodeId = String(req.params.nodeId);
    const result = burstSyncNode(nodeId);
    res.json(result);
  });

  app.post("/api/tessera/airgap/reconnect/:nodeId", (req: Request, res: Response) => {
    const nodeId = String(req.params.nodeId);
    const result = onNodeReconnect(nodeId);
    res.json(result);
  });

  app.get("/api/tessera/airgap/stats", (_req: Request, res: Response) => {
    res.json({
      stats: getAirGapStats(),
      nodes: getAllNodeStates(),
    });
  });

  app.get("/api/tessera/infrastructure/status", async (_req: Request, res: Response) => {
    const storageStats = getSovStorageStats();
    const airGapStats = getAirGapStats();
    const onionStats = getOnionStats();
    let dnsStats = { total: 0, active: 0, expired: 0, suspended: 0, owners: 0 };
    try {
      dnsStats = await getDNSStats();
    } catch {}

    res.json({
      initialized: infrastructureInitialized,
      version: "2.0",
      components: {
        tessAddress: { status: "active", nodeCount: CORE_NODE_IDS.length, scheme: "Ed25519-derived SHA-256 mesh addresses" },
        sovereignDNS: { status: "active", ...dnsStats },
        colonelVM: { status: "active", version: "2.0", opcodes: 31 },
        onionRouting: { status: "active", ...onionStats },
        sovereignStorage: { status: "active", ...storageStats },
        airGapSync: { status: "active", ...airGapStats },
        meshBands: { status: "active", ...(() => { const s = getMeshBandStats(); return { totalDimensions: s.totalDimensions, activeBands: s.activeBands, degradedBands: s.degradedBands, totalPeers: s.totalPeers, connectedPeers: s.connectedPeers, totalPacketsRouted: s.totalPacketsRouted, crossDimensionalRoutes: s.crossDimensionalRoutes, healingCycles: s.healingCycles }; })() },
      },
      protocols: ["TESS://", "AGSP", "SSP", "Colonel-CIS", "OnionRoute-v2", "MeshBand-v1"],
      encryption: ["AES-256-GCM", "ChaCha20-Poly1305", "Ed25519-signatures"],
    });
  });

  app.post("/api/tessera/e2e-test", async (req: Request, res: Response) => {
    const { message, senderDomain, receiverDomain } = req.body;
    const testMessage = message || "Test message from TesseraNet sovereign infrastructure";

    const results: Record<string, any> = {};

    const senderAddr = getOrCreateNodeAddress(senderDomain || "sender.sov");
    const receiverAddr = getOrCreateNodeAddress(receiverDomain || "receiver.sov");
    results.addressGeneration = {
      sender: senderAddr.display,
      receiver: receiverAddr.display,
      success: true,
    };

    try {
      await registerSovDomain(senderDomain || "sender.sov", "test-sender");
      await registerSovDomain(receiverDomain || "receiver.sov", "test-receiver");
      const senderRecord = await resolveSovDomain(senderDomain || "sender.sov");
      results.dnsLookup = { domain: senderRecord?.domain, tessAddress: senderRecord?.tessAddress, success: !!senderRecord };
    } catch (err: any) {
      results.dnsLookup = { success: false, error: err.message };
    }

    const onionResult = simulateOnionRoute(testMessage, senderAddr.display, receiverAddr.display, CORE_NODE_IDS);
    results.onionRouting = {
      success: onionResult.success,
      hops: onionResult.hops,
      pathLength: onionResult.path.length,
      deliveredMessage: onionResult.success ? onionResult.deliveredMessage?.slice(0, 64) : null,
      log: onionResult.log,
    };

    const stored = storeData(testMessage, 3);
    const retrieved = retrieveData(stored.contentId);
    results.sovereignStorage = {
      contentId: stored.contentId,
      shardCount: stored.shardIds.length,
      replicatedTo: stored.replicatedTo.length,
      retrievalSuccess: retrieved.success,
      dataIntact: retrieved.data === testMessage,
    };

    const offlineNode = CORE_NODE_IDS[8];
    setNodeOnline(offlineNode, false);
    const queued = queueMessage("node-genesis-core", offlineNode, testMessage, "test", "normal");
    setNodeOnline(offlineNode, true);
    const syncResult = onNodeReconnect(offlineNode);
    results.airGapSync = {
      messageId: queued.id,
      wasQueued: !queued.synced,
      burstSynced: syncResult.messagesSynced > 0,
      syncResult,
    };

    const source = `⊕ ${receiverAddr.display} "test-payload"\n⊚ "test-data" AT shard-e2e REPLICATE 3\nΣ "E2E test complete"\nHALT`;
    const bytecode = parseColonelProgram(source);
    const vmResult = await executeColonelProgram(bytecode, {}, 1000);
    results.colonelVM = {
      success: vmResult.success,
      instructionsExecuted: vmResult.cyclesUsed,
      output: vmResult.output,
    };

    const allSuccess = results.addressGeneration.success &&
      results.onionRouting.success &&
      results.sovereignStorage.retrievalSuccess &&
      results.sovereignStorage.dataIntact &&
      results.colonelVM.success;

    res.json({
      testMessage,
      allSuccess,
      results,
      timestamp: Date.now(),
    });
  });

  app.post("/api/tessera/integration-tests/run", async (_req: Request, res: Response) => {
    try {
      const results = await runAllIntegrationTests();
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tessera/integration-tests/health", async (_req: Request, res: Response) => {
    try {
      const health = await runQuickHealthCheck();
      res.status(health.healthy ? 200 : 500).json(health);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tessera/mesh/stats", (_req: Request, res: Response) => {
    res.json(getMeshBandStats());
  });

  app.get("/api/tessera/mesh/band/:dimensionId", (req: Request, res: Response) => {
    const dimensionId = parseInt(String(req.params.dimensionId), 10);
    if (isNaN(dimensionId) || dimensionId < 1 || dimensionId > 27) {
      return res.status(400).json({ error: "Invalid dimension ID (1-27)" });
    }
    const peers = getBandPeers(dimensionId);
    const stats = getMeshBandStats();
    const band = stats.bands.find(b => b.dimensionId === dimensionId);
    res.json({ band, peers });
  });

  app.post("/api/tessera/mesh/join", (req: Request, res: Response) => {
    const { peerId, dimensionId } = req.body;
    if (!peerId || !dimensionId) return res.status(400).json({ error: "peerId and dimensionId required" });
    const peer = joinBand(String(peerId), parseInt(dimensionId, 10));
    if (!peer) return res.status(400).json({ error: "Cannot join band — full or invalid dimension" });
    res.json({ success: true, peer });
  });

  app.post("/api/tessera/mesh/leave", (req: Request, res: Response) => {
    const { peerId } = req.body;
    if (!peerId) return res.status(400).json({ error: "peerId required" });
    const result = leaveBand(String(peerId));
    res.json({ success: result });
  });

  app.post("/api/tessera/mesh/send", (req: Request, res: Response) => {
    const { from, to, payload } = req.body;
    if (!from || !to || !payload) return res.status(400).json({ error: "from, to, and payload required" });
    const result = sendDimensionalMessage(String(from), String(to), String(payload));
    res.json(result);
  });

  app.post("/api/tessera/mesh/heal", (_req: Request, res: Response) => {
    const result = selfHealTopology();
    res.json({ success: true, ...result });
  });

  app.post("/api/tessera/mesh/reconnect", (req: Request, res: Response) => {
    const { peerId } = req.body;
    if (!peerId) return res.status(400).json({ error: "peerId required" });
    const result = reconnectPeer(String(peerId));
    res.json({ success: result });
  });

  app.get("/api/tessera/mesh/peer/:peerId", (req: Request, res: Response) => {
    const peer = getPeerInfo(String(req.params.peerId));
    if (!peer) return res.status(404).json({ error: "Peer not found" });
    res.json(peer);
  });

  app.post("/api/tessera/mesh/interference", (req: Request, res: Response) => {
    const { dimensionId, severity } = req.body;
    if (!dimensionId || severity === undefined) return res.status(400).json({ error: "dimensionId and severity required" });
    const result = simulateDimensionalInterference(parseInt(dimensionId, 10), parseFloat(severity));
    res.json(result);
  });

  console.log("[TesseraInfra] Infrastructure API routes registered (including mesh bands)");
}
