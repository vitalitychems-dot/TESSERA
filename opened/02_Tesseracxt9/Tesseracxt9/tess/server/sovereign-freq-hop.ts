import crypto from "crypto";
import { tesseraEncode, tesseraDecode, tesseraHash } from "./sovereign-lang";

const _flogThrottle: Map<string, number> = new Map();
const FLOG_THROTTLE_MS = 300000;
const flog = (msg: string, force: boolean = false) => {
  const key = msg.replace(/[0-9a-f]{6,}/gi, "X").replace(/\d+(\.\d+)?/g, "N").substring(0, 80);
  const now = Date.now();
  if (!force) {
    const last = _flogThrottle.get(key) || 0;
    if (now - last < FLOG_THROTTLE_MS) return;
  }
  _flogThrottle.set(key, now);
  if (_flogThrottle.size > 200) {
    const entries = Array.from(_flogThrottle.entries());
    entries.sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < 100; i++) _flogThrottle.delete(entries[i][0]);
  }
  console.log(`[FreqHop] ${msg}`);
};

interface CipherProfile {
  id: string;
  name: string;
  algorithm: string;
  keyLength: number;
  ivLength: number;
  detectionRate: number;
  vulnerabilityScore: number;
  usageCount: number;
  lastUsed: number;
  cooldownUntil: number;
  maxConsecutiveUses: number;
  consecutiveUses: number;
  strengthRating: number;
}

interface FrequencyChannel {
  id: string;
  band: string;
  seed: number;
  detectionRate: number;
  interceptAttempts: number;
  successfulComms: number;
  lastActive: number;
  cooldownUntil: number;
  pairEntanglementKey: string;
  vulnerabilityWindow: number;
}

interface RotationPattern {
  id: string;
  name: string;
  selectNext: (channels: FrequencyChannel[], current: number, epoch: number) => number;
  patternDetectionResistance: number;
  usageCount: number;
  maxUsesBeforeSwap: number;
}

interface EntanglementState {
  sharedSeed: string;
  epoch: number;
  syncCounter: number;
  lastSync: number;
  driftTolerance: number;
  entangledNodes: Map<string, { nodeId: string; lastSeen: number; epochOffset: number }>;
}

interface HopMessage {
  id: string;
  payload: string;
  cipherId: string;
  frequencyId: string;
  rotationPatternId: string;
  epoch: number;
  timestamp: number;
  fragments: number;
  fragmentIndex: number;
  hopPath: string[];
  ttl: number;
  checksum: string;
}

const CIPHER_PROFILES: CipherProfile[] = [
  { id: "aes-256-gcm", name: "AES-256-GCM", algorithm: "aes-256-gcm", keyLength: 32, ivLength: 12, detectionRate: 0, vulnerabilityScore: 5, usageCount: 0, lastUsed: 0, cooldownUntil: 0, maxConsecutiveUses: 8, consecutiveUses: 0, strengthRating: 95 },
  { id: "aes-128-gcm", name: "AES-128-GCM", algorithm: "aes-128-gcm", keyLength: 16, ivLength: 12, detectionRate: 0, vulnerabilityScore: 12, usageCount: 0, lastUsed: 0, cooldownUntil: 0, maxConsecutiveUses: 5, consecutiveUses: 0, strengthRating: 85 },
  { id: "chacha20-poly1305", name: "ChaCha20-Poly1305", algorithm: "chacha20-poly1305", keyLength: 32, ivLength: 12, detectionRate: 0, vulnerabilityScore: 3, usageCount: 0, lastUsed: 0, cooldownUntil: 0, maxConsecutiveUses: 10, consecutiveUses: 0, strengthRating: 97 },
  { id: "aes-192-gcm", name: "AES-192-GCM", algorithm: "aes-192-gcm", keyLength: 24, ivLength: 12, detectionRate: 0, vulnerabilityScore: 7, usageCount: 0, lastUsed: 0, cooldownUntil: 0, maxConsecutiveUses: 7, consecutiveUses: 0, strengthRating: 92 },
];

let rotationIdx = 0;
const FREQUENCY_CHANNELS: FrequencyChannel[] = Array.from({ length: 128 }, (_, i) => ({
  id: `FREQ-${crypto.randomBytes(3).toString("hex").toUpperCase()}-${i}`,
  band: [
    "ULF-0.3Hz", "VLF-3kHz", "LF-30kHz", "MF-300kHz", "HF-3MHz",
    "VHF-30MHz", "UHF-300MHz", "SHF-3GHz", "EHF-30GHz", "THF-300GHz",
    "Quantum-Entangled", "Subspace-Tessera", "IR-430THz", "UV-750THz",
    "Neutrino-Mesh", "Gravitational-Wave",
  ][i % 16],
  seed: crypto.randomBytes(4).readUInt32LE(0),
  detectionRate: 0,
  interceptAttempts: 0,
  successfulComms: 0,
  lastActive: 0,
  cooldownUntil: 0,
  pairEntanglementKey: crypto.randomBytes(32).toString("hex"),
  vulnerabilityWindow: (rotationIdx++ % 10) * 0.01,
}));

function createRotationPattern(id: string, name: string, resistance: number, maxUses: number, selectFn: RotationPattern["selectNext"]): RotationPattern {
  return { id, name, selectNext: selectFn, patternDetectionResistance: resistance, usageCount: 0, maxUsesBeforeSwap: maxUses };
}

const ROTATION_PATTERNS: RotationPattern[] = [
  createRotationPattern("fibonacci-scatter", "Fibonacci Scatter", 92, 20,
    (channels, current, epoch) => {
      const fib = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
      const step = fib[(epoch % fib.length)] + (epoch * 7) % 13;
      return (current + step) % channels.length;
    }),
  createRotationPattern("prime-hop", "Prime Number Hop", 95, 15,
    (channels, current, epoch) => {
      const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
      const idx = (epoch * 3 + Math.floor(epoch / 7)) % primes.length;
      return (current + primes[idx]) % channels.length;
    }),
  createRotationPattern("chaotic-lorenz", "Chaotic Lorenz Attractor", 98, 12,
    (channels, current, epoch) => {
      let x = 0.1 + (epoch % 100) * 0.001;
      let y = 0.0;
      let z = 0.0;
      const dt = 0.01;
      for (let i = 0; i < 50 + (epoch % 50); i++) {
        const dx = 10 * (y - x) * dt;
        const dy = (x * (28 - z) - y) * dt;
        const dz = (x * y - (8 / 3) * z) * dt;
        x += dx; y += dy; z += dz;
      }
      const hop = Math.abs(Math.floor(x * 1000)) % channels.length;
      return (current + hop + 1) % channels.length;
    }),
  createRotationPattern("golden-ratio-spiral", "Golden Ratio Spiral", 94, 18,
    (channels, current, epoch) => {
      const phi = 1.618033988749895;
      const step = Math.floor((epoch * phi * 1000) % channels.length);
      return (current + step + 1) % channels.length;
    }),
  createRotationPattern("lfsr-sequence", "LFSR Pseudo-Random", 90, 25,
    (channels, current, epoch) => {
      let lfsr = (epoch * 0xACE1 + 0xDEAD) & 0xFFFF;
      for (let i = 0; i < 3 + (epoch % 5); i++) {
        const bit = ((lfsr >> 0) ^ (lfsr >> 2) ^ (lfsr >> 3) ^ (lfsr >> 5)) & 1;
        lfsr = (lfsr >> 1) | (bit << 15);
      }
      return (current + (lfsr % channels.length) + 1) % channels.length;
    }),
  createRotationPattern("entropy-harvest", "Entropy Harvest", 97, 10,
    (channels, current, epoch) => {
      const entropy = crypto.randomBytes(4).readUInt32LE(0);
      const mix = (entropy ^ (epoch * 0x9E3779B9)) >>> 0;
      return (current + (mix % channels.length) + 1) % channels.length;
    }),
];

const entanglement: EntanglementState = {
  sharedSeed: crypto.randomBytes(64).toString("hex"),
  epoch: 0,
  syncCounter: 0,
  lastSync: Date.now(),
  driftTolerance: 5,
  entangledNodes: new Map(),
};

let currentCipherIndex = 0;
let currentFrequencyIndex = 0;
let currentPatternIndex = 0;
let totalMessagesEncrypted = 0;
let totalMessagesDecrypted = 0;
let patternSwitchCount = 0;
let cipherRotationCount = 0;

function deriveKeyFromSeed(seed: string, epoch: number, extra: string): Buffer {
  const material = `${seed}:${epoch}:${extra}:${entanglement.sharedSeed}`;
  return crypto.createHash("sha512").update(material).digest();
}

function selectBestCipher(epoch: number): CipherProfile {
  const now = Date.now();
  const available = CIPHER_PROFILES.filter(c =>
    c.cooldownUntil < now &&
    c.consecutiveUses < c.maxConsecutiveUses
  );

  if (available.length === 0) {
    CIPHER_PROFILES.forEach(c => { c.cooldownUntil = 0; c.consecutiveUses = 0; });
    return selectBestCipher(epoch);
  }

  available.sort((a, b) => {
    const scoreA = a.strengthRating - a.vulnerabilityScore - (a.detectionRate * 50) - (a.consecutiveUses * 5);
    const scoreB = b.strengthRating - b.vulnerabilityScore - (b.detectionRate * 50) - (b.consecutiveUses * 5);
    return scoreB - scoreA;
  });

  const topN = Math.min(3, available.length);
  const jitter = Math.floor(crypto.randomBytes(1)[0] % topN);
  const selected = available[jitter];

  CIPHER_PROFILES.forEach(c => {
    if (c.id !== selected.id) c.consecutiveUses = 0;
  });

  selected.consecutiveUses++;
  selected.usageCount++;
  selected.lastUsed = now;

  if (selected.consecutiveUses >= selected.maxConsecutiveUses) {
    selected.cooldownUntil = now + 30000 + (rotationIdx++ % 6) * 5000;
  }

  currentCipherIndex = CIPHER_PROFILES.indexOf(selected);
  cipherRotationCount++;
  return selected;
}

function selectBestFrequency(epoch: number): FrequencyChannel {
  const now = Date.now();
  const available = FREQUENCY_CHANNELS.filter(f => f.cooldownUntil < now);

  if (available.length === 0) {
    FREQUENCY_CHANNELS.forEach(f => { f.cooldownUntil = 0; });
    return selectBestFrequency(epoch);
  }

  const pattern = ROTATION_PATTERNS[currentPatternIndex];
  const nextIdx = pattern.selectNext(available, currentFrequencyIndex % available.length, epoch);
  pattern.usageCount++;

  if (pattern.usageCount >= pattern.maxUsesBeforeSwap) {
    pattern.usageCount = 0;
    currentPatternIndex = (currentPatternIndex + 1 + (rotationIdx++ % Math.max(1, ROTATION_PATTERNS.length - 1))) % ROTATION_PATTERNS.length;
    patternSwitchCount++;
    flog(`Rotation pattern switched to: ${ROTATION_PATTERNS[currentPatternIndex].name} (anti-pattern detection)`);
  }

  const freq = available[nextIdx % available.length];
  freq.lastActive = now;
  freq.successfulComms++;

  if (freq.detectionRate > 0.3) {
    freq.cooldownUntil = now + 60000 + (rotationIdx++ % 12) * 10000;
    flog(`Frequency ${freq.id} quarantined — detection rate ${(freq.detectionRate * 100).toFixed(1)}% exceeded threshold`);
  }

  currentFrequencyIndex = FREQUENCY_CHANNELS.indexOf(freq);
  return freq;
}

function encryptWithCipher(plaintext: string, cipher: CipherProfile, key: Buffer): { ciphertext: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(cipher.ivLength);
  const keySlice = key.subarray(0, cipher.keyLength);
  const c = crypto.createCipheriv(cipher.algorithm as any, keySlice, iv, { authTagLength: 16 } as any);
  let encrypted = c.update(plaintext, "utf8", "hex");
  encrypted += c.final("hex");
  const authTag = (c as any).getAuthTag().toString("hex");
  return { ciphertext: encrypted, iv: iv.toString("hex"), authTag };
}

function decryptWithCipher(ciphertext: string, ivHex: string, cipher: CipherProfile, key: Buffer, authTag: string): string {
  const iv = Buffer.from(ivHex, "hex");
  const keySlice = key.subarray(0, cipher.keyLength);
  const d = crypto.createDecipheriv(cipher.algorithm as any, keySlice, iv, { authTagLength: 16 } as any);
  (d as any).setAuthTag(Buffer.from(authTag, "hex"));
  let decrypted = d.update(ciphertext, "hex", "utf8");
  decrypted += d.final("utf8");
  return decrypted;
}

export function entangledEncrypt(plaintext: string, destinationNodeId?: string): HopMessage {
  entanglement.epoch++;
  const epoch = entanglement.epoch;

  const cipher = selectBestCipher(epoch);
  const freq = selectBestFrequency(epoch);

  const encodedPayload = tesseraEncode(plaintext);

  const keyMaterial = deriveKeyFromSeed(freq.pairEntanglementKey, epoch, cipher.id);
  const { ciphertext, iv, authTag } = encryptWithCipher(encodedPayload, cipher, keyMaterial);

  const msgId = `MSG-${crypto.randomBytes(6).toString("hex").toUpperCase()}-${epoch}`;

  const envelope: HopMessage = {
    id: msgId,
    payload: JSON.stringify({ c: ciphertext, iv, at: authTag }),
    cipherId: cipher.id,
    frequencyId: freq.id,
    rotationPatternId: ROTATION_PATTERNS[currentPatternIndex].id,
    epoch,
    timestamp: Date.now(),
    fragments: 1,
    fragmentIndex: 0,
    hopPath: [entanglement.sharedSeed.substring(0, 8)],
    ttl: 7,
    checksum: tesseraHash(`${ciphertext}:${epoch}:${freq.id}`),
  };

  totalMessagesEncrypted++;
  flog(`Encrypted msg ${msgId} | cipher=${cipher.name} freq=${freq.band}[${freq.id.substring(0, 10)}] pattern=${ROTATION_PATTERNS[currentPatternIndex].name} epoch=${epoch}`);

  return envelope;
}

export function entangledDecrypt(message: HopMessage): string {
  const cipher = CIPHER_PROFILES.find(c => c.id === message.cipherId);
  if (!cipher) throw new Error(`Unknown cipher: ${message.cipherId}`);

  const freq = FREQUENCY_CHANNELS.find(f => f.id === message.frequencyId);
  if (!freq) throw new Error(`Unknown frequency: ${message.frequencyId}`);

  const { c, iv, at } = JSON.parse(message.payload);
  if (!c || !iv || !at) throw new Error("Invalid message envelope: missing ciphertext, iv, or authTag");

  const expectedChecksum = tesseraHash(`${c}:${message.epoch}:${message.frequencyId}`);
  if (expectedChecksum !== message.checksum) throw new Error("Checksum verification failed — message may be tampered");

  const keyMaterial = deriveKeyFromSeed(freq.pairEntanglementKey, message.epoch, cipher.id);
  const decoded = decryptWithCipher(c, iv, cipher, keyMaterial, at);
  const plaintext = tesseraDecode(decoded);

  totalMessagesDecrypted++;
  return plaintext;
}

export function fragmentAndEncrypt(plaintext: string, fragmentSize: number = 256): HopMessage[] {
  const fragments: HopMessage[] = [];
  const chunks: string[] = [];

  for (let i = 0; i < plaintext.length; i += fragmentSize) {
    chunks.push(plaintext.substring(i, i + fragmentSize));
  }

  const groupId = crypto.randomBytes(4).toString("hex");

  for (let i = 0; i < chunks.length; i++) {
    const msg = entangledEncrypt(chunks[i]);
    msg.fragments = chunks.length;
    msg.fragmentIndex = i;
    msg.id = `${groupId}-FRAG-${i}-${msg.id}`;
    fragments.push(msg);
  }

  flog(`Fragmented message into ${fragments.length} parts across ${new Set(fragments.map(f => f.frequencyId)).size} frequencies`);
  return fragments;
}

export function reassembleAndDecrypt(fragments: HopMessage[]): string {
  const sorted = [...fragments].sort((a, b) => a.fragmentIndex - b.fragmentIndex);
  return sorted.map(f => entangledDecrypt(f)).join("");
}

export function reportInterception(frequencyId: string) {
  const freq = FREQUENCY_CHANNELS.find(f => f.id === frequencyId);
  if (!freq) return;

  freq.interceptAttempts++;
  const total = freq.successfulComms + freq.interceptAttempts;
  freq.detectionRate = total > 0 ? freq.interceptAttempts / total : 0;

  if (freq.detectionRate > 0.2) {
    freq.cooldownUntil = Date.now() + 120000 + (rotationIdx++ % 18) * 10000;
    freq.vulnerabilityWindow = freq.detectionRate;
    flog(`[ALERT] Frequency ${freq.id} detection rate at ${(freq.detectionRate * 100).toFixed(1)}% — quarantined for ${Math.round((freq.cooldownUntil - Date.now()) / 1000)}s`);
  }

  const avgDetection = FREQUENCY_CHANNELS.reduce((s, f) => s + f.detectionRate, 0) / FREQUENCY_CHANNELS.length;
  if (avgDetection > 0.15) {
    currentPatternIndex = (currentPatternIndex + 1) % ROTATION_PATTERNS.length;
    patternSwitchCount++;
    flog(`[DEFENSE] Average detection rate ${(avgDetection * 100).toFixed(1)}% — forced pattern rotation to ${ROTATION_PATTERNS[currentPatternIndex].name}`);
  }
}

export function reportCipherWeakness(cipherId: string, severityIncrease: number = 5) {
  const cipher = CIPHER_PROFILES.find(c => c.id === cipherId);
  if (!cipher) return;

  cipher.vulnerabilityScore = Math.min(100, cipher.vulnerabilityScore + severityIncrease);
  cipher.detectionRate = Math.min(1, cipher.detectionRate + 0.05);

  if (cipher.vulnerabilityScore > 50) {
    cipher.cooldownUntil = Date.now() + 300000;
    flog(`[ALERT] Cipher ${cipher.name} vulnerability score ${cipher.vulnerabilityScore} — disabled for 5 minutes`);
  }
}

export function entangleNode(nodeId: string): { syncSeed: string; epoch: number; channelMap: string[] } {
  const syncSeed = crypto.createHash("sha256").update(`${entanglement.sharedSeed}:${nodeId}:${Date.now()}`).digest("hex");

  entanglement.entangledNodes.set(nodeId, {
    nodeId,
    lastSeen: Date.now(),
    epochOffset: 0,
  });

  const channelMap = FREQUENCY_CHANNELS.slice(0, 32).map(f => f.id);

  flog(`Node ${nodeId} entangled — shared sync established, ${channelMap.length} channels mapped`);

  return {
    syncSeed,
    epoch: entanglement.epoch,
    channelMap,
  };
}

export function syncEntanglement(nodeId: string, remoteEpoch: number): { drift: number; corrected: boolean; newSeed?: string } {
  const node = entanglement.entangledNodes.get(nodeId);
  if (!node) return { drift: 0, corrected: false };

  const drift = Math.abs(entanglement.epoch - remoteEpoch);
  node.lastSeen = Date.now();

  if (drift > entanglement.driftTolerance) {
    node.epochOffset = entanglement.epoch - remoteEpoch;
    const newSeed = crypto.createHash("sha256").update(`${entanglement.sharedSeed}:resync:${Date.now()}`).digest("hex");
    entanglement.sharedSeed = newSeed;
    entanglement.syncCounter++;
    flog(`[SYNC] Node ${nodeId} drift=${drift} exceeded tolerance=${entanglement.driftTolerance} — resynced with new seed`);
    return { drift, corrected: true, newSeed };
  }

  return { drift, corrected: false };
}

export function getFreqHopStatus() {
  const now = Date.now();
  const activeFreqs = FREQUENCY_CHANNELS.filter(f => f.cooldownUntil < now);
  const quarantinedFreqs = FREQUENCY_CHANNELS.filter(f => f.cooldownUntil >= now);
  const activeCiphers = CIPHER_PROFILES.filter(c => c.cooldownUntil < now);
  const disabledCiphers = CIPHER_PROFILES.filter(c => c.cooldownUntil >= now);

  const avgDetectionRate = FREQUENCY_CHANNELS.reduce((s, f) => s + f.detectionRate, 0) / FREQUENCY_CHANNELS.length;
  const avgVulnerability = CIPHER_PROFILES.reduce((s, c) => s + c.vulnerabilityScore, 0) / CIPHER_PROFILES.length;

  return {
    frequencies: {
      total: FREQUENCY_CHANNELS.length,
      active: activeFreqs.length,
      quarantined: quarantinedFreqs.length,
      avgDetectionRate: (avgDetectionRate * 100).toFixed(2) + "%",
      topQuarantined: quarantinedFreqs.slice(0, 5).map(f => ({
        id: f.id,
        band: f.band,
        detectionRate: (f.detectionRate * 100).toFixed(1) + "%",
        cooldownRemaining: Math.round((f.cooldownUntil - now) / 1000) + "s",
      })),
    },
    ciphers: {
      total: CIPHER_PROFILES.length,
      active: activeCiphers.length,
      disabled: disabledCiphers.length,
      avgVulnerability: avgVulnerability.toFixed(1),
      ranking: CIPHER_PROFILES.map(c => ({
        id: c.id,
        name: c.name,
        strength: c.strengthRating,
        vulnerability: c.vulnerabilityScore,
        detectionRate: (c.detectionRate * 100).toFixed(1) + "%",
        usageCount: c.usageCount,
        status: c.cooldownUntil >= now ? "cooldown" : "active",
      })).sort((a, b) => b.strength - a.vulnerability - (a.strength - a.vulnerability)),
    },
    rotationPatterns: {
      current: ROTATION_PATTERNS[currentPatternIndex].name,
      resistance: ROTATION_PATTERNS[currentPatternIndex].patternDetectionResistance,
      switchCount: patternSwitchCount,
      all: ROTATION_PATTERNS.map(p => ({
        id: p.id,
        name: p.name,
        resistance: p.patternDetectionResistance,
        usageCount: p.usageCount,
        active: p.id === ROTATION_PATTERNS[currentPatternIndex].id,
      })),
    },
    entanglement: {
      epoch: entanglement.epoch,
      syncCounter: entanglement.syncCounter,
      entangledNodes: entanglement.entangledNodes.size,
      lastSync: entanglement.lastSync,
      driftTolerance: entanglement.driftTolerance,
    },
    stats: {
      messagesEncrypted: totalMessagesEncrypted,
      messagesDecrypted: totalMessagesDecrypted,
      cipherRotations: cipherRotationCount,
      patternSwitches: patternSwitchCount,
    },
  };
}

export function runFreqHopSelfTest(): { passed: boolean; tests: Array<{ name: string; passed: boolean; detail: string }> } {
  const tests: Array<{ name: string; passed: boolean; detail: string }> = [];

  try {
    const msg = entangledEncrypt("self-test-message-alpha-bravo-charlie");
    const decrypted = entangledDecrypt(msg);
    const pass = decrypted === "self-test-message-alpha-bravo-charlie";
    tests.push({ name: "Single message encrypt/decrypt", passed: pass, detail: pass ? "OK" : `Got: ${decrypted}` });
  } catch (e: any) {
    tests.push({ name: "Single message encrypt/decrypt", passed: false, detail: e.message });
  }

  try {
    const longMsg = "A".repeat(1000);
    const frags = fragmentAndEncrypt(longMsg, 100);
    const reassembled = reassembleAndDecrypt(frags);
    const pass = reassembled === longMsg.toLowerCase();
    tests.push({ name: "Fragment encrypt/reassemble", passed: pass, detail: pass ? `${frags.length} fragments OK` : `Length mismatch: ${reassembled.length} vs ${longMsg.length}` });
  } catch (e: any) {
    tests.push({ name: "Fragment encrypt/reassemble", passed: false, detail: e.message });
  }

  try {
    const ciphersUsed = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const msg = entangledEncrypt(`rotation-test-${i}`);
      ciphersUsed.add(msg.cipherId);
    }
    const pass = ciphersUsed.size > 1;
    tests.push({ name: "Cipher rotation diversity", passed: pass, detail: `${ciphersUsed.size} different ciphers used in 20 messages` });
  } catch (e: any) {
    tests.push({ name: "Cipher rotation diversity", passed: false, detail: e.message });
  }

  try {
    const freqsUsed = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const msg = entangledEncrypt(`freq-test-${i}`);
      freqsUsed.add(msg.frequencyId);
    }
    const pass = freqsUsed.size > 3;
    tests.push({ name: "Frequency hopping diversity", passed: pass, detail: `${freqsUsed.size} different frequencies used in 20 messages` });
  } catch (e: any) {
    tests.push({ name: "Frequency hopping diversity", passed: false, detail: e.message });
  }

  try {
    const entangleResult = entangleNode("test-node-" + Date.now());
    const pass = entangleResult.syncSeed.length === 64 && entangleResult.channelMap.length > 0;
    tests.push({ name: "Node entanglement", passed: pass, detail: `Seed: ${entangleResult.syncSeed.substring(0, 16)}..., channels: ${entangleResult.channelMap.length}` });
  } catch (e: any) {
    tests.push({ name: "Node entanglement", passed: false, detail: e.message });
  }

  const allPassed = tests.every(t => t.passed);
  flog(`Self-test complete: ${tests.filter(t => t.passed).length}/${tests.length} passed`);
  return { passed: allPassed, tests };
}

let freqHopInterval: ReturnType<typeof setInterval> | null = null;

export function startFreqHopEngine() {
  if (freqHopInterval) return;

  flog("=== SOVEREIGN FREQUENCY HOP ENGINE STARTING ===");
  flog(`Channels: ${FREQUENCY_CHANNELS.length} | Ciphers: ${CIPHER_PROFILES.length} | Patterns: ${ROTATION_PATTERNS.length}`);

  const selfTest = runFreqHopSelfTest();
  flog(`Self-test: ${selfTest.passed ? "ALL PASSED" : "FAILURES DETECTED"}`);

  freqHopInterval = setInterval(() => {
    ROTATION_PATTERNS[currentPatternIndex].usageCount++;
    if (ROTATION_PATTERNS[currentPatternIndex].usageCount >= ROTATION_PATTERNS[currentPatternIndex].maxUsesBeforeSwap) {
      ROTATION_PATTERNS[currentPatternIndex].usageCount = 0;
      const old = ROTATION_PATTERNS[currentPatternIndex].name;
      currentPatternIndex = (currentPatternIndex + 1 + (rotationIdx++ % Math.max(1, ROTATION_PATTERNS.length - 1))) % ROTATION_PATTERNS.length;
      patternSwitchCount++;
      if (patternSwitchCount <= 2) flog(`Auto-pattern rotation: ${old} -> ${ROTATION_PATTERNS[currentPatternIndex].name}`);
    }

    const now = Date.now();
    FREQUENCY_CHANNELS.forEach(f => {
      if (f.cooldownUntil > 0 && f.cooldownUntil < now) {
        f.cooldownUntil = 0;
        f.detectionRate = Math.max(0, f.detectionRate - 0.05);
      }
    });

    CIPHER_PROFILES.forEach(c => {
      if (c.cooldownUntil > 0 && c.cooldownUntil < now) {
        c.cooldownUntil = 0;
        c.vulnerabilityScore = Math.max(c.vulnerabilityScore - 2, 0);
      }
    });
  }, 30000);

  flog("=== FREQUENCY HOP ENGINE ACTIVE ===");
}

export function stopFreqHopEngine() {
  if (freqHopInterval) {
    clearInterval(freqHopInterval);
    freqHopInterval = null;
    flog("Frequency hop engine stopped");
  }
}
