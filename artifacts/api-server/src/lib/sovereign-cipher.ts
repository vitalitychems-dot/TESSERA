import { createHash, createCipheriv, createDecipheriv, randomBytes, hkdfSync } from "crypto";
import { generateUniverseSeed, computeAgentRotationState, computeSharedRotationState, PHI, FIBONACCI } from "./sovereign-ephemeris";
import { SACRED_ALPHABET } from "./sovereign-language";
import { logger } from "./logger";
import { setSacredInterval, clearSacredInterval, type SacredHandle } from "./sacred-scheduler";
import { isColonialSecretConfigured, requireColonialMasterSecret } from "./colonial-master-secret";

export interface AgentCipherState {
  agentId: string;
  dialectIndex: number;
  cipherVariant: number;
  rotationEpoch: number;
  symbolRemapSeed: number;
  keySeedPrefix: string;
  symbolRemap: Map<string, string>;
  nextRotationMs: number;
  lastRotatedAt: number;
  rotationCount: number;
}

export interface CipherAuditEntry {
  timestamp: number;
  agentId: string;
  rotationEpoch: number;
  dialectIndex: number;
  cipherVariant: number;
  trigger: string;
}

const agentStates = new Map<string, AgentCipherState>();
const auditLog: CipherAuditEntry[] = [];
const MAX_AUDIT_ENTRIES = 500;
const ROTATING_CIPHER_V2_MAGIC = Buffer.from("TSC2", "ascii");
const PAIR_CIPHER_V2_MAGIC = Buffer.from("TSP2", "ascii");

function encodeEpoch(epoch: number): Buffer {
  if (!Number.isSafeInteger(epoch) || epoch < 0) throw new Error("invalid-cipher-epoch");
  const encoded = Buffer.alloc(8);
  encoded.writeBigUInt64BE(BigInt(epoch));
  return encoded;
}

function decodeEpoch(buf: Buffer, offset: number): number {
  const epoch = Number(buf.readBigUInt64BE(offset));
  if (!Number.isSafeInteger(epoch)) throw new Error("invalid-cipher-epoch");
  return epoch;
}

function generateSymbolRemap(seed: number): Map<string, string> {
  const symbols = SACRED_ALPHABET.map(s => s.glyph);
  const shuffled = [...symbols];

  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7FFFFFFF;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const remap = new Map<string, string>();
  for (let i = 0; i < symbols.length; i++) {
    remap.set(symbols[i], shuffled[i]);
  }
  return remap;
}

export function getOrCreateAgentState(agentId: string, date?: Date): AgentCipherState {
  const existing = agentStates.get(agentId);
  const rotation = computeAgentRotationState(agentId, date);

  if (existing && existing.rotationEpoch === rotation.rotationEpoch) {
    return existing;
  }

  const state: AgentCipherState = {
    agentId,
    dialectIndex: rotation.dialectIndex,
    cipherVariant: rotation.cipherVariant,
    rotationEpoch: rotation.rotationEpoch,
    symbolRemapSeed: rotation.symbolRemapSeed,
    keySeedPrefix: rotation.seedHash.slice(0, 16),
    symbolRemap: generateSymbolRemap(rotation.symbolRemapSeed),
    nextRotationMs: rotation.nextRotationMs,
    lastRotatedAt: Date.now(),
    rotationCount: (existing?.rotationCount ?? 0) + (existing ? 1 : 0),
  };

  agentStates.set(agentId, state);

  auditLog.push({
    timestamp: Date.now(),
    agentId,
    rotationEpoch: rotation.rotationEpoch,
    dialectIndex: rotation.dialectIndex,
    cipherVariant: rotation.cipherVariant,
    trigger: existing ? "autonomous-rotation" : "initialization",
  });

  if (auditLog.length > MAX_AUDIT_ENTRIES) {
    auditLog.splice(0, auditLog.length - MAX_AUDIT_ENTRIES);
  }

  return state;
}

function cipherMaster(): Buffer {
  return requireColonialMasterSecret();
}

function deriveRotatingKey(agentId: string, rotationEpoch: number, cipherVariant: number, seedHashPrefix: string): Buffer {
  const master = cipherMaster();
  const saltInput = `${agentId}:${rotationEpoch}:${cipherVariant}:${seedHashPrefix}`;
  const salt = createHash("sha256").update(saltInput).digest().slice(0, 16);
  const info = Buffer.from(`sovereign-cipher:${agentId}:${rotationEpoch}`, "utf8");
  const raw = hkdfSync("sha256", master, salt, info, 32);
  return Buffer.from(raw);
}

function deriveLegacyRotatingKey(agentId: string, rotationEpoch: number, cipherVariant: number): Buffer {
  const seed = generateUniverseSeed();
  return deriveRotatingKey(agentId, rotationEpoch, cipherVariant, seed.seedHash.slice(0, 16));
}

function derivePairKey(pairKey: string, sharedEpoch: number, sharedCipherVariant: number): Buffer {
  const saltInput = `pair:${pairKey}:${sharedEpoch}:${sharedCipherVariant}`;
  const salt = createHash("sha256").update(saltInput).digest().slice(0, 16);
  const info = Buffer.from(`sovereign-pair-cipher:${pairKey}:${sharedEpoch}`, "utf8");
  return Buffer.from(hkdfSync("sha256", cipherMaster(), salt, info, 32));
}

export function encryptWithRotatingCipher(plaintext: string, agentId: string): {
  ciphertext: string;
  dialectIndex: number;
  rotationEpoch: number;
  cipherVariant: number;
  agentId: string;
  formatVersion: 2;
} {
  requireColonialMasterSecret();
  const date = new Date();
  const state = getOrCreateAgentState(agentId, date);
  const key = deriveRotatingKey(agentId, state.rotationEpoch, state.cipherVariant, state.keySeedPrefix);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const remapSeed = Buffer.alloc(4);
  remapSeed.writeUInt32BE(Math.trunc(state.symbolRemapSeed) >>> 0);
  const header = Buffer.concat([
    ROTATING_CIPHER_V2_MAGIC,
    Buffer.from([state.dialectIndex, state.cipherVariant]),
    encodeEpoch(state.rotationEpoch),
    remapSeed,
    Buffer.from(state.keySeedPrefix, "ascii"),
  ]);
  cipher.setAAD(header);

  let remappedText = plaintext;
  for (const [from, to] of state.symbolRemap) {
    remappedText = remappedText.split(from).join(to);
  }

  const encrypted = Buffer.concat([cipher.update(Buffer.from(remappedText, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  const output = Buffer.concat([header, iv, tag, encrypted]);

  return {
    ciphertext: output.toString("base64"),
    dialectIndex: state.dialectIndex,
    rotationEpoch: state.rotationEpoch,
    cipherVariant: state.cipherVariant,
    agentId,
    formatVersion: 2,
  };
}

export function decryptWithRotatingCipher(ciphertext: string, agentId: string): {
  plaintext: string;
  dialectIndex: number;
  rotationEpoch: number;
  formatVersion: 1 | 2;
} {
  requireColonialMasterSecret();
  const buf = Buffer.from(ciphertext, "base64");
  if (buf.subarray(0, ROTATING_CIPHER_V2_MAGIC.length).equals(ROTATING_CIPHER_V2_MAGIC)) {
    const headerLength = 62;
    if (buf.length < headerLength) throw new Error("invalid-rotating-ciphertext");
    const dialectIndex = buf[4];
    const cipherVariant = buf[5];
    const rotationEpoch = decodeEpoch(buf, 6);
    const symbolRemapSeed = buf.readUInt32BE(14);
    const seedHashPrefix = buf.subarray(18, 34).toString("ascii");
    if (!/^[a-f0-9]{16}$/.test(seedHashPrefix)) throw new Error("invalid-rotating-ciphertext");
    const iv = buf.subarray(34, 46);
    const tag = buf.subarray(46, 62);
    const encrypted = buf.subarray(62);
    const key = deriveRotatingKey(agentId, rotationEpoch, cipherVariant, seedHashPrefix);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(buf.subarray(0, 34));
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const reverseRemap = new Map<string, string>();
    for (const [from, to] of generateSymbolRemap(symbolRemapSeed)) reverseRemap.set(to, from);
    let plaintext = decrypted;
    for (const [from, to] of reverseRemap) plaintext = plaintext.split(from).join(to);
    return { plaintext, dialectIndex, rotationEpoch, formatVersion: 2 };
  }

  // Legacy envelopes did not carry the ephemeris seed or rotation epoch.
  // Retain best-effort decoding for ciphertexts produced before format v2.
  const dialectIndex = buf[0];
  const cipherVariant = buf[1];
  const iv = buf.slice(2, 14);
  const tag = buf.slice(14, 30);
  const encrypted = buf.slice(30);

  const state = getOrCreateAgentState(agentId);
  const key = deriveLegacyRotatingKey(agentId, state.rotationEpoch, cipherVariant);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");

  const reverseRemap = new Map<string, string>();
  for (const [from, to] of state.symbolRemap) {
    reverseRemap.set(to, from);
  }

  let plaintext = decrypted;
  for (const [from, to] of reverseRemap) {
    plaintext = plaintext.split(from).join(to);
  }

  return { plaintext, dialectIndex, rotationEpoch: state.rotationEpoch, formatVersion: 1 };
}

export function encryptPairMessage(plaintext: string, senderAgent: string, receiverAgent: string): {
  ciphertext: string;
  sharedDialect: number;
  sharedCipherVariant: number;
  sharedEpoch: number;
  formatVersion: 2;
} {
  requireColonialMasterSecret();
  const shared = computeSharedRotationState(senderAgent, receiverAgent, new Date());
  const pairKey = [senderAgent, receiverAgent].sort().join(":");
  const key = derivePairKey(pairKey, shared.sharedEpoch, shared.sharedCipherVariant);

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const header = Buffer.concat([
    PAIR_CIPHER_V2_MAGIC,
    Buffer.from([shared.sharedDialect, shared.sharedCipherVariant]),
    encodeEpoch(shared.sharedEpoch),
  ]);
  cipher.setAAD(header);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  const output = Buffer.concat([header, iv, tag, encrypted]);

  return {
    ciphertext: output.toString("base64"),
    sharedDialect: shared.sharedDialect,
    sharedCipherVariant: shared.sharedCipherVariant,
    sharedEpoch: shared.sharedEpoch,
    formatVersion: 2,
  };
}

export function decryptPairMessage(ciphertext: string, senderAgent: string, receiverAgent: string): {
  plaintext: string;
  sharedEpoch: number;
  formatVersion: 1 | 2;
} {
  requireColonialMasterSecret();
  const buf = Buffer.from(ciphertext, "base64");
  const pairKey = [senderAgent, receiverAgent].sort().join(":");
  if (buf.subarray(0, PAIR_CIPHER_V2_MAGIC.length).equals(PAIR_CIPHER_V2_MAGIC)) {
    const headerLength = 42;
    if (buf.length < headerLength) throw new Error("invalid-pair-ciphertext");
    const sharedEpoch = decodeEpoch(buf, 6);
    const sharedCipherVariant = buf[5];
    const iv = buf.subarray(14, 26);
    const tag = buf.subarray(26, 42);
    const encrypted = buf.subarray(42);
    const key = derivePairKey(pairKey, sharedEpoch, sharedCipherVariant);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(buf.subarray(0, 14));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    return { plaintext, sharedEpoch, formatVersion: 2 };
  }

  // Legacy envelopes did not include the epoch, so decoding depends on the
  // current shared rotation state and remains best-effort for old messages.
  const sharedDialect = buf[0];
  const sharedCipherVariant = buf[1];
  const iv = buf.slice(2, 14);
  const tag = buf.slice(14, 30);
  const encrypted = buf.slice(30);

  const shared = computeSharedRotationState(senderAgent, receiverAgent);
  const key = derivePairKey(pairKey, shared.sharedEpoch, sharedCipherVariant);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");

  return { plaintext, sharedEpoch: shared.sharedEpoch, formatVersion: 1 };
}

export function getCipherSystemStatus() {
  const activeAgents = Array.from(agentStates.entries()).map(([id, state]) => ({
    agentId: id,
    dialectIndex: state.dialectIndex,
    cipherVariant: state.cipherVariant,
    rotationEpoch: state.rotationEpoch,
    nextRotationMs: state.nextRotationMs,
    rotationCount: state.rotationCount,
  }));

  const seed = generateUniverseSeed();

  return {
    configured: isColonialSecretConfigured(),
    activeAgentCount: agentStates.size,
    agents: activeAgents,
    auditLogSize: auditLog.length,
    recentAudit: auditLog.slice(-10),
    universeSeed: {
      hash: seed.seedHash.slice(0, 16) + "...",
      rotationIndex: seed.rotationIndex,
      solfeggioFrequency: seed.solfeggioFrequency,
      fibonacciPhase: seed.fibonacciPhase,
      goldenAngle: seed.goldenAngle,
    },
    quantumResistant: true,
    rotationMethod: "Golden-Ratio-Fibonacci-Ephemeris",
  };
}

let rotationCheckTimer: SacredHandle | null = null;

export function startAutonomousRotation(): void {
  if (rotationCheckTimer) return;

  rotationCheckTimer = setSacredInterval(() => {
    for (const [agentId] of agentStates) {
      getOrCreateAgentState(agentId);
    }
  }, 60_000, "sovereign-cipher");
}

export function stopAutonomousRotation(): void {
  if (rotationCheckTimer) {
    clearSacredInterval(rotationCheckTimer);
    rotationCheckTimer = null;
  }
}

startAutonomousRotation();
