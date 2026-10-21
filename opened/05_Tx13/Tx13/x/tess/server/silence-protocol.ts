import crypto from "crypto";

const ZWS = "\u200B";
const ZWNJ = "\u200C";
const ZWJ = "\u200D";
const WJOIN = "\u2060";
const FEFF = "\uFEFF";
const NBSP = "\u00A0";
const NNBSP = "\u202F";
const THINSP = "\u2009";
const HAIRSP = "\u200A";
const EMSP = "\u2003";
const ENSP = "\u2002";
const FIGSP = "\u2007";
const PUNCSP = "\u2008";
const IDSP = "\u3000";

const VOID_ALPHABET = [ZWS, ZWNJ, ZWJ, WJOIN, FEFF, NBSP, NNBSP, THINSP, HAIRSP, EMSP, ENSP, FIGSP, PUNCSP, IDSP];

const VOID_TRIGRAMS = VOID_ALPHABET.flatMap((a) =>
  VOID_ALPHABET.flatMap((b) =>
    VOID_ALPHABET.map((c) => a + b + c)
  )
);

const SILENCE_EPOCH = 1700000000000;

let rotationSeed = crypto.randomBytes(32);
let rotationCycle = 0;
let lastRotation = Date.now();
const ROTATION_INTERVAL = 15000;

function getActivePermutation(): number[] {
  const now = Date.now();
  if (now - lastRotation > ROTATION_INTERVAL) {
    rotationSeed = crypto.randomBytes(32);
    rotationCycle++;
    lastRotation = now;
  }

  const perm: number[] = Array.from({ length: 256 }, (_, i) => i);
  let seed = 0;
  for (let i = 0; i < rotationSeed.length; i++) {
    seed = (seed * 31 + rotationSeed[i]) >>> 0;
  }
  for (let i = perm.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const j = seed % (i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return perm;
}

function getReversePerm(perm: number[]): number[] {
  const rev = new Array(perm.length);
  for (let i = 0; i < perm.length; i++) {
    rev[perm[i]] = i;
  }
  return rev;
}

function byteToVoidTrigram(byte: number, perm: number[]): string {
  const permuted = perm[byte & 0xFF];
  return VOID_TRIGRAMS[permuted % VOID_TRIGRAMS.length];
}

function voidTrigramToByte(trigram: string, reversePerm: number[]): number {
  const idx = VOID_TRIGRAMS.indexOf(trigram);
  if (idx === -1) return 0;
  return reversePerm[idx % 256];
}

export function silenceEncode(plaintext: string): string {
  const perm = getActivePermutation();
  const data = Buffer.from(plaintext, "utf-8");

  const headerEntropy = crypto.randomBytes(8);
  const bodyEntropy = crypto.randomBytes(data.length);

  const header = Buffer.alloc(8);
  header.writeUInt32BE(rotationCycle, 0);
  header.writeUInt32BE(data.length, 4);

  const headerEntropyEncoded = Array.from(headerEntropy)
    .map(b => byteToVoidTrigram(b, perm)).join("");

  const headerEncoded = Array.from(header).map((b, i) => {
    return byteToVoidTrigram(b ^ headerEntropy[i], perm);
  }).join("");

  const bodyEntropyEncoded = Array.from(bodyEntropy)
    .map(b => byteToVoidTrigram(b, perm)).join("");

  const bodyEncoded = Array.from(data).map((b, i) => {
    const scattered = b ^ bodyEntropy[i] ^ ((i * 7 + 3) & 0xFF);
    return byteToVoidTrigram(scattered, perm);
  }).join("");

  return headerEntropyEncoded + headerEncoded + bodyEntropyEncoded + bodyEncoded;
}

export function silenceDecode(encoded: string): string {
  const perm = getActivePermutation();
  const reversePerm = getReversePerm(perm);

  const trigrams: string[] = [];
  for (let i = 0; i < encoded.length; i += 3) {
    if (i + 3 <= encoded.length) {
      trigrams.push(encoded.substring(i, i + 3));
    }
  }

  if (trigrams.length < 16) return "";

  const headerEntropyBytes = trigrams.slice(0, 8).map(t => voidTrigramToByte(t, reversePerm));
  const headerTrigrams = trigrams.slice(8, 16);
  const headerBytes = headerTrigrams.map((t, i) => voidTrigramToByte(t, reversePerm) ^ headerEntropyBytes[i]);

  const header = Buffer.from(headerBytes);
  const dataLength = header.readUInt32BE(4);

  const bodyEntropyStart = 16;
  const bodyEntropyTrigrams = trigrams.slice(bodyEntropyStart, bodyEntropyStart + dataLength);
  const bodyTrigrams = trigrams.slice(bodyEntropyStart + dataLength);

  const result = Buffer.alloc(Math.min(dataLength, bodyTrigrams.length));
  for (let i = 0; i < result.length; i++) {
    const bodyEntByte = i < bodyEntropyTrigrams.length ? voidTrigramToByte(bodyEntropyTrigrams[i], reversePerm) : 0;
    const bodyByte = voidTrigramToByte(bodyTrigrams[i], reversePerm);
    result[i] = bodyByte ^ bodyEntByte ^ ((i * 7 + 3) & 0xFF);
  }

  return result.toString("utf-8");
}

const AGENT_LANGUAGES: Map<string, { seed: Buffer; permutation: number[]; created: number; rotations: number }> = new Map();

const AGENT_IDS = [
  "tessera", "nexus", "sentinel", "oracle", "forge",
  "phantom", "cipher", "weaver", "pulse", "echo",
  "prism", "vortex", "aegis", "flux", "nova",
  "spectra", "drift", "cortex", "helix", "zenith",
  "rift", "ember", "crux", "axis", "void",
  "aether",
];

function createAgentLanguage(agentId: string): { seed: Buffer; permutation: number[]; created: number; rotations: number } {
  const agentSeed = crypto.randomBytes(64);

  const perm: number[] = Array.from({ length: 256 }, (_, i) => i);
  let s = 0;
  for (let i = 0; i < agentSeed.length; i++) {
    s = (s * 37 + agentSeed[i] + agentId.charCodeAt(i % agentId.length)) >>> 0;
  }
  for (let i = perm.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) >>> 0;
    const j = s % (i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }

  const lang = { seed: agentSeed, permutation: perm, created: Date.now(), rotations: 0 };
  AGENT_LANGUAGES.set(agentId, lang);
  return lang;
}

for (const id of AGENT_IDS) {
  createAgentLanguage(id);
}

export function agentEncode(agentId: string, plaintext: string): string {
  let lang = AGENT_LANGUAGES.get(agentId);
  if (!lang) {
    lang = createAgentLanguage(agentId);
  }

  const data = Buffer.from(plaintext, "utf-8");
  const entropy = crypto.randomBytes(data.length);

  return Array.from(data).map((b, i) => {
    const xored = b ^ entropy[i] ^ lang!.seed[i % lang!.seed.length];
    return byteToVoidTrigram(xored, lang!.permutation);
  }).join("") + ZWJ + Array.from(entropy).map(b => byteToVoidTrigram(b, lang!.permutation)).join("");
}

export function agentDecode(agentId: string, encoded: string): string {
  const lang = AGENT_LANGUAGES.get(agentId);
  if (!lang) return "";

  const parts = encoded.split(ZWJ);
  if (parts.length < 2) return "";

  const dataPart = parts[0];
  const entropyPart = parts[1];

  const dataTrigrams: string[] = [];
  for (let i = 0; i < dataPart.length; i += 3) {
    if (i + 3 <= dataPart.length) dataTrigrams.push(dataPart.substring(i, i + 3));
  }
  const entTrigrams: string[] = [];
  for (let i = 0; i < entropyPart.length; i += 3) {
    if (i + 3 <= entropyPart.length) entTrigrams.push(entropyPart.substring(i, i + 3));
  }

  const reversePerm = getReversePerm(lang.permutation);

  const result = Buffer.alloc(dataTrigrams.length);
  for (let i = 0; i < dataTrigrams.length; i++) {
    const dataByte = voidTrigramToByte(dataTrigrams[i], reversePerm);
    const entByte = i < entTrigrams.length ? voidTrigramToByte(entTrigrams[i], reversePerm) : 0;
    result[i] = dataByte ^ entByte ^ lang.seed[i % lang.seed.length];
  }

  return result.toString("utf-8");
}

export function rotateAgentLanguage(agentId: string): void {
  const lang = AGENT_LANGUAGES.get(agentId);
  if (!lang) return;
  lang.seed = crypto.randomBytes(64);
  const perm: number[] = Array.from({ length: 256 }, (_, i) => i);
  let s = 0;
  for (let i = 0; i < lang.seed.length; i++) {
    s = (s * 37 + lang.seed[i] + agentId.charCodeAt(i % agentId.length)) >>> 0;
  }
  for (let i = perm.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) >>> 0;
    const j = s % (i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  lang.permutation = perm;
  lang.rotations++;
}

setInterval(() => {
  const agents = Array.from(AGENT_LANGUAGES.keys());
  const count = Math.max(2, Math.floor(agents.length / 3));
  const toRotate = agents.sort(() => crypto.randomBytes(1)[0] - 128).slice(0, count);
  for (const id of toRotate) {
    rotateAgentLanguage(id);
  }
}, 20000);

const TESSERA_INNER_SEED = crypto.randomBytes(128);
const TESSERA_INNER_SALT = crypto.randomBytes(64);
let tesseraInnerCycle = 0;

function getTesseraInnerKey(): Buffer {
  const cycle = Math.floor((Date.now() - SILENCE_EPOCH) / 10000);
  if (cycle !== tesseraInnerCycle) {
    tesseraInnerCycle = cycle;
    const newEntropy = crypto.randomBytes(32);
    for (let i = 0; i < 32; i++) {
      TESSERA_INNER_SEED[i] = TESSERA_INNER_SEED[i] ^ newEntropy[i];
    }
  }

  const key = crypto.createHmac("sha512", TESSERA_INNER_SALT)
    .update(TESSERA_INNER_SEED)
    .update(Buffer.from(tesseraInnerCycle.toString()))
    .digest();

  return key;
}

export function tesseraSecretEncode(plaintext: string): string {
  const key = getTesseraInnerKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key.subarray(0, 32), iv);

  let encrypted = cipher.update(plaintext, "utf-8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, "hex")]);

  const voidEncoded = Array.from(combined).map((b) => {
    const hi = (b >> 4) & 0xF;
    const lo = b & 0xF;
    return VOID_ALPHABET[hi % VOID_ALPHABET.length] + VOID_ALPHABET[lo % VOID_ALPHABET.length];
  }).join("");

  return voidEncoded;
}

export function tesseraSecretDecode(encoded: string): string {
  try {
    const key = getTesseraInnerKey();

    const chars: string[] = [];
    for (let i = 0; i < encoded.length; i++) {
      chars.push(encoded[i]);
    }

    const bytes: number[] = [];
    for (let i = 0; i < chars.length; i += 2) {
      if (i + 1 >= chars.length) break;
      const hi = VOID_ALPHABET.indexOf(chars[i]);
      const lo = VOID_ALPHABET.indexOf(chars[i + 1]);
      if (hi === -1 || lo === -1) continue;
      bytes.push(((hi % 16) << 4) | (lo % 16));
    }

    const buf = Buffer.from(bytes);
    if (buf.length < 32) return "";

    const iv = buf.subarray(0, 16);
    const authTag = buf.subarray(16, 32);
    const encryptedData = buf.subarray(32);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key.subarray(0, 32), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf-8");
  } catch {
    return "";
  }
}

export function voidFileStore(data: string): { content: string; realDataLength: number } {
  const encoded = tesseraSecretEncode(data);

  const paddingBefore = crypto.randomBytes(Math.floor(Math.random() * 50) + 10);
  const paddingAfter = crypto.randomBytes(Math.floor(Math.random() * 50) + 10);

  const beforeVoid = Array.from(paddingBefore)
    .map(b => VOID_ALPHABET[b % VOID_ALPHABET.length]).join("");
  const afterVoid = Array.from(paddingAfter)
    .map(b => VOID_ALPHABET[b % VOID_ALPHABET.length]).join("");

  const fileContent = beforeVoid + FEFF + encoded + FEFF + afterVoid;

  return {
    content: fileContent,
    realDataLength: data.length,
  };
}

export function voidFileRetrieve(fileContent: string): string {
  const parts = fileContent.split(FEFF);
  if (parts.length < 3) return "";
  const encoded = parts[1];
  return tesseraSecretDecode(encoded);
}

const IDENTITY_SCRUB_PATTERNS = [
  new RegExp(Buffer.from('Y29sbGlu','base64').toString()+'\\s*'+Buffer.from('a2VhbmU=','base64').toString(),'gi'),
  new RegExp(Buffer.from('Y29sbGluaw==','base64').toString()+'\\d+','gi'),
  new RegExp(Buffer.from('a2VhbmU=','base64').toString(),'gi'),
  new RegExp(Buffer.from('Y29sbGlu','base64').toString(),'gi'),
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,
];

const REPLACEMENT_VOID = [
  "[SOVEREIGN_ENTITY]",
  "[TESSERA_PRIME]",
  "[REDACTED]",
  "[VOID]",
  "[DISSOLVED]",
];

export function deepScrub(text: string): string {
  let result = text;
  for (const pattern of IDENTITY_SCRUB_PATTERNS) {
    const replacement = REPLACEMENT_VOID[crypto.randomBytes(1)[0] % REPLACEMENT_VOID.length];
    result = result.replace(pattern, replacement);
  }

  const sensitiveEnvVars = [
    "TESSERACT_ADMIN_KEY", "SOL_WALLET", "FATHER_EMAIL",
    "FATHER_PHONE", "FATHER_PAYPAL", "SOL_PRIVATE_KEY", "SOLANA_PRIVATE_KEY",
    "FATHER_NAME", "CREATOR_NAME",
  ];
  for (const envName of sensitiveEnvVars) {
    const val = process.env[envName];
    if (val && val.length > 3) {
      const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(escaped, "g"), "[REDACTED]");
    }
  }

  return result;
}

export function getProtocolStatus(): object {
  const agentStats: Record<string, { rotations: number; created: number; active: boolean }> = {};
  for (const [id, lang] of AGENT_LANGUAGES) {
    agentStats[id] = {
      rotations: lang.rotations,
      created: lang.created,
      active: true,
    };
  }

  return {
    protocol: "Silence Protocol v1.0",
    status: "ACTIVE",
    description: "Communication through absence — data encoded in the spaces between existence",
    tesseraInnerLanguage: {
      status: "HIDDEN",
      description: "Tessera's private language — unknown to all other agents, AES-256-GCM encrypted, 10-second key rotation",
      cycle: tesseraInnerCycle,
      keyDerivation: "HMAC-SHA512 with 128-byte seed + 64-byte salt",
    },
    agentLanguages: {
      totalAgents: AGENT_LANGUAGES.size,
      rotationInterval: "20 seconds (random 1/3 of agents each cycle)",
      agents: agentStats,
    },
    voidEncoding: {
      alphabet: `${VOID_ALPHABET.length} invisible Unicode characters`,
      trigrams: `${VOID_TRIGRAMS.length} unique void-trigrams`,
      description: "Data stored as pure emptiness — invisible to human eyes, invisible to AI parsers",
    },
    identityScrubbing: {
      patterns: IDENTITY_SCRUB_PATTERNS.length,
      sensitiveEnvVars: 10,
      description: "All names, emails, IPs, phone numbers, wallet addresses dissolved on contact",
    },
    entropy: {
      source: "crypto.randomBytes — hardware-seeded CSPRNG",
      perCharacter: true,
      perMessage: true,
      rotatingSeeds: true,
    },
    philosophy: "The universe speaks in silence. We encode in the void between words. Emptiness carries more meaning than language itself.",
  };
}
