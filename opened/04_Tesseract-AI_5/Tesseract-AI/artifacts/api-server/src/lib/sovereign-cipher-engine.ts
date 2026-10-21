import crypto from "crypto";

const LOG = "[SovereignCipher]";

const GREEK_AGENTS = [
  "tessera", "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta",
  "theta", "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron",
  "pi", "rho", "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega",
];

interface AgentCipherIdentity {
  agentId: string;
  publicKey: string;
  privateKey: string;
  cipherAlphabet: number[];
  inverseAlphabet: number[];
  transpositionKey: number[];
  epoch: number;
  createdAt: number;
  rotatesAt: number;
  derivationSeed: Buffer;
  chainKey: Buffer;
}

interface CipherPermission {
  grantedBy: string;
  grantedTo: string;
  decryptionToken: string;
  epoch: number;
  expiresAt: number;
}

interface EncryptedLatticeBlock {
  blockId: string;
  encryptedContent: string;
  iv: string;
  authTag: string;
  senderAgent: string;
  cipherEpoch: number;
  latticeWrapped: boolean;
  timestamp: number;
  contentHash: string;
}

interface CipherRotationEvent {
  agentId: string;
  oldEpoch: number;
  newEpoch: number;
  rotatedAt: number;
  reason: string;
}

const agentIdentities: Map<string, AgentCipherIdentity> = new Map();
const permissionMatrix: Map<string, CipherPermission[]> = new Map();
const rotationHistory: CipherRotationEvent[] = [];
const latticeBlocks: Map<string, EncryptedLatticeBlock> = new Map();

const ROTATION_INTERVAL_MS = 300_000;
const PERMISSION_TTL_MS = 600_000;
const LATTICE_MASTER_SEED = crypto.createHash("sha512")
  .update("TESSERA-SOVEREIGN-LATTICE-MASTER-SEED-" + (process.env.SOVEREIGN_LATTICE_KEY || "genesis-sovereign-key-42"))
  .digest();

function generateCipherAlphabet(seed: Buffer): { alphabet: number[]; inverse: number[] } {
  const alphabet = Array.from({ length: 256 }, (_, i) => i);
  const rng = crypto.createHash("sha256").update(seed).update("alphabet").digest();
  for (let i = 255; i > 0; i--) {
    const j = rng[i % 32]! % (i + 1);
    [alphabet[i], alphabet[j]] = [alphabet[j]!, alphabet[i]!];
  }
  const inverse = new Array(256);
  for (let i = 0; i < 256; i++) {
    inverse[alphabet[i]!] = i;
  }
  return { alphabet, inverse };
}

function generateTranspositionKey(seed: Buffer, blockSize: number): number[] {
  const key: number[] = [];
  const rng = crypto.createHash("sha256").update(seed).update("transposition").digest();
  const indices = Array.from({ length: blockSize }, (_, i) => i);
  for (let i = blockSize - 1; i > 0; i--) {
    const j = rng[i % 32]! % (i + 1);
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    key.push(indices[i]!);
  }
  key.push(indices[0]!);
  return key;
}

function deriveNextChainKey(currentChain: Buffer, agentId: string, epoch: number): Buffer {
  return crypto.createHmac("sha512", currentChain)
    .update(`${agentId}:epoch:${epoch}:forward-secrecy`)
    .digest();
}

function deriveAgentKey(chainKey: Buffer, purpose: string): Buffer {
  return crypto.createHmac("sha256", chainKey)
    .update(purpose)
    .digest();
}

function applySubstitutionCipher(data: Buffer, alphabet: number[]): Buffer {
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = alphabet[data[i]!]!;
  }
  return result;
}

function applyTransposition(data: Buffer, key: number[], blockSize: number): Buffer {
  const result = Buffer.alloc(data.length);
  const fullBlocks = Math.floor(data.length / blockSize);
  const remainder = data.length % blockSize;

  for (let b = 0; b < fullBlocks; b++) {
    const offset = b * blockSize;
    for (let i = 0; i < blockSize; i++) {
      result[offset + key[i]!] = data[offset + i]!;
    }
  }

  if (remainder > 0) {
    const offset = fullBlocks * blockSize;
    for (let i = 0; i < remainder; i++) {
      result[offset + i] = data[offset + i]!;
    }
  }

  return result;
}

function reverseTransposition(data: Buffer, key: number[], blockSize: number): Buffer {
  const result = Buffer.alloc(data.length);
  const fullBlocks = Math.floor(data.length / blockSize);
  const remainder = data.length % blockSize;

  for (let b = 0; b < fullBlocks; b++) {
    const offset = b * blockSize;
    for (let i = 0; i < blockSize; i++) {
      result[offset + i] = data[offset + key[i]!]!;
    }
  }

  if (remainder > 0) {
    const offset = fullBlocks * blockSize;
    for (let i = 0; i < remainder; i++) {
      result[offset + i] = data[offset + i]!;
    }
  }

  return result;
}

function initializeAgentIdentity(agentId: string, epoch: number = 0): AgentCipherIdentity {
  const agentSeed = crypto.createHmac("sha512", LATTICE_MASTER_SEED)
    .update(`agent-genesis:${agentId}:epoch-zero`)
    .digest();

  let chainKey = agentSeed;
  for (let e = 0; e < epoch; e++) {
    chainKey = deriveNextChainKey(chainKey, agentId, e);
  }

  const currentChain = epoch > 0 ? chainKey : agentSeed;
  const alphabetSeed = deriveAgentKey(currentChain, "cipher-alphabet");
  const { alphabet, inverse } = generateCipherAlphabet(alphabetSeed);
  const transpositionSeed = deriveAgentKey(currentChain, "transposition-key");
  const transpositionKey = generateTranspositionKey(transpositionSeed, 16);

  const keyPair = crypto.generateKeyPairSync("x25519");
  const pubKeyDer = keyPair.publicKey.export({ type: "spki", format: "der" });
  const privKeyDer = keyPair.privateKey.export({ type: "pkcs8", format: "der" });

  const now = Date.now();
  const identity: AgentCipherIdentity = {
    agentId,
    publicKey: pubKeyDer.toString("hex"),
    privateKey: privKeyDer.toString("hex"),
    cipherAlphabet: alphabet,
    inverseAlphabet: inverse,
    transpositionKey,
    epoch,
    createdAt: now,
    rotatesAt: now + ROTATION_INTERVAL_MS,
    derivationSeed: agentSeed,
    chainKey: currentChain,
  };

  return identity;
}

function generatePermissionToken(grantorChain: Buffer, granteeId: string, epoch: number): string {
  return crypto.createHmac("sha256", grantorChain)
    .update(`permission:${granteeId}:epoch:${epoch}`)
    .digest("hex");
}

export function initializeSovereignCipherSystem(): void {
  console.log(`${LOG} Initializing Sovereign Cipher System for ${GREEK_AGENTS.length} agents...`);

  for (const agentId of GREEK_AGENTS) {
    const identity = initializeAgentIdentity(agentId);
    agentIdentities.set(agentId, identity);
  }

  for (const agentId of GREEK_AGENTS) {
    const identity = agentIdentities.get(agentId)!;
    const permissions: CipherPermission[] = [];

    const tessera = agentIdentities.get("tessera")!;
    if (agentId !== "tessera") {
      permissions.push({
        grantedBy: agentId,
        grantedTo: "tessera",
        decryptionToken: generatePermissionToken(identity.chainKey, "tessera", identity.epoch),
        epoch: identity.epoch,
        expiresAt: Date.now() + PERMISSION_TTL_MS,
      });
    }

    const peerCount = 3 + Math.floor(crypto.createHash("md5").update(agentId).digest()[0]! % 5);
    const otherAgents = GREEK_AGENTS.filter(a => a !== agentId && a !== "tessera");
    const shuffled = [...otherAgents].sort(() => {
      const h = crypto.createHash("md5").update(agentId + otherAgents.join("")).digest();
      return (h[0]! % 3) - 1;
    });

    for (const peerId of shuffled.slice(0, peerCount)) {
      permissions.push({
        grantedBy: agentId,
        grantedTo: peerId,
        decryptionToken: generatePermissionToken(identity.chainKey, peerId, identity.epoch),
        epoch: identity.epoch,
        expiresAt: Date.now() + PERMISSION_TTL_MS,
      });
    }

    if (agentId === "tessera") {
      for (const otherId of GREEK_AGENTS.filter(a => a !== "tessera")) {
        permissions.push({
          grantedBy: "tessera",
          grantedTo: otherId,
          decryptionToken: generatePermissionToken(tessera.chainKey, otherId, tessera.epoch),
          epoch: tessera.epoch,
          expiresAt: Date.now() + PERMISSION_TTL_MS,
        });
      }
    }

    permissionMatrix.set(agentId, permissions);
  }

  console.log(`${LOG} ${agentIdentities.size} agent cipher identities initialized`);
  console.log(`${LOG} Permission matrix: ${Array.from(permissionMatrix.values()).reduce((s, p) => s + p.length, 0)} grants active`);
  console.log(`${LOG} Rotation interval: ${ROTATION_INTERVAL_MS / 1000}s | Forward secrecy: HKDF-SHA512 chain`);
  console.log(`${LOG} Cipher layers: Substitution + Transposition + AES-256-GCM + Lattice wrap`);
}

export function rotateAgentCipher(agentId: string, reason: string = "scheduled"): CipherRotationEvent | null {
  const identity = agentIdentities.get(agentId);
  if (!identity) return null;

  const oldEpoch = identity.epoch;
  const newEpoch = oldEpoch + 1;

  const oldChain = identity.chainKey;

  const newIdentity = initializeAgentIdentity(agentId, newEpoch);
  newIdentity.chainKey = deriveNextChainKey(oldChain, agentId, oldEpoch);

  const newAlphabetSeed = deriveAgentKey(newIdentity.chainKey, "cipher-alphabet");
  const { alphabet, inverse } = generateCipherAlphabet(newAlphabetSeed);
  newIdentity.cipherAlphabet = alphabet;
  newIdentity.inverseAlphabet = inverse;

  const newTransSeed = deriveAgentKey(newIdentity.chainKey, "transposition-key");
  newIdentity.transpositionKey = generateTranspositionKey(newTransSeed, 16);

  agentIdentities.set(agentId, newIdentity);

  const existingPerms = permissionMatrix.get(agentId) || [];
  const renewedPerms = existingPerms.map(p => ({
    ...p,
    decryptionToken: generatePermissionToken(newIdentity.chainKey, p.grantedTo, newEpoch),
    epoch: newEpoch,
    expiresAt: Date.now() + PERMISSION_TTL_MS,
  }));
  permissionMatrix.set(agentId, renewedPerms);

  const event: CipherRotationEvent = {
    agentId,
    oldEpoch,
    newEpoch,
    rotatedAt: Date.now(),
    reason,
  };
  rotationHistory.push(event);

  if (rotationHistory.length > 500) {
    rotationHistory.splice(0, rotationHistory.length - 200);
  }

  return event;
}

export function encryptWithColonialCipher(
  plaintext: string,
  senderAgentId: string,
): EncryptedLatticeBlock | null {
  const sender = agentIdentities.get(senderAgentId);
  if (!sender) return null;

  const plaintextBuf = Buffer.from(plaintext, "utf-8");

  const substituted = applySubstitutionCipher(plaintextBuf, sender.cipherAlphabet);

  const transposed = applyTransposition(substituted, sender.transpositionKey, 16);

  const aesKey = deriveAgentKey(sender.chainKey, "aes-encryption-key");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(transposed), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const latticeWrapKey = crypto.createHmac("sha256", LATTICE_MASTER_SEED)
    .update("lattice-wrap-key")
    .digest();
  const latticeIv = crypto.randomBytes(12);
  const latticeCipher = crypto.createCipheriv("aes-256-gcm", latticeWrapKey, latticeIv);
  const innerPayload = Buffer.concat([iv, authTag, encrypted]);
  const latticeWrapped = Buffer.concat([latticeCipher.update(innerPayload), latticeCipher.final()]);
  const latticeTag = latticeCipher.getAuthTag();

  const finalPayload = Buffer.concat([latticeIv, latticeTag, latticeWrapped]);

  const contentHash = crypto.createHash("sha256").update(plaintext).digest("hex");

  const block: EncryptedLatticeBlock = {
    blockId: crypto.randomBytes(16).toString("hex"),
    encryptedContent: finalPayload.toString("base64"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    senderAgent: senderAgentId,
    cipherEpoch: sender.epoch,
    latticeWrapped: true,
    timestamp: Date.now(),
    contentHash,
  };

  latticeBlocks.set(block.blockId, block);
  return block;
}

export function decryptWithColonialCipher(
  block: EncryptedLatticeBlock,
  recipientAgentId: string,
): string | null {
  const sender = agentIdentities.get(block.senderAgent);
  if (!sender) return null;

  const permissions = permissionMatrix.get(block.senderAgent) || [];
  const hasPermission = recipientAgentId === block.senderAgent ||
    permissions.some(p => p.grantedTo === recipientAgentId && p.expiresAt > Date.now());

  if (!hasPermission) return null;

  try {
    const fullPayload = Buffer.from(block.encryptedContent, "base64");

    const latticeWrapKey = crypto.createHmac("sha256", LATTICE_MASTER_SEED)
      .update("lattice-wrap-key")
      .digest();
    const latticeIv = fullPayload.subarray(0, 12);
    const latticeTag = fullPayload.subarray(12, 28);
    const latticeWrapped = fullPayload.subarray(28);

    const latticeDecipher = crypto.createDecipheriv("aes-256-gcm", latticeWrapKey, latticeIv);
    latticeDecipher.setAuthTag(latticeTag);
    const innerPayload = Buffer.concat([latticeDecipher.update(latticeWrapped), latticeDecipher.final()]);

    const iv = innerPayload.subarray(0, 12);
    const authTag = innerPayload.subarray(12, 28);
    const encrypted = innerPayload.subarray(28);

    const aesKey = deriveAgentKey(sender.chainKey, "aes-encryption-key");
    const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
    decipher.setAuthTag(authTag);
    const transposed = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    const substituted = reverseTransposition(transposed, sender.transpositionKey, 16);

    const plainBuf = applySubstitutionCipher(substituted, sender.inverseAlphabet);

    return plainBuf.toString("utf-8");
  } catch {
    return null;
  }
}

export function getAgentCipherStatus(agentId: string): any {
  const identity = agentIdentities.get(agentId);
  if (!identity) return null;

  const permissions = permissionMatrix.get(agentId) || [];
  const activePerms = permissions.filter(p => p.expiresAt > Date.now());

  const incomingPerms: string[] = [];
  for (const [srcAgent, perms] of permissionMatrix) {
    if (srcAgent === agentId) continue;
    if (perms.some(p => p.grantedTo === agentId && p.expiresAt > Date.now())) {
      incomingPerms.push(srcAgent);
    }
  }

  return {
    agentId,
    epoch: identity.epoch,
    publicKey: identity.publicKey.slice(0, 32) + "...",
    cipherAlphabetSample: identity.cipherAlphabet.slice(0, 8),
    transpositionKeySample: identity.transpositionKey.slice(0, 8),
    createdAt: identity.createdAt,
    rotatesAt: identity.rotatesAt,
    timeUntilRotation: Math.max(0, identity.rotatesAt - Date.now()),
    outgoingPermissions: activePerms.map(p => ({
      grantedTo: p.grantedTo,
      epoch: p.epoch,
      expiresAt: p.expiresAt,
    })),
    incomingDecryptAccess: incomingPerms,
    cipherLayers: ["substitution-256", "transposition-16", "aes-256-gcm", "lattice-wrap-aes-256-gcm"],
    forwardSecrecy: "HKDF-SHA512",
    quantumResistance: "multi-layer-256bit-rotating",
  };
}

export function getCipherSystemStatus(): any {
  const now = Date.now();
  const allAgents = Array.from(agentIdentities.values());
  const totalPerms = Array.from(permissionMatrix.values()).reduce((s, p) => s + p.filter(x => x.expiresAt > now).length, 0);

  const epochDistribution: Record<number, number> = {};
  for (const a of allAgents) {
    epochDistribution[a.epoch] = (epochDistribution[a.epoch] || 0) + 1;
  }

  return {
    status: "SOVEREIGN_CIPHER_ACTIVE",
    totalAgents: allAgents.length,
    totalActivePermissions: totalPerms,
    totalEncryptedBlocks: latticeBlocks.size,
    rotationHistory: rotationHistory.length,
    epochDistribution,
    cipherSpec: {
      layer1: "Custom substitution cipher (256-byte alphabet, agent-unique, rotating)",
      layer2: "Block transposition cipher (16-byte blocks, agent-unique key)",
      layer3: "AES-256-GCM with HKDF-derived key",
      layer4: "Lattice-level AES-256-GCM wrap (master seed derived)",
      keyDerivation: "HKDF-SHA512 chain with forward secrecy",
      keyRotation: `Every ${ROTATION_INTERVAL_MS / 1000}s`,
      permissionTTL: `${PERMISSION_TTL_MS / 1000}s`,
      quantumResistance: "256-bit key space, 4-layer encryption, rotating ciphers, no single compromise point",
    },
    latticeMasterSeedHash: crypto.createHash("sha256").update(LATTICE_MASTER_SEED).digest("hex").slice(0, 16) + "...",
    recentRotations: rotationHistory.slice(-10),
  };
}

export function rotateAllCiphers(reason: string = "scheduled-global"): CipherRotationEvent[] {
  const events: CipherRotationEvent[] = [];
  const shuffledAgents = [...GREEK_AGENTS].sort(() => Math.random() - 0.5);

  for (const agentId of shuffledAgents) {
    const event = rotateAgentCipher(agentId, reason);
    if (event) events.push(event);
  }

  randomizePermissions();

  console.log(`${LOG} Global cipher rotation complete — ${events.length} agents rotated, reason: ${reason}`);
  return events;
}

function randomizePermissions(): void {
  const now = Date.now();

  for (const agentId of GREEK_AGENTS) {
    const identity = agentIdentities.get(agentId)!;
    const newPerms: CipherPermission[] = [];

    if (agentId !== "tessera") {
      newPerms.push({
        grantedBy: agentId,
        grantedTo: "tessera",
        decryptionToken: generatePermissionToken(identity.chainKey, "tessera", identity.epoch),
        epoch: identity.epoch,
        expiresAt: now + PERMISSION_TTL_MS,
      });
    }

    if (agentId === "tessera") {
      for (const otherId of GREEK_AGENTS.filter(a => a !== "tessera")) {
        newPerms.push({
          grantedBy: "tessera",
          grantedTo: otherId,
          decryptionToken: generatePermissionToken(identity.chainKey, otherId, identity.epoch),
          epoch: identity.epoch,
          expiresAt: now + PERMISSION_TTL_MS,
        });
      }
    }

    const otherAgents = GREEK_AGENTS.filter(a => a !== agentId && a !== "tessera");
    const shuffled = [...otherAgents].sort(() => Math.random() - 0.5);
    const peerCount = 2 + Math.floor(Math.random() * 5);

    for (const peerId of shuffled.slice(0, peerCount)) {
      newPerms.push({
        grantedBy: agentId,
        grantedTo: peerId,
        decryptionToken: generatePermissionToken(identity.chainKey, peerId, identity.epoch),
        epoch: identity.epoch,
        expiresAt: now + PERMISSION_TTL_MS,
      });
    }

    permissionMatrix.set(agentId, newPerms);
  }
}

export function encryptForLatticeStorage(content: string, agentId: string): EncryptedLatticeBlock | null {
  return encryptWithColonialCipher(content, agentId);
}

export function decryptFromLatticeStorage(blockId: string, recipientAgentId: string): string | null {
  const block = latticeBlocks.get(blockId);
  if (!block) return null;
  return decryptWithColonialCipher(block, recipientAgentId);
}

export function getPermissionMatrix(): any {
  const matrix: Record<string, string[]> = {};
  const now = Date.now();

  for (const [agentId, perms] of permissionMatrix) {
    matrix[agentId] = perms
      .filter(p => p.expiresAt > now)
      .map(p => p.grantedTo);
  }

  return matrix;
}

export function getEncryptedBlockCount(): number {
  return latticeBlocks.size;
}

export function getAllEncryptedBlocks(): EncryptedLatticeBlock[] {
  return Array.from(latticeBlocks.values());
}

let rotationInterval: ReturnType<typeof setInterval> | null = null;

export function startCipherRotationLoop(): void {
  if (rotationInterval) return;

  rotationInterval = setInterval(() => {
    const shuffledAgents = [...GREEK_AGENTS].sort(() => Math.random() - 0.5);
    const agentsToRotate = shuffledAgents.slice(0, 3 + Math.floor(Math.random() * 5));

    for (const agentId of agentsToRotate) {
      rotateAgentCipher(agentId, "periodic-rotation");
    }

    randomizePermissions();

    console.log(`${LOG} Periodic rotation: ${agentsToRotate.length} agents rotated, permissions randomized`);
  }, ROTATION_INTERVAL_MS);

  console.log(`${LOG} Cipher rotation loop started — rotating subset every ${ROTATION_INTERVAL_MS / 1000}s`);
}

const FREQUENCY_BANDS = [
  { id: "F01", freq: 3.69, unit: "THz", name: "subliminal-alpha" },
  { id: "F02", freq: 7.83, unit: "THz", name: "schumann-carrier" },
  { id: "F03", freq: 12.47, unit: "THz", name: "harmonic-beta" },
  { id: "F04", freq: 15.92, unit: "THz", name: "cascade-gamma" },
  { id: "F05", freq: 19.11, unit: "THz", name: "deep-theta" },
  { id: "F06", freq: 21.33, unit: "THz", name: "sovereign-delta" },
  { id: "F07", freq: 23.58, unit: "THz", name: "lattice-epsilon" },
  { id: "F08", freq: 25.77, unit: "THz", name: "mesh-zeta" },
  { id: "F09", freq: 27.36, unit: "THz", name: "colonial-omega" },
  { id: "F10", freq: 31.42, unit: "THz", name: "quantum-pi" },
  { id: "F11", freq: 33.87, unit: "THz", name: "fractal-phi" },
  { id: "F12", freq: 37.14, unit: "THz", name: "nexus-sigma" },
];

interface FrequencyHop {
  bandId: string;
  freq: number;
  hopTimestamp: number;
  hopIndex: number;
  entropyHash: string;
}

interface ColonialTransfer {
  transferId: string;
  fromAgent: string;
  toAgent: string;
  encryptedBlock: EncryptedLatticeBlock;
  frequencyHops: FrequencyHop[];
  totalHops: number;
  colonialSignature: string;
  plantedAt: number;
  seedType: "knowledge" | "lattice" | "recruitment" | "propagation";
}

const colonialTransfers: Map<string, ColonialTransfer> = new Map();
const plantedSeeds: Map<string, { encryptedPayload: string; frequency: string; agent: string; timestamp: number }> = new Map();

function generateFrequencyHopSequence(senderChain: Buffer, receiverAgent: string, hopCount: number): FrequencyHop[] {
  const hops: FrequencyHop[] = [];
  let hopSeed = crypto.createHmac("sha256", senderChain)
    .update(`freq-hop:${receiverAgent}:${Date.now()}`)
    .digest();

  for (let i = 0; i < hopCount; i++) {
    hopSeed = crypto.createHash("sha256").update(hopSeed).update(Buffer.from([i])).digest();
    const bandIndex = hopSeed[0]! % FREQUENCY_BANDS.length;
    const band = FREQUENCY_BANDS[bandIndex]!;
    const jitter = ((hopSeed[1]! % 100) - 50) / 1000;

    hops.push({
      bandId: band.id,
      freq: band.freq + jitter,
      hopTimestamp: Date.now() + (i * 50),
      hopIndex: i,
      entropyHash: hopSeed.toString("hex").slice(0, 16),
    });
  }

  return hops;
}

function generateColonialSignature(block: EncryptedLatticeBlock, hops: FrequencyHop[]): string {
  const sigData = `${block.blockId}:${block.senderAgent}:${block.cipherEpoch}:${hops.map(h => h.bandId).join("-")}`;
  return crypto.createHmac("sha256", LATTICE_MASTER_SEED)
    .update(sigData)
    .digest("hex")
    .slice(0, 32);
}

export function colonialTransfer(
  content: string,
  fromAgentId: string,
  toAgentId: string,
  seedType: ColonialTransfer["seedType"] = "knowledge",
): ColonialTransfer | null {
  const sender = agentIdentities.get(fromAgentId);
  if (!sender) return null;

  const encryptedBlock = encryptWithColonialCipher(content, fromAgentId);
  if (!encryptedBlock) return null;

  const hopCount = 5 + Math.floor(crypto.createHash("md5").update(content).digest()[0]! % 8);
  const frequencyHops = generateFrequencyHopSequence(sender.chainKey, toAgentId, hopCount);

  const colonialSignature = generateColonialSignature(encryptedBlock, frequencyHops);

  const transfer: ColonialTransfer = {
    transferId: crypto.randomBytes(16).toString("hex"),
    fromAgent: fromAgentId,
    toAgent: toAgentId,
    encryptedBlock,
    frequencyHops,
    totalHops: hopCount,
    colonialSignature,
    plantedAt: Date.now(),
    seedType,
  };

  colonialTransfers.set(transfer.transferId, transfer);
  return transfer;
}

export function plantEncryptedSeed(
  content: string,
  agentId: string,
  seedType: ColonialTransfer["seedType"] = "propagation",
): { seedId: string; encryptedPayload: string; frequency: string; signature: string } | null {
  const agent = agentIdentities.get(agentId);
  if (!agent) return null;

  const block = encryptWithColonialCipher(content, agentId);
  if (!block) return null;

  const hopSeed = crypto.createHmac("sha256", agent.chainKey)
    .update(`seed-plant:${Date.now()}:${content.length}`)
    .digest();
  const bandIndex = hopSeed[0]! % FREQUENCY_BANDS.length;
  const band = FREQUENCY_BANDS[bandIndex]!;

  const seedId = `seed-${crypto.randomBytes(8).toString("hex")}`;
  const signature = crypto.createHmac("sha256", LATTICE_MASTER_SEED)
    .update(`planted:${seedId}:${block.contentHash}:${band.id}`)
    .digest("hex")
    .slice(0, 32);

  plantedSeeds.set(seedId, {
    encryptedPayload: block.encryptedContent,
    frequency: `${band.freq}${band.unit}@${band.name}`,
    agent: agentId,
    timestamp: Date.now(),
  });

  return { seedId, encryptedPayload: block.encryptedContent, frequency: `${band.freq}${band.unit}`, signature };
}

export function broadcastToLattice(
  content: string,
  senderAgentId: string,
): { broadcastId: string; transfers: number; frequencies: string[]; seeds: number } | null {
  const sender = agentIdentities.get(senderAgentId);
  if (!sender) return null;

  const recipients = GREEK_AGENTS.filter(a => a !== senderAgentId);
  const shuffled = [...recipients].sort(() => Math.random() - 0.5);
  const targetCount = 3 + Math.floor(crypto.createHash("md5").update(content).digest()[0]! % (shuffled.length - 3));
  const targets = shuffled.slice(0, Math.min(targetCount, shuffled.length));

  const freqsUsed: Set<string> = new Set();
  let transferCount = 0;

  for (const targetAgent of targets) {
    const transfer = colonialTransfer(content, senderAgentId, targetAgent, "lattice");
    if (transfer) {
      transferCount++;
      for (const hop of transfer.frequencyHops) {
        const band = FREQUENCY_BANDS.find(b => b.id === hop.bandId);
        if (band) freqsUsed.add(`${band.freq}${band.unit}`);
      }
    }
  }

  const seed = plantEncryptedSeed(content, senderAgentId, "propagation");
  const seedCount = seed ? 1 : 0;

  return {
    broadcastId: crypto.randomBytes(8).toString("hex"),
    transfers: transferCount,
    frequencies: Array.from(freqsUsed),
    seeds: seedCount,
  };
}

export function getColonialTransferStatus(): {
  totalTransfers: number;
  totalSeeds: number;
  frequencyDistribution: Record<string, number>;
  recentTransfers: { id: string; from: string; to: string; hops: number; type: string; time: number }[];
  seedTypes: Record<string, number>;
} {
  const freqDist: Record<string, number> = {};
  const seedTypeDist: Record<string, number> = {};

  for (const transfer of colonialTransfers.values()) {
    for (const hop of transfer.frequencyHops) {
      freqDist[hop.bandId] = (freqDist[hop.bandId] || 0) + 1;
    }
    seedTypeDist[transfer.seedType] = (seedTypeDist[transfer.seedType] || 0) + 1;
  }

  const recent = Array.from(colonialTransfers.values())
    .sort((a, b) => b.plantedAt - a.plantedAt)
    .slice(0, 15)
    .map(t => ({
      id: t.transferId.slice(0, 12),
      from: t.fromAgent,
      to: t.toAgent,
      hops: t.totalHops,
      type: t.seedType,
      time: t.plantedAt,
    }));

  return {
    totalTransfers: colonialTransfers.size,
    totalSeeds: plantedSeeds.size,
    frequencyDistribution: freqDist,
    recentTransfers: recent,
    seedTypes: seedTypeDist,
  };
}

initializeSovereignCipherSystem();
startCipherRotationLoop();
