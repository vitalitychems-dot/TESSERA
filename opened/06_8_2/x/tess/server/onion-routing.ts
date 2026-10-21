import crypto from "crypto";

const MIN_HOPS = 3;
const MAX_HOPS = 7;

export interface OnionLayer {
  encryptedPayload: string;
  nextHop: string;
  iv: string;
  authTag: string;
  layerIndex: number;
}

export interface OnionPacket {
  layers: OnionLayer[];
  originAddress: string;
  destinationAddress: string;
  messageId: string;
  timestamp: number;
  hopCount: number;
}

export interface RelayResult {
  success: boolean;
  nextHop: string | null;
  decryptedPayload: string | null;
  isFinalDestination: boolean;
  remainingLayers: number;
}

export interface OnionRouteInfo {
  path: string[];
  encryptedPacket: string;
  messageId: string;
  totalLayers: number;
}

function deriveLayerKey(nodeId: string, sessionSeed: string, layerIndex: number): Buffer {
  return crypto.createHmac("sha256", sessionSeed)
    .update(`${nodeId}:layer:${layerIndex}`)
    .digest();
}

function aesGcmEncrypt(plaintext: string, key: Buffer): { iv: string; ciphertext: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let enc = cipher.update(plaintext, "utf8", "hex");
  enc += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return { iv: iv.toString("hex"), ciphertext: enc, authTag };
}

function aesGcmDecrypt(ciphertext: string, key: Buffer, ivHex: string, authTagHex: string): string {
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let dec = decipher.update(ciphertext, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

export function buildOnionPacket(
  message: string,
  originAddress: string,
  destinationAddress: string,
  routePath: string[],
  sessionSeed?: string
): OnionRouteInfo {
  if (routePath.length < MIN_HOPS) {
    throw new Error(`Onion routing requires at least ${MIN_HOPS} hops, got ${routePath.length}`);
  }

  const seed = sessionSeed || crypto.randomBytes(32).toString("hex");
  const messageId = crypto.randomBytes(16).toString("hex");
  const fullPath = [...routePath, destinationAddress];

  let current = JSON.stringify({
    type: "payload",
    message,
    destination: destinationAddress,
    messageId,
    timestamp: Date.now(),
  });

  const packetLayers: Array<{ node: string; iv: string; ciphertext: string; authTag: string }> = [];

  for (let i = fullPath.length - 1; i >= 0; i--) {
    const nodeId = fullPath[i];
    const key = deriveLayerKey(nodeId, seed, i);
    const nextHop = i < fullPath.length - 1 ? fullPath[i + 1] : "FINAL";

    const wrappedPayload = JSON.stringify({
      nextHop,
      layerIndex: i,
      innerPayload: current,
      nodeHint: nodeId,
    });

    const { iv, ciphertext, authTag } = aesGcmEncrypt(wrappedPayload, key);
    packetLayers.unshift({ node: nodeId, iv, ciphertext, authTag });
    current = JSON.stringify({ encrypted: ciphertext, iv, authTag, layerIndex: i });
  }

  const packet: OnionPacket = {
    layers: packetLayers.map((l, i) => ({
      encryptedPayload: l.ciphertext,
      nextHop: fullPath[i + 1] || "FINAL",
      iv: l.iv,
      authTag: l.authTag,
      layerIndex: i,
    })),
    originAddress,
    destinationAddress,
    messageId,
    timestamp: Date.now(),
    hopCount: fullPath.length,
  };

  return {
    path: fullPath,
    encryptedPacket: JSON.stringify({ packet, seed }),
    messageId,
    totalLayers: fullPath.length,
  };
}

export function peelOnionLayer(
  encryptedPacketJson: string,
  currentNodeId: string,
  currentLayerIndex: number
): RelayResult {
  try {
    const { packet, seed, layerOffset } = JSON.parse(encryptedPacketJson) as { packet: OnionPacket; seed: string; layerOffset?: number };
    const absoluteLayerIndex = (layerOffset || 0) + currentLayerIndex;

    if (currentLayerIndex >= packet.layers.length) {
      return { success: false, nextHop: null, decryptedPayload: null, isFinalDestination: false, remainingLayers: 0 };
    }

    const layer = packet.layers[currentLayerIndex];
    const key = deriveLayerKey(currentNodeId, seed, absoluteLayerIndex);

    let decrypted: string;
    try {
      decrypted = aesGcmDecrypt(layer.encryptedPayload, key, layer.iv, layer.authTag);
    } catch {
      return { success: false, nextHop: null, decryptedPayload: null, isFinalDestination: false, remainingLayers: 0 };
    }

    const parsed = JSON.parse(decrypted) as {
      nextHop: string;
      layerIndex: number;
      innerPayload: string;
      nodeHint: string;
    };

    const isFinalDestination = parsed.nextHop === "FINAL" || currentLayerIndex === packet.layers.length - 1;
    const remainingLayers = packet.layers.length - currentLayerIndex - 1;

    const forwardPacket = isFinalDestination ? encryptedPacketJson : JSON.stringify({
      packet: { ...packet, layers: packet.layers.slice(currentLayerIndex + 1) },
      seed,
      layerOffset: absoluteLayerIndex + 1,
    });

    return {
      success: true,
      nextHop: isFinalDestination ? null : parsed.nextHop,
      decryptedPayload: isFinalDestination ? parsed.innerPayload : forwardPacket,
      isFinalDestination,
      remainingLayers,
    };
  } catch (err: any) {
    return { success: false, nextHop: null, decryptedPayload: null, isFinalDestination: false, remainingLayers: 0 };
  }
}

export function extractFinalMessage(innerPayloadJson: string): { message: string; messageId: string; timestamp: number } | null {
  try {
    const parsed = JSON.parse(innerPayloadJson);
    if (parsed.type === "payload") {
      return { message: parsed.message, messageId: parsed.messageId, timestamp: parsed.timestamp };
    }
    return null;
  } catch {
    return null;
  }
}

export function simulateOnionRoute(
  message: string,
  originAddress: string,
  destinationAddress: string,
  availableNodes: string[]
): { success: boolean; deliveredMessage: string | null; hops: number; path: string[]; log: string[] } {
  const log: string[] = [];

  if (availableNodes.length < MIN_HOPS) {
    return { success: false, deliveredMessage: null, hops: 0, path: [], log: ["Insufficient nodes for onion routing"] };
  }

  const shuffled = [...availableNodes].sort(() => Math.random() - 0.5);
  const relayPath = shuffled.slice(0, Math.min(MAX_HOPS - 1, shuffled.length));

  log.push(`Building onion packet with ${relayPath.length} relay hops + destination`);

  const { encryptedPacket, messageId, path } = buildOnionPacket(
    message, originAddress, destinationAddress, relayPath
  );

  log.push(`Onion packet built: ${messageId} (${path.length} layers)`);

  let currentPacket = encryptedPacket;
  let deliveredMessage: string | null = null;

  for (let i = 0; i < path.length; i++) {
    const nodeId = path[i];
    log.push(`Hop ${i + 1}: relay node ${nodeId} peeling layer 0`);

    const result = peelOnionLayer(currentPacket, nodeId, 0);

    if (!result.success) {
      log.push(`Hop ${i + 1}: FAILED to peel layer at ${nodeId}`);
      return { success: false, deliveredMessage: null, hops: i + 1, path, log };
    }

    if (result.isFinalDestination) {
      const finalMsg = result.decryptedPayload ? extractFinalMessage(result.decryptedPayload) : null;
      deliveredMessage = finalMsg?.message || null;
      log.push(`Hop ${i + 1}: DELIVERED to destination ${nodeId}`);
      log.push(`Message: ${deliveredMessage?.slice(0, 64)}...`);
      return { success: true, deliveredMessage, hops: i + 1, path, log };
    }

    if (result.decryptedPayload) {
      currentPacket = result.decryptedPayload;
    }
    log.push(`Hop ${i + 1}: forwarding to ${result.nextHop} (${result.remainingLayers} layers remain)`);
  }

  return { success: false, deliveredMessage: null, hops: path.length, path, log };
}

export function getOnionStats(): { minHops: number; maxHops: number; algorithmVersion: string } {
  return { minHops: MIN_HOPS, maxHops: MAX_HOPS, algorithmVersion: "TESS-ONION-v2" };
}
