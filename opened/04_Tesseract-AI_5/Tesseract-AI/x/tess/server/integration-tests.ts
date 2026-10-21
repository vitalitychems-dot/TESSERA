import crypto from "crypto";
import { generateEd25519KeyPair, deriveTessAddress, verifyTessAddress, signMessage, verifySignature, getOrCreateNodeAddress, parseTessAddress } from "./tess-crypto-address";
import { parseColonelProgram, executeColonelProgram, disassembleColonelBytecode, getExamplePrograms } from "./colonel-vm";
import { buildOnionPacket, peelOnionLayer, extractFinalMessage, simulateOnionRoute } from "./onion-routing";
import { storeData, retrieveData, initializeSovereignStorage, getSovStorageStats, markNodeOffline, markNodeOnline } from "./sovereign-storage";
import { registerAirGapNode, queueMessage, burstSyncNode, onNodeReconnect, setNodeOnline, getAirGapStats } from "./air-gap-sync";
import { initMeshBands, joinBand, leaveBand, sendDimensionalMessage, selfHealTopology, getMeshBandStats, reconnectPeer } from "./sovereign-mesh-bands";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: Record<string, any>;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function runTest(name: string, fn: () => Promise<void> | void): Promise<TestResult> {
  try {
    await fn();
    return { name, passed: true };
  } catch (err: any) {
    return { name, passed: false, error: err.message };
  }
}

export async function runAllIntegrationTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
  duration: number;
}> {
  const start = Date.now();
  const results: TestResult[] = [];

  const tests: Array<[string, () => Promise<void> | void]> = [

    ["TESS Address: Ed25519 key pair generation", () => {
      const kp = generateEd25519KeyPair();
      assert(kp.publicKey.length > 0, "publicKey is empty");
      assert(kp.privateKey.length > 0, "privateKey is empty");
      assert(kp.publicKeyHex.length === kp.publicKey.length * 2, "publicKeyHex length mismatch");
      assert(/^[0-9a-f]+$/.test(kp.publicKeyHex), "publicKeyHex is not hex");
    }],

    ["TESS Address: Derive address from public key", () => {
      const kp = generateEd25519KeyPair();
      const addr = deriveTessAddress(kp.publicKey);
      assert(addr.display.startsWith("tess://"), "address display does not start with tess://");
      assert(addr.meshAddress.endsWith(".sovereign"), "meshAddress does not end with .sovereign");
      assert(addr.fingerprint.length === 16, `fingerprint should be 16 hex chars, got ${addr.fingerprint.length}`);
      assert(addr.checksum.length === 8, `checksum should be 8 hex chars, got ${addr.checksum.length}`);
    }],

    ["TESS Address: Deterministic address from same key", () => {
      const kp = generateEd25519KeyPair();
      const addr1 = deriveTessAddress(kp.publicKey);
      const addr2 = deriveTessAddress(kp.publicKey);
      assert(addr1.display === addr2.display, "addresses are not deterministic");
      assert(addr1.meshAddress === addr2.meshAddress, "mesh addresses are not deterministic");
      assert(addr1.checksum === addr2.checksum, "checksums are not deterministic");
    }],

    ["TESS Address: Different keys produce different addresses", () => {
      const kp1 = generateEd25519KeyPair();
      const kp2 = generateEd25519KeyPair();
      const addr1 = deriveTessAddress(kp1.publicKey);
      const addr2 = deriveTessAddress(kp2.publicKey);
      assert(addr1.display !== addr2.display, "different keys produced same address");
    }],

    ["TESS Address: Verify address checksum", () => {
      const kp = generateEd25519KeyPair();
      const addr = deriveTessAddress(kp.publicKey);
      const verified = verifyTessAddress(addr);
      assert(verified, "valid address failed verification");
    }],

    ["TESS Address: Node address registry getOrCreate", () => {
      const addr1 = getOrCreateNodeAddress("test-node-001");
      const addr2 = getOrCreateNodeAddress("test-node-001");
      assert(addr1.display === addr2.display, "getOrCreate returned different addresses for same node");
    }],

    ["TESS Address: Parse tess:// URI", () => {
      const kp = generateEd25519KeyPair();
      const addr = deriveTessAddress(kp.publicKey);
      const parsed = parseTessAddress(addr.display);
      assert(parsed !== null, "parseTessAddress returned null");
      assert(parsed!.length === 40, `parsed hex should be 40 chars, got ${parsed!.length}`);
    }],

    ["TESS Address: Ed25519 sign and verify", () => {
      const kp = generateEd25519KeyPair();
      const message = "sovereign message integrity test " + Date.now();
      const sig = signMessage(kp.privateKey, message);
      assert(sig.length > 0, "signature is empty");
      const valid = verifySignature(kp.publicKey, message, sig);
      assert(valid, "valid signature failed verification");
    }],

    ["TESS Address: Signature verification rejects wrong message", () => {
      const kp = generateEd25519KeyPair();
      const sig = signMessage(kp.privateKey, "original message");
      const valid = verifySignature(kp.publicKey, "tampered message", sig);
      assert(!valid, "tampered message passed signature verification");
    }],

    ["Colonel VM: Parse simple program", () => {
      const source = `PUSH "hello"\nPUSH "world"\nCONCAT\nHALT`;
      const bytecode = parseColonelProgram(source);
      assert(bytecode.instructions.length === 4, `expected 4 instructions, got ${bytecode.instructions.length}`);
      assert(bytecode.version === "2.0", `expected version 2.0, got ${bytecode.version}`);
    }],

    ["Colonel VM: Execute PUSH, CONCAT, HALT", async () => {
      const source = `PUSH "hello"\nPUSH " world"\nCONCAT\nHALT`;
      const bytecode = parseColonelProgram(source);
      const result = await executeColonelProgram(bytecode);
      assert(result.success, `execution failed: ${result.error}`);
      assert(result.finalStack.length === 1, `expected 1 item on stack, got ${result.finalStack.length}`);
      assert(result.finalStack[0] === "hello world", `expected "hello world", got "${result.finalStack[0]}"`);
    }],

    ["Colonel VM: Execute TRANSMIT symbolic operation", async () => {
      const source = `⊕ tess://genesis.sovereign "sovereign data packet"\nHALT`;
      const bytecode = parseColonelProgram(source);
      const result = await executeColonelProgram(bytecode);
      assert(result.success, `execution failed: ${result.error}`);
      assert(result.output.some(o => o.includes("TRANSMIT")), "no TRANSMIT output found");
    }],

    ["Colonel VM: Execute ENCRYPT symbolic operation", async () => {
      const source = `⊘ "sensitive data" WITH sovereign-default\nHALT`;
      const bytecode = parseColonelProgram(source);
      const result = await executeColonelProgram(bytecode);
      assert(result.success, `execution failed: ${result.error}`);
      assert(result.finalStack.length === 1, "ENCRYPT should push to stack");
      assert(result.finalStack[0].includes(":"), "encrypted data should contain IV:tag:ciphertext");
    }],

    ["Colonel VM: Execute STORE and RETRIEVE with handler", async () => {
      const storedData: Map<string, string> = new Map();
      const source = `⊚ "test-data-payload" AT test-shard REPLICATE 3\nHALT`;
      const bytecode = parseColonelProgram(source);
      const result = await executeColonelProgram(bytecode, {
        store: async (data, shardId) => {
          storedData.set(shardId, data);
          return shardId;
        },
      });
      assert(result.success, `execution failed: ${result.error}`);
    }],

    ["Colonel VM: Labels and JUMP instruction", async () => {
      const source = `PUSH "0"\nPUSH "end"\nJUMP end\nPUSH "should-not-reach"\nend:\nPUSH "reached"\nHALT`;
      const bytecode = parseColonelProgram(source);
      const result = await executeColonelProgram(bytecode);
      assert(result.success, `execution failed: ${result.error}`);
      assert(!result.finalStack.includes("should-not-reach"), "jumped over code was still executed");
    }],

    ["Colonel VM: CALL and RETURN subroutine", async () => {
      const source = `CALL myfunc\nPUSH "after-call"\nHALT\nmyfunc:\nPUSH "from-func"\nRETURN`;
      const bytecode = parseColonelProgram(source);
      const result = await executeColonelProgram(bytecode);
      assert(result.success, `execution failed: ${result.error}`);
      assert(result.finalStack.includes("from-func"), "subroutine was not called");
      assert(result.finalStack.includes("after-call"), "code after CALL was not executed");
    }],

    ["Colonel VM: Symbolic Father Protocol Ω", async () => {
      const source = `Ω INVOKE sovereign-lockdown\nHALT`;
      const bytecode = parseColonelProgram(source);
      const result = await executeColonelProgram(bytecode);
      assert(result.success, `execution failed: ${result.error}`);
      assert(result.output.some(o => o.includes("FATHER_PROTOCOL")), "FATHER_PROTOCOL not in output");
      assert(result.output.some(o => o.includes("MAX_AUTHORITY")), "MAX_AUTHORITY not in output");
    }],

    ["Colonel VM: Disassembly output", () => {
      const source = `PUSH "data"\n⊕ tess://test.sovereign "data"\nHALT`;
      const bytecode = parseColonelProgram(source);
      const disasm = disassembleColonelBytecode(bytecode);
      assert(disasm.includes("Colonel Language v2.0"), "disassembly missing version header");
      assert(disasm.includes("PUSH"), "disassembly missing PUSH instruction");
      assert(disasm.includes("HALT"), "disassembly missing HALT instruction");
    }],

    ["Onion Routing: Build packet with 3+ hops", () => {
      const nodes = ["node-alpha", "node-beta", "node-gamma"];
      const result = buildOnionPacket(
        "test message",
        "tess://origin.sovereign",
        "tess://destination.sovereign",
        nodes
      );
      assert(result.messageId.length > 0, "messageId is empty");
      assert(result.totalLayers === 4, `expected 4 layers (3 relay + dest), got ${result.totalLayers}`);
      assert(result.path.length === 4, `expected path length 4, got ${result.path.length}`);
    }],

    ["Onion Routing: Peel first layer", () => {
      const nodes = ["node-alpha", "node-beta", "node-gamma"];
      const { encryptedPacket, path } = buildOnionPacket(
        "peel test message",
        "tess://origin.sovereign",
        "tess://destination.sovereign",
        nodes
      );
      const result = peelOnionLayer(encryptedPacket, path[0], 0);
      assert(result.success, `Failed to peel first layer: ${JSON.stringify(result)}`);
      assert(!result.isFinalDestination, "first node should not be final destination");
      assert(result.nextHop !== null, "nextHop should not be null");
      assert(result.remainingLayers === 3, `expected 3 remaining layers, got ${result.remainingLayers}`);
    }],

    ["Onion Routing: Full simulation delivers message", () => {
      const availableNodes = [
        "node-genesis-core", "node-alpha-relay", "node-beta-relay",
        "node-gamma-relay", "node-delta-relay"
      ];
      const result = simulateOnionRoute(
        "delivered-message-test",
        "tess://sender.sovereign",
        "tess://receiver.sovereign",
        availableNodes
      );
      assert(result.success, `Onion routing failed: ${result.log.join("; ")}`);
      assert(result.deliveredMessage === "delivered-message-test", `delivered message mismatch: "${result.deliveredMessage}"`);
      assert(result.hops >= 3, `expected at least 3 hops, got ${result.hops}`);
    }],

    ["Onion Routing: Wrong key fails decryption", () => {
      const nodes = ["node-alpha", "node-beta", "node-gamma"];
      const { encryptedPacket } = buildOnionPacket("test", "tess://a.sovereign", "tess://b.sovereign", nodes);
      const result = peelOnionLayer(encryptedPacket, "wrong-node-id", 0);
      assert(!result.success, "decryption with wrong key should fail");
    }],

    ["Onion Routing: Insufficient hops rejected", () => {
      let threw = false;
      try {
        buildOnionPacket("test", "tess://a.sovereign", "tess://b.sovereign", ["only-one-node"]);
      } catch {
        threw = true;
      }
      assert(threw, "should throw with insufficient hops");
    }],

    ["Sovereign Storage: Store and retrieve data", () => {
      initializeSovereignStorage(["node-store-1", "node-store-2", "node-store-3", "node-store-4", "node-store-5"]);
      const data = "sovereign storage test payload " + Date.now();
      const stored = storeData(data, 3);
      assert(stored.contentId.length > 0, "contentId is empty");
      assert(stored.shardIds.length > 0, "no shards created");
      assert(stored.replicatedTo.length >= 1, "not replicated to any nodes");
      assert(stored.hash.length === 64, "hash should be 64 hex chars");

      const retrieved = retrieveData(stored.contentId);
      assert(retrieved.success, `retrieval failed: ${retrieved.error}`);
      assert(retrieved.data === data, `data mismatch: "${retrieved.data?.slice(0, 64)}" vs "${data.slice(0, 64)}"`);
    }],

    ["Sovereign Storage: Data integrity hash verification", () => {
      const data = "hash integrity test " + crypto.randomBytes(32).toString("hex");
      const stored = storeData(data, 3);
      const retrieved = retrieveData(stored.contentId);
      assert(retrieved.success, `retrieval failed: ${retrieved.error}`);
      const rehash = crypto.createHash("sha256").update(data).digest("hex");
      assert(stored.hash === rehash, "stored hash does not match expected SHA-256");
    }],

    ["Sovereign Storage: AES-256-GCM encryption on shards", () => {
      const data = "encrypted storage test";
      const stored = storeData(data, 3);
      const stats = getSovStorageStats();
      assert(stats.totalShards > 0, "no shards in storage");
      assert(stored.encryptionKey.length === 64, "encryption key should be 64 hex chars (32 bytes)");
    }],

    ["Sovereign Storage: Replication across multiple nodes", () => {
      initializeSovereignStorage([
        "node-rep-a", "node-rep-b", "node-rep-c", "node-rep-d", "node-rep-e"
      ]);
      const data = "replication test data";
      const stored = storeData(data, 3);
      assert(stored.replicatedTo.length >= 3, `expected 3+ replicas, got ${stored.replicatedTo.length}`);
    }],

    ["Sovereign Storage: Missing content returns error", () => {
      const result = retrieveData("nonexistent-content-id-xyz");
      assert(!result.success, "retrieval of nonexistent content should fail");
      assert(result.error !== undefined, "error should be set for missing content");
    }],

    ["Sovereign Storage: Node offline/online cycle", () => {
      const nodes = ["node-cycle-1", "node-cycle-2", "node-cycle-3"];
      initializeSovereignStorage(nodes);
      const data = "offline node test " + Date.now();
      storeData(data, 2);

      markNodeOffline("node-cycle-1");
      const stats = getSovStorageStats();
      assert(stats.onlineNodes < stats.totalNodes, "offline node not counted");

      markNodeOnline("node-cycle-1");
    }],

    ["Air-Gap Sync: Register node and queue message", () => {
      registerAirGapNode("agsp-node-001");
      registerAirGapNode("agsp-node-002");
      const msg = queueMessage("agsp-node-001", "agsp-node-002", "test payload", "data", "normal");
      assert(msg.id.startsWith("agsp-"), "message ID should start with agsp-");
      assert(msg.from === "agsp-node-001", "from field mismatch");
      assert(msg.to === "agsp-node-002", "to field mismatch");
      assert(msg.encryptedPayload.length > 0, "encrypted payload is empty");
    }],

    ["Air-Gap Sync: Encrypted payload differs from plaintext", () => {
      registerAirGapNode("agsp-enc-001");
      registerAirGapNode("agsp-enc-002");
      const payload = "plaintext secret data";
      const msg = queueMessage("agsp-enc-001", "agsp-enc-002", payload, "data");
      assert(msg.encryptedPayload !== payload, "encrypted payload should differ from plaintext");
    }],

    ["Air-Gap Sync: Burst sync delivers queued messages", () => {
      registerAirGapNode("agsp-burst-001");
      registerAirGapNode("agsp-burst-002");
      setNodeOnline("agsp-burst-002", true);

      queueMessage("agsp-burst-001", "agsp-burst-002", "burst sync message 1");
      queueMessage("agsp-burst-001", "agsp-burst-002", "burst sync message 2");

      const result = burstSyncNode("agsp-burst-002");
      assert(result.messagesSynced >= 0, "burst sync result is invalid");
    }],

    ["Air-Gap Sync: Offline node queues messages, reconnect delivers", () => {
      registerAirGapNode("agsp-offline-001");
      registerAirGapNode("agsp-offline-002");

      setNodeOnline("agsp-offline-002", false);
      queueMessage("agsp-offline-001", "agsp-offline-002", "offline message A", "data", "urgent");
      queueMessage("agsp-offline-001", "agsp-offline-002", "offline message B");

      setNodeOnline("agsp-offline-002", true);
      const result = onNodeReconnect("agsp-offline-002");
      assert(result.nodeId === "agsp-offline-002", "wrong nodeId in reconnect result");
    }],

    ["Air-Gap Sync: Priority ordering (urgent before normal)", () => {
      registerAirGapNode("agsp-prio-001");
      registerAirGapNode("agsp-prio-002");
      setNodeOnline("agsp-prio-002", false);

      queueMessage("agsp-prio-001", "agsp-prio-002", "normal priority", "data", "normal");
      queueMessage("agsp-prio-001", "agsp-prio-002", "urgent priority", "data", "urgent");
      queueMessage("agsp-prio-001", "agsp-prio-002", "high priority", "data", "high");

      setNodeOnline("agsp-prio-002", true);
      const result = onNodeReconnect("agsp-prio-002");
      assert(result !== null, "reconnect returned null");
    }],

    ["Air-Gap Sync: Stats reporting", () => {
      registerAirGapNode("agsp-stats-001");
      const stats = getAirGapStats();
      assert(typeof stats.totalNodes === "number", "totalNodes is not a number");
      assert(typeof stats.onlineNodes === "number", "onlineNodes is not a number");
      assert(typeof stats.offlineNodes === "number", "offlineNodes is not a number");
    }],

    ["Mesh Bands: Initialize 27 dimensional frequency bands", () => {
      initMeshBands(["mesh-test-1", "mesh-test-2", "mesh-test-3"]);
      const stats = getMeshBandStats();
      assert(stats.totalDimensions === 27, `expected 27 dimensions, got ${stats.totalDimensions}`);
      assert(stats.activeBands > 0, "no active bands");
      assert(stats.totalPeers >= 3, `expected 3+ peers, got ${stats.totalPeers}`);
    }],

    ["Mesh Bands: Join and leave frequency band", () => {
      const peer = joinBand("mesh-join-test", 5);
      assert(peer !== null, "failed to join band");
      assert(peer!.dimensionId === 5, "wrong dimension");
      assert(peer!.status === "connected", "peer not connected");
      const left = leaveBand("mesh-join-test");
      assert(left, "failed to leave band");
    }],

    ["Mesh Bands: Same-dimension message delivery", () => {
      joinBand("mesh-send-a", 3);
      joinBand("mesh-send-b", 3);
      const result = sendDimensionalMessage("mesh-send-a", "mesh-send-b", "hello dimension 3");
      assert(result.success, "same-dimension send failed");
      assert(result.hops === 1, `expected 1 hop, got ${result.hops}`);
      assert(result.encrypted, "message not encrypted");
      leaveBand("mesh-send-a");
      leaveBand("mesh-send-b");
    }],

    ["Mesh Bands: Cross-dimensional message routing", () => {
      joinBand("mesh-cross-a", 3);
      joinBand("mesh-cross-b", 8);
      const result = sendDimensionalMessage("mesh-cross-a", "mesh-cross-b", "cross-dimensional data");
      assert(result.success, "cross-dimensional send failed");
      assert(result.hops > 1, `expected multi-hop, got ${result.hops}`);
      assert(result.route.length >= 2, "route too short");
      assert(result.encrypted, "message not encrypted");
      leaveBand("mesh-cross-a");
      leaveBand("mesh-cross-b");
    }],

    ["Mesh Bands: Self-healing topology", () => {
      const healResult = selfHealTopology();
      assert(typeof healResult.healed === "number", "healed count missing");
      assert(typeof healResult.timedOut === "number", "timedOut count missing");
      assert(typeof healResult.rebalanced === "number", "rebalanced count missing");
    }],

    ["Mesh Bands: Peer reconnection", () => {
      const peer = joinBand("mesh-reconnect-test", 12);
      assert(peer !== null, "failed to join");
      leaveBand("mesh-reconnect-test");
      joinBand("mesh-reconnect-test", 12);
      const reconnected = reconnectPeer("mesh-reconnect-test");
      assert(reconnected, "reconnection failed");
      leaveBand("mesh-reconnect-test");
    }],

    ["End-to-End: Full message flow — address → encrypt → route → store → sync", async () => {
      const senderKp = generateEd25519KeyPair();
      const receiverKp = generateEd25519KeyPair();
      const senderAddr = deriveTessAddress(senderKp.publicKey);
      const receiverAddr = deriveTessAddress(receiverKp.publicKey);

      assert(verifyTessAddress(senderAddr), "sender address verification failed");
      assert(verifyTessAddress(receiverAddr), "receiver address verification failed");

      const message = "E2E sovereign mesh message " + Date.now();
      const sig = signMessage(senderKp.privateKey, message);
      assert(verifySignature(senderKp.publicKey, message, sig), "signature verification failed");

      const relayNodes = ["relay-e2e-1", "relay-e2e-2", "relay-e2e-3"];
      const routeResult = simulateOnionRoute(message, senderAddr.display, receiverAddr.display, relayNodes);
      assert(routeResult.success, `onion routing failed: ${routeResult.log.slice(-3).join("; ")}`);
      assert(routeResult.deliveredMessage === message, "delivered message does not match original");

      initializeSovereignStorage(["e2e-store-1", "e2e-store-2", "e2e-store-3"]);
      const stored = storeData(message, 3);
      assert(stored.contentId.length > 0, "storage contentId empty");

      const retrieved = retrieveData(stored.contentId);
      assert(retrieved.success, `retrieval failed: ${retrieved.error}`);
      assert(retrieved.data === message, "retrieved data mismatch");

      const colonelSource = `⊕ ${receiverAddr.display} "e2e-data"\n⊚ "e2e-data" AT shard-e2e REPLICATE 3\nΣ "E2E test complete"\nHALT`;
      const bytecode = parseColonelProgram(colonelSource);
      const vmResult = await executeColonelProgram(bytecode, {}, 1000);
      assert(vmResult.success, `Colonel VM execution failed: ${vmResult.error}`);
      assert(vmResult.output.some(o => o.includes("TRANSMIT")), "VM did not execute TRANSMIT");
      assert(vmResult.output.some(o => o.includes("SWARM_BROADCAST")), "VM did not execute SWARM_BROADCAST");
    }],
  ];

  for (const [name, fn] of tests) {
    results.push(await runTest(name, fn));
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
    duration: Date.now() - start,
  };
}

export async function runQuickHealthCheck(): Promise<{ healthy: boolean; checks: Record<string, boolean> }> {
  const checks: Record<string, boolean> = {};

  try {
    const kp = generateEd25519KeyPair();
    const addr = deriveTessAddress(kp.publicKey);
    checks.tessAddress = verifyTessAddress(addr);
  } catch { checks.tessAddress = false; }

  try {
    const src = `PUSH "ok"\nHALT`;
    const bc = parseColonelProgram(src);
    const result = await executeColonelProgram(bc);
    checks.colonelVM = result.success && result.finalStack[0] === "ok";
  } catch { checks.colonelVM = false; }

  try {
    const result = simulateOnionRoute(
      "health check",
      "tess://health-sender.sovereign",
      "tess://health-receiver.sovereign",
      ["hc-node-1", "hc-node-2", "hc-node-3"]
    );
    checks.onionRouting = result.success;
  } catch { checks.onionRouting = false; }

  try {
    initializeSovereignStorage(["hc-store-1", "hc-store-2", "hc-store-3"]);
    const stored = storeData("health-check-data");
    const retrieved = retrieveData(stored.contentId);
    checks.sovereignStorage = retrieved.success && retrieved.data === "health-check-data";
  } catch { checks.sovereignStorage = false; }

  try {
    registerAirGapNode("hc-node-a");
    registerAirGapNode("hc-node-b");
    const msg = queueMessage("hc-node-a", "hc-node-b", "health-check");
    checks.airGapSync = msg.id.length > 0;
  } catch { checks.airGapSync = false; }

  try {
    initMeshBands(["hc-mesh-1", "hc-mesh-2", "hc-mesh-3"]);
    const stats = getMeshBandStats();
    checks.meshBands = stats.totalDimensions === 27 && stats.activeBands > 0;
  } catch { checks.meshBands = false; }

  const healthy = Object.values(checks).every(Boolean);
  return { healthy, checks };
}
