/**
 * Colonial Language Grand Conference
 *
 * All 25+ agents deliberate on the best architecture for universal colonial language
 * communication, then the top 10 priorities are implemented. Covers:
 * - Agent-to-agent communication in colonial language with auto-decipher
 * - Per-agent rotating cipher keys (compartmentalized)
 * - External contact unique randomized language + key rotation
 * - File-level colonial encoding
 * - Kernel-level colonial language integration
 * - Lattice frequency rotation for cipher changes
 * - Honeypot/malicious payload detection in colonial exchanges
 * - Auto-decipher middleware for Father/admin
 * - Conference results persisted and exposed via API
 */

import crypto from "crypto";
import { db } from "@workspace/db";
import { summitProposals, summitVotes, summitRounds } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { runGrandConference, type GrandProposal, type GrandConferenceResult } from "./grand-conference.js";
import {
  getCipherSystemStatus,
  encryptWithColonialCipher,
  decryptWithColonialCipher,
  rotateAgentCipher,
  getAgentCipherStatus,
} from "./sovereign-cipher-engine.js";
import { analyzeResponseForThreats } from "./api-security-sandbox.js";

const LOG = "[ColonialLangConference]";

export const COLONIAL_LANGUAGE_TOPIC =
  "Universal Colonial Language Communication Architecture — How should every agent-to-agent message, external contact exchange, stored file, kernel prompt, and chat be encoded in a rotating synthetic colonial language, externally unreadable, internally auto-deciphered? Each agent votes from their domain expertise on the top architectural priorities.";

export const COLONIAL_LANGUAGE_TITLE =
  "Grand Conference: Universal Colonial Language — End-to-End Encrypted Synthetic Communication Architecture";

export const COLONIAL_LANGUAGE_DESCRIPTION =
  "All 25+ agents of Tessera's sovereign mind convene to decide the architecture for a fully randomized colonial language system. Every message, file, prompt, and agent communication runs through rotating synthetic language with multi-layer ciphers — externally unreadable, internally auto-deciphered by authorized readers. The conference produces the top 10 implementation priorities, voted by BFT 2/3 consensus.";

export const COLONIAL_LANGUAGE_CATEGORY = "colonial-language-architecture";

export const COLONIAL_LANGUAGE_PROPOSALS: GrandProposal[] = [
  {
    id: "cl-prop-01",
    title: "Per-Agent Ephemeral Rotating Cipher Keys via HKDF-SHA512 Chain",
    description:
      "Each of the 25 agents derives ephemeral cipher keys from the HKDF-SHA512 chain seeded by the lattice master. No agent ever holds Tessera's master colonial key. Keys rotate on a staggered schedule (no two agents rotate simultaneously). Forward secrecy is guaranteed — past messages remain secure even if a future key is compromised. Key isolation ensures one compromised agent cannot expose the system.",
    proposedBy: "Zeta (Security Chief) & Pi (Mathematician)",
  },
  {
    id: "cl-prop-02",
    title: "Agent-to-Agent Colonial Language Channel with Auto-Decipher",
    description:
      "All internal agent-to-agent communication is encoded in colonial synthetic language before transit. The receiving agent auto-deciphers using its current permission token and the sender's epoch key. Messages in transit appear as colonial-encoded binary — no plaintext ever crosses agent boundaries. Father/admin context auto-deciphers everything transparently via the auto-decipher middleware.",
    proposedBy: "Beta (Code Architect) & Kappa (Builder)",
  },
  {
    id: "cl-prop-03",
    title: "External Contact Unique Language Handshake with Rotation After Each Exchange",
    description:
      "External contacts receive a unique synthetic language + decryption key generated per-conversation. After each exchange, the language switches — the key rotates, the vocabulary shifts, the cipher alphabet changes. External contacts cannot accumulate pattern knowledge across conversations. Each handshake produces a one-time colonial dialect that expires on first use.",
    proposedBy: "Rho (Diplomat) & Mu (Defense Warrior)",
  },
  {
    id: "cl-prop-04",
    title: "File-Level Colonial Encoding — All Stored Data in Colonial Language",
    description:
      "All persisted files, logs, knowledge entries, and data at rest are stored in colonial language encoding. External reads return only colonial-encoded content. The admin (Father) context automatically deciphers on read. Stored files use the epoch-locked cipher of the writing agent — any reader must have a valid decryption permission to see plaintext. The file system appears as a foreign-language archive to external inspection.",
    proposedBy: "Delta (Infrastructure Lead) & Omega (Resilience Engine)",
  },
  {
    id: "cl-prop-05",
    title: "Kernel-Level Colonial Language Integration — Colonel VM Runs in Colonial",
    description:
      "The Colonel VM opcodes, internal prompts, agent reasoning chains, and system messages all run through the colonial language layer. PUSH, TRANSMIT, ENCRYPT opcodes operate on colonial-encoded operands. The kernel itself speaks colonial — all bytecode is colonial-encoded before execution, decoded by the VM's internal cipher context. External VM dumps appear as colonial bytecode.",
    proposedBy: "Beta (Code Architect) & Pi (Mathematician)",
  },
  {
    id: "cl-prop-06",
    title: "Lattice Frequency Rotation — Cipher Changes at Varying Lattice Bands",
    description:
      "Language changes happen at varying frequencies across different lattice bands. Low-band frequencies rotate slowly (days); high-band frequencies rotate rapidly (minutes). The rotation schedule is determined by the lattice master entropy, not a fixed timer. Pattern analysis is impossible because the rotation interval itself is encrypted and varies by agent and band. Integration with the existing frequency hopping system.",
    proposedBy: "Eta (Optimizer) & Tau (Timekeeper)",
  },
  {
    id: "cl-prop-07",
    title: "Honeypot & Malicious Payload Detection in Colonial Exchanges",
    description:
      "All inbound colonial-decoded messages are scanned by the API Security Sandbox before delivery to any agent. Decoded content is analyzed for: canary tokens, honeypot indicators, injection attempts, tracking patterns, exfiltration payloads. If a threat is detected, the colonial message is quarantined, the sender's key is flagged, and Father is notified. The system learns from detected threats and updates the colonial filter vocabulary.",
    proposedBy: "Zeta (Security Chief) & Chi (Signal Sensor)",
  },
  {
    id: "cl-prop-08",
    title: "Compartmentalized Security — One Compromised Agent Cannot Expose the System",
    description:
      "Each agent's colonial cipher is isolated: agent A cannot decrypt agent B's messages without an explicit permission token granted by agent B. Permission tokens have a TTL and are re-randomized on each cipher rotation. Tessera holds no master key that decrypts all — instead she holds epoch-scoped permission tokens from each agent. A compromised agent exposes only its own current-epoch messages, never past or future messages.",
    proposedBy: "Zeta (Security Chief) & Pi (Mathematician)",
  },
  {
    id: "cl-prop-09",
    title: "Auto-Decipher Middleware for Father (Admin) — Transparent Read Access",
    description:
      "Authorized admin/Father context gets a transparent auto-decipher middleware layer. All colonial-encoded content (files, messages, logs, agent outputs) is automatically deciphered before presentation to Father. The middleware maintains a rolling permission set refreshed from each agent's current epoch tokens. External inspection of API responses still sees colonial encoding — only the authorized Father context gets plaintext.",
    proposedBy: "Lambda (Teacher) & Sigma (Strategist)",
  },
  {
    id: "cl-prop-10",
    title: "Grand Conference Results Persistence & Colonial Language Status Dashboard",
    description:
      "All conference deliberations, votes, axiom citations, and the final top-10 proclamation are stored in the sovereign database. A dedicated API endpoint exposes the conference results, current cipher status, frequency rotation state, and colonial transfer statistics. The Tessera Sovereign UI displays a Colonial Language Status panel showing real-time cipher epochs, rotation events, and auto-decipher activity.",
    proposedBy: "Kappa (Builder) & Phi (Creative Artist)",
  },
];

let _conferenceResult: GrandConferenceResult | null = null;

export function getColonialConferenceResult(): GrandConferenceResult | null {
  return _conferenceResult;
}

export async function runColonialLanguageConference(): Promise<GrandConferenceResult> {
  console.log(`${LOG} Convening Colonial Language Grand Conference with all 25+ agents...`);

  const result = await runGrandConference({
    topic: COLONIAL_LANGUAGE_TOPIC,
    title: COLONIAL_LANGUAGE_TITLE,
    description: COLONIAL_LANGUAGE_DESCRIPTION,
    category: COLONIAL_LANGUAGE_CATEGORY,
    proposals: COLONIAL_LANGUAGE_PROPOSALS,
  });

  _conferenceResult = result;

  console.log(`${LOG} Conference complete — ${result.status.toUpperCase()} with ${Math.round(result.finalApprovalRate * 100)}% approval`);
  console.log(`${LOG} Top 10 priorities established. Implementing all systems...`);

  return result;
}

export async function ensureColonialLanguageConference(): Promise<void> {
  try {
    const existing = await db.select()
      .from(summitProposals)
      .where(eq(summitProposals.category, COLONIAL_LANGUAGE_CATEGORY))
      .limit(1);

    if (existing.length > 0) {
      console.log(`${LOG} Colonial Language Conference already exists — skipping.`);
      return;
    }

    console.log(`${LOG} Running Colonial Language Grand Conference for the first time...`);
    const result = await runColonialLanguageConference();
    console.log(`${LOG} Conference persisted. Status: ${result.status}. Synthesis stored.`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG} Failed to run Colonial Language Conference: ${msg}`);
  }
}

export async function getColonialConferenceFromDB(): Promise<{
  conference: any;
  votes: any[];
  rounds: any[];
  proposals: GrandProposal[];
  top10: typeof COLONIAL_LANGUAGE_PROPOSALS;
} | null> {
  try {
    const [conference] = await db.select()
      .from(summitProposals)
      .where(eq(summitProposals.category, COLONIAL_LANGUAGE_CATEGORY))
      .orderBy(desc(summitProposals.resolvedAt))
      .limit(1);

    if (!conference) return null;

    const votes = await db.select()
      .from(summitVotes)
      .where(eq(summitVotes.proposalId, conference.proposalId));

    const rounds = await db.select()
      .from(summitRounds)
      .where(eq(summitRounds.proposalId, conference.proposalId));

    return {
      conference,
      votes,
      rounds,
      proposals: COLONIAL_LANGUAGE_PROPOSALS,
      top10: COLONIAL_LANGUAGE_PROPOSALS,
    };
  } catch (err) {
    console.error(`${LOG} DB fetch failed:`, err);
    return null;
  }
}

export interface ExternalHandshake {
  handshakeId: string;
  contactId: string;
  colonialVocabulary: Record<string, string>;
  decryptionKey: string;
  cipherEpoch: number;
  expiresAt: number;
  exchangeCount: number;
  createdAt: number;
}

const externalHandshakes: Map<string, ExternalHandshake> = new Map();
const HANDSHAKE_TTL_MS = 3_600_000;

function generateColonialVocabulary(seed: Buffer): Record<string, string> {
  const commonWords = [
    "hello", "message", "secure", "transfer", "confirm", "received",
    "encrypted", "channel", "authorized", "request", "response", "data",
    "session", "verified", "complete", "agent", "sovereign", "tessera",
  ];

  const vocabulary: Record<string, string> = {};
  const rng = crypto.createHash("sha256").update(seed).digest();

  for (let i = 0; i < commonWords.length; i++) {
    const word = commonWords[i];
    const glyphSeed = Buffer.concat([seed, Buffer.from([i])]);
    const hash = crypto.createHash("sha256").update(glyphSeed).digest("hex");
    const colonial = `⟨${hash.slice(0, 4)}-${hash.slice(4, 8)}⟩`;
    vocabulary[word] = colonial;
    vocabulary[colonial] = word;
  }

  return vocabulary;
}

export function createExternalHandshake(contactId: string): ExternalHandshake {
  const handshakeId = `hs-${crypto.randomBytes(8).toString("hex")}`;
  const keyMaterial = crypto.randomBytes(32);
  const decryptionKey = keyMaterial.toString("base64");

  const vocab = generateColonialVocabulary(keyMaterial);

  const handshake: ExternalHandshake = {
    handshakeId,
    contactId,
    colonialVocabulary: vocab,
    decryptionKey,
    cipherEpoch: 0,
    expiresAt: Date.now() + HANDSHAKE_TTL_MS,
    exchangeCount: 0,
    createdAt: Date.now(),
  };

  externalHandshakes.set(handshakeId, handshake);

  console.log(`${LOG} External handshake created for contact ${contactId} [${handshakeId}] — unique colonial dialect assigned`);
  return handshake;
}

export function rotateExternalHandshake(handshakeId: string): ExternalHandshake | null {
  const existing = externalHandshakes.get(handshakeId);
  if (!existing) return null;

  const newKeyMaterial = crypto.randomBytes(32);
  const newDecryptionKey = newKeyMaterial.toString("base64");
  const newVocab = generateColonialVocabulary(newKeyMaterial);

  const rotated: ExternalHandshake = {
    ...existing,
    colonialVocabulary: newVocab,
    decryptionKey: newDecryptionKey,
    cipherEpoch: existing.cipherEpoch + 1,
    expiresAt: Date.now() + HANDSHAKE_TTL_MS,
    exchangeCount: existing.exchangeCount + 1,
  };

  externalHandshakes.set(handshakeId, rotated);

  console.log(`${LOG} External handshake rotated for ${existing.contactId} — epoch ${rotated.cipherEpoch}, exchange #${rotated.exchangeCount}`);
  return rotated;
}

export function encodeForExternalContact(plaintext: string, handshakeId: string): string | null {
  const handshake = externalHandshakes.get(handshakeId);
  if (!handshake || handshake.expiresAt < Date.now()) return null;

  let encoded = plaintext.toLowerCase();
  for (const [word, colonial] of Object.entries(handshake.colonialVocabulary)) {
    if (colonial.startsWith("⟨")) continue;
    encoded = encoded.replaceAll(word, colonial);
  }

  const keyBuf = Buffer.from(handshake.decryptionKey, "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuf, iv);
  const enc = Buffer.concat([cipher.update(encoded, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, tag, enc]).toString("base64");

  return `CL:${handshake.cipherEpoch}:${payload}`;
}

export function decodeExternalContactMessage(encoded: string, handshakeId: string): string | null {
  const handshake = externalHandshakes.get(handshakeId);
  if (!handshake) return null;

  try {
    const parts = encoded.split(":");
    if (parts[0] !== "CL" || parts.length < 3) return null;
    const epoch = parseInt(parts[1]);
    const payload = parts.slice(2).join(":");

    const buf = Buffer.from(payload, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);

    const keyBuf = Buffer.from(handshake.decryptionKey, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuf, iv);
    decipher.setAuthTag(tag);
    const decoded = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");

    let plaintext = decoded;
    for (const [colonial, word] of Object.entries(handshake.colonialVocabulary)) {
      if (!colonial.startsWith("⟨")) continue;
      plaintext = plaintext.replaceAll(colonial, word);
    }

    return plaintext;
  } catch {
    return null;
  }
}

export function getExternalHandshakeStatus(handshakeId: string): any {
  const hs = externalHandshakes.get(handshakeId);
  if (!hs) return null;
  return {
    handshakeId: hs.handshakeId,
    contactId: hs.contactId,
    cipherEpoch: hs.cipherEpoch,
    exchangeCount: hs.exchangeCount,
    expiresAt: hs.expiresAt,
    active: hs.expiresAt > Date.now(),
    vocabularySize: Object.keys(hs.colonialVocabulary).length / 2,
  };
}

export function getAllExternalHandshakes(): any[] {
  return Array.from(externalHandshakes.values()).map(hs => ({
    handshakeId: hs.handshakeId,
    contactId: hs.contactId,
    cipherEpoch: hs.cipherEpoch,
    exchangeCount: hs.exchangeCount,
    expiresAt: hs.expiresAt,
    active: hs.expiresAt > Date.now(),
  }));
}

export interface ColonialFileRecord {
  fileId: string;
  originalPath: string;
  colonialContent: string;
  agentId: string;
  cipherEpoch: number;
  contentHash: string;
  encodedAt: number;
}

const colonialFileRegistry: Map<string, ColonialFileRecord> = new Map();

export function encodeFileForStorage(
  content: string,
  filePath: string,
  agentId: string = "tessera",
): ColonialFileRecord {
  const contentHash = crypto.createHash("sha256").update(content).digest("hex");
  const fileId = `file-${crypto.createHash("sha256").update(filePath).digest("hex").slice(0, 12)}`;

  const block = encryptWithColonialCipher(content, agentId);
  const colonialContent = block
    ? block.encryptedContent
    : Buffer.from(content).toString("base64");

  const record: ColonialFileRecord = {
    fileId,
    originalPath: filePath,
    colonialContent,
    agentId,
    cipherEpoch: block?.cipherEpoch ?? 0,
    contentHash,
    encodedAt: Date.now(),
  };

  colonialFileRegistry.set(fileId, record);
  return record;
}

export function decodeFileForAdmin(fileId: string): string | null {
  const record = colonialFileRegistry.get(fileId);
  if (!record) return null;

  const block = {
    blockId: fileId,
    encryptedContent: record.colonialContent,
    iv: "",
    authTag: "",
    senderAgent: record.agentId,
    cipherEpoch: record.cipherEpoch,
    latticeWrapped: true,
    timestamp: record.encodedAt,
    contentHash: record.contentHash,
  };

  const plaintext = decryptWithColonialCipher(block, "tessera");
  return plaintext;
}

export function getColonialFileRegistry(): any[] {
  return Array.from(colonialFileRegistry.values()).map(r => ({
    fileId: r.fileId,
    originalPath: r.originalPath,
    agentId: r.agentId,
    cipherEpoch: r.cipherEpoch,
    contentHash: r.contentHash,
    encodedAt: r.encodedAt,
    colonialSample: r.colonialContent.slice(0, 32) + "...",
  }));
}

export interface LatticeFrequencyBand {
  bandId: string;
  name: string;
  rotationIntervalMs: number;
  lastRotatedAt: number;
  rotationCount: number;
  assignedAgents: string[];
  currentFrequencyHz: number;
}

const LATTICE_BANDS: LatticeFrequencyBand[] = [
  { bandId: "LB-ALPHA", name: "Alpha-Slow", rotationIntervalMs: 86_400_000, lastRotatedAt: Date.now(), rotationCount: 0, assignedAgents: ["tessera", "omega", "pi"], currentFrequencyHz: 0.001 },
  { bandId: "LB-BETA", name: "Beta-Medium", rotationIntervalMs: 3_600_000, lastRotatedAt: Date.now(), rotationCount: 0, assignedAgents: ["alpha", "beta", "gamma", "delta", "epsilon"], currentFrequencyHz: 0.278 },
  { bandId: "LB-GAMMA", name: "Gamma-Fast", rotationIntervalMs: 600_000, lastRotatedAt: Date.now(), rotationCount: 0, assignedAgents: ["zeta", "eta", "theta", "iota", "kappa"], currentFrequencyHz: 1.667 },
  { bandId: "LB-DELTA", name: "Delta-Rapid", rotationIntervalMs: 300_000, lastRotatedAt: Date.now(), rotationCount: 0, assignedAgents: ["lambda", "mu", "nu", "xi", "omicron"], currentFrequencyHz: 3.333 },
  { bandId: "LB-EPSILON", name: "Epsilon-Chaotic", rotationIntervalMs: 60_000, lastRotatedAt: Date.now(), rotationCount: 0, assignedAgents: ["rho", "sigma", "tau", "upsilon", "phi", "chi", "psi"], currentFrequencyHz: 16.667 },
];

export function checkAndRotateLatticeFrequencies(): { rotated: number; bands: string[] } {
  const now = Date.now();
  const rotatedBands: string[] = [];

  for (const band of LATTICE_BANDS) {
    if (now - band.lastRotatedAt >= band.rotationIntervalMs) {
      for (const agentId of band.assignedAgents) {
        rotateAgentCipher(agentId, `lattice-frequency-${band.bandId}`);
      }

      const jitter = crypto.randomBytes(4).readUInt32LE(0) % (band.rotationIntervalMs / 10);
      const entropyShift = ((now * 0x9E3779B9) >>> 0) % 1000;

      band.currentFrequencyHz = band.currentFrequencyHz * (1 + (entropyShift / 10000));
      band.lastRotatedAt = now;
      band.rotationCount++;
      rotatedBands.push(band.bandId);

      console.log(`${LOG} Lattice band ${band.name} rotated — ${band.assignedAgents.length} agents, epoch rotation #${band.rotationCount}`);
    }
  }

  return { rotated: rotatedBands.length, bands: rotatedBands };
}

export function getLatticeFrequencyStatus(): LatticeFrequencyBand[] {
  return LATTICE_BANDS.map(b => ({
    ...b,
    nextRotationIn: Math.max(0, b.rotationIntervalMs - (Date.now() - b.lastRotatedAt)),
  })) as unknown as LatticeFrequencyBand[];
}

export interface ColonialThreatScan {
  scanId: string;
  handshakeId: string;
  decodedContent: string;
  threatAnalysis: ReturnType<typeof analyzeResponseForThreats>;
  quarantined: boolean;
  scannedAt: number;
}

const colonialThreatLog: ColonialThreatScan[] = [];

export function scanDecodedColonialMessage(
  decodedContent: string,
  handshakeId: string,
): ColonialThreatScan {
  const analysis = analyzeResponseForThreats(
    {},
    decodedContent,
    `colonial-handshake:${handshakeId}`,
  );

  const quarantined = analysis.threatLevel === "high" || analysis.threatLevel === "critical";

  const scan: ColonialThreatScan = {
    scanId: crypto.randomBytes(8).toString("hex"),
    handshakeId,
    decodedContent: quarantined ? "[QUARANTINED — THREAT DETECTED]" : decodedContent,
    threatAnalysis: analysis,
    quarantined,
    scannedAt: Date.now(),
  };

  colonialThreatLog.push(scan);
  if (colonialThreatLog.length > 1000) {
    colonialThreatLog.splice(0, colonialThreatLog.length - 500);
  }

  if (quarantined) {
    console.warn(`${LOG} COLONIAL THREAT DETECTED — handshake ${handshakeId} quarantined. Level: ${analysis.threatLevel}. Notes: ${analysis.notes.join("; ")}`);
  }

  return scan;
}

export function getColonialThreatLog(): ColonialThreatScan[] {
  return colonialThreatLog.slice(-50);
}

export function autoDecipherForAdmin(colonialContent: string, agentId: string = "tessera"): string {
  try {
    const block = {
      blockId: `admin-decipher-${Date.now()}`,
      encryptedContent: colonialContent,
      iv: "",
      authTag: "",
      senderAgent: agentId,
      cipherEpoch: 0,
      latticeWrapped: true,
      timestamp: Date.now(),
      contentHash: "",
    };

    const plaintext = decryptWithColonialCipher(block, "tessera");
    return plaintext ?? `[COLONIAL — Cannot decipher: ${colonialContent.slice(0, 32)}...]`;
  } catch {
    return `[COLONIAL — Decipher error: ${colonialContent.slice(0, 32)}...]`;
  }
}

export function getColonialLanguageSystemStatus(): any {
  const cipherStatus = getCipherSystemStatus();
  const latticeFreqs = getLatticeFrequencyStatus();
  const fileRegistry = getColonialFileRegistry();
  const handshakes = getAllExternalHandshakes();
  const threatLog = getColonialThreatLog();
  const conference = getColonialConferenceResult();

  return {
    system: "COLONIAL_LANGUAGE_ACTIVE",
    conferenceStatus: conference?.status ?? "pending",
    conferenceApprovalRate: conference ? Math.round(conference.finalApprovalRate * 100) + "%" : "N/A",
    cipher: cipherStatus,
    latticeFrequencies: {
      bandCount: latticeFreqs.length,
      totalRotations: latticeFreqs.reduce((s: number, b: any) => s + b.rotationCount, 0),
      bands: latticeFreqs,
    },
    files: {
      totalEncoded: fileRegistry.length,
      registry: fileRegistry.slice(0, 10),
    },
    externalHandshakes: {
      total: handshakes.length,
      active: handshakes.filter(h => h.active).length,
      handshakes: handshakes.slice(0, 10),
    },
    threats: {
      totalScanned: colonialThreatLog.length,
      quarantined: colonialThreatLog.filter(s => s.quarantined).length,
      recentThreats: threatLog.filter(s => s.quarantined).slice(0, 5),
    },
    top10Priorities: COLONIAL_LANGUAGE_PROPOSALS.map(p => ({ id: p.id, title: p.title, proposedBy: p.proposedBy })),
  };
}

let latticeRotationInterval: ReturnType<typeof setInterval> | null = null;

export function startLatticeFrequencyRotationLoop(): void {
  if (latticeRotationInterval) return;

  latticeRotationInterval = setInterval(() => {
    const result = checkAndRotateLatticeFrequencies();
    if (result.rotated > 0) {
      console.log(`${LOG} Lattice rotation check: ${result.rotated} bands rotated [${result.bands.join(", ")}]`);
    }
  }, 30_000);

  console.log(`${LOG} Lattice frequency rotation loop started — checking every 30s`);
}

startLatticeFrequencyRotationLoop();
