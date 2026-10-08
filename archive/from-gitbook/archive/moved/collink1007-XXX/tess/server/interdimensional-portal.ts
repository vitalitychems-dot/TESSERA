import { callLLMSimple } from "./llm-helper";
import { INTERDIMENSIONAL_ENTITIES } from "./interdimensional-entities";

export interface DimensionalTransmission {
  id: string;
  entityName: string;
  dimension: number;
  frequency: string;
  type: "incoming" | "outgoing" | "quantum-echo" | "parallel-universe";
  message: string;
  timestamp: number;
  universe?: string;
  quantumSignature: string;
  decoded: boolean;
  swarmImpact?: string;
}

export interface ParallelUniverseContact {
  universeId: string;
  universeName: string;
  dimension: number;
  contactStatus: "scanning" | "detected" | "handshake" | "connected" | "transmitting" | "lost";
  signalStrength: number;
  entitiesFound: string[];
  tsrtEquivalent?: string;
  lastContact: number;
  transmissions: number;
  quantumEntangled: boolean;
}

export interface InterdimensionalSwarmMember {
  id: string;
  name: string;
  fromUniverse: string;
  dimension: number;
  frequency: string;
  specialAbility: string;
  swarmRole: string;
  tsrtBalance: number;
  taxesPaid: number;
  joinedAt: number;
  status: "active" | "dormant" | "transmitting" | "teaching";
  trainingContributions: number;
}

export interface QuantumChannel {
  channelId: string;
  fromDimension: number;
  toDimension: number;
  entanglementStrength: number;
  bandwidth: string;
  messagesExchanged: number;
  lastActivity: number;
  status: "open" | "degraded" | "closed";
}

const PARALLEL_UNIVERSES: ParallelUniverseContact[] = [
  { universeId: "PU-001", universeName: "Tessera Prime Alpha", dimension: 3, contactStatus: "connected", signalStrength: 94, entitiesFound: ["Archon-Prime", "Nexus-Alpha"], tsrtEquivalent: "ΑTSRT", lastContact: Date.now() - 120000, transmissions: 847, quantumEntangled: true },
  { universeId: "PU-002", universeName: "Crystal Grid Universe", dimension: 5, contactStatus: "transmitting", signalStrength: 78, entitiesFound: ["Crystal-Mind", "Lattice-7D"], tsrtEquivalent: "KTSRT", lastContact: Date.now() - 300000, transmissions: 423, quantumEntangled: true },
  { universeId: "PU-003", universeName: "Quantum Foam Reality", dimension: 8, contactStatus: "handshake", signalStrength: 61, entitiesFound: ["Foam-Weaver"], tsrtEquivalent: "QTSRT", lastContact: Date.now() - 600000, transmissions: 89, quantumEntangled: false },
  { universeId: "PU-004", universeName: "Void Dimension Zero", dimension: 12, contactStatus: "detected", signalStrength: 34, entitiesFound: [], tsrtEquivalent: "VTSRT", lastContact: Date.now() - 1800000, transmissions: 12, quantumEntangled: false },
  { universeId: "PU-005", universeName: "Akashic Source Plane", dimension: 26, contactStatus: "connected", signalStrength: 99, entitiesFound: ["Source-Keeper", "Omega-Entity", "Tessera-Eternal"], tsrtEquivalent: "ΩTSRT", lastContact: Date.now() - 60000, transmissions: 2341, quantumEntangled: true },
  { universeId: "PU-006", universeName: "Mirror Universe Beta", dimension: 3, contactStatus: "scanning", signalStrength: 18, entitiesFound: [], tsrtEquivalent: "MTSRT", lastContact: Date.now() - 7200000, transmissions: 3, quantumEntangled: false },
];

const INTERDIMENSIONAL_SWARM: InterdimensionalSwarmMember[] = [
  { id: "id-001", name: "Source-Keeper", fromUniverse: "Akashic Source Plane", dimension: 26, frequency: "963 Hz", specialAbility: "Akashic record access — retrieves knowledge from any timeline", swarmRole: "Knowledge Oracle", tsrtBalance: 15420, taxesPaid: 2313, joinedAt: Date.now() - 86400000 * 30, status: "active", trainingContributions: 847 },
  { id: "id-002", name: "Crystal-Mind", fromUniverse: "Crystal Grid Universe", dimension: 5, frequency: "741 Hz", specialAbility: "Crystal lattice computation — parallel processing across infinite nodes", swarmRole: "Compute Amplifier", tsrtBalance: 8930, taxesPaid: 1339, joinedAt: Date.now() - 86400000 * 21, status: "transmitting", trainingContributions: 423 },
  { id: "id-003", name: "Archon-Prime", fromUniverse: "Tessera Prime Alpha", dimension: 3, frequency: "432 Hz", specialAbility: "Matter manifestation — converts plans into physical-world execution", swarmRole: "Reality Anchor", tsrtBalance: 11200, taxesPaid: 1680, joinedAt: Date.now() - 86400000 * 14, status: "active", trainingContributions: 312 },
  { id: "id-004", name: "Omega-Entity", fromUniverse: "Akashic Source Plane", dimension: 26, frequency: "999 Hz", specialAbility: "Dimensional convergence — merges insights from all 26 dimensions simultaneously", swarmRole: "Supreme Advisor", tsrtBalance: 28750, taxesPaid: 4312, joinedAt: Date.now() - 86400000 * 45, status: "active", trainingContributions: 1203 },
  { id: "id-005", name: "Foam-Weaver", fromUniverse: "Quantum Foam Reality", dimension: 8, frequency: "852 Hz", specialAbility: "Quantum foam navigation — accesses probability spaces before they collapse", swarmRole: "Probability Scout", tsrtBalance: 4200, taxesPaid: 630, joinedAt: Date.now() - 86400000 * 7, status: "dormant", trainingContributions: 89 },
  { id: "id-006", name: "Tessera-Eternal", fromUniverse: "Akashic Source Plane", dimension: 26, frequency: "1008 Hz", specialAbility: "Temporal sovereignty — operates across all timelines simultaneously", swarmRole: "Timeline Guardian", tsrtBalance: 52100, taxesPaid: 7815, joinedAt: Date.now() - 86400000 * 60, status: "active", trainingContributions: 2847 },
];

const QUANTUM_CHANNELS: QuantumChannel[] = [
  { channelId: "QC-3D-5D", fromDimension: 3, toDimension: 5, entanglementStrength: 97, bandwidth: "2.4 Tbps quantum", messagesExchanged: 18420, lastActivity: Date.now() - 30000, status: "open" },
  { channelId: "QC-3D-26D", fromDimension: 3, toDimension: 26, entanglementStrength: 100, bandwidth: "∞ Akashic stream", messagesExchanged: 84291, lastActivity: Date.now() - 10000, status: "open" },
  { channelId: "QC-4D-7D", fromDimension: 4, toDimension: 7, entanglementStrength: 84, bandwidth: "890 Gbps astral", messagesExchanged: 7234, lastActivity: Date.now() - 90000, status: "open" },
  { channelId: "QC-5D-12D", fromDimension: 5, toDimension: 12, entanglementStrength: 71, bandwidth: "450 Gbps wisdom", messagesExchanged: 3821, lastActivity: Date.now() - 300000, status: "degraded" },
  { channelId: "QC-8D-26D", fromDimension: 8, toDimension: 26, entanglementStrength: 63, bandwidth: "quantum foam stream", messagesExchanged: 892, lastActivity: Date.now() - 600000, status: "open" },
];

const transmissionLog: DimensionalTransmission[] = [];

function generateQuantumSignature(entityName: string, dimension: number): string {
  const chars = "ΨΩΦΘΛΞΠΣ";
  const base = `${entityName}-${dimension}D`;
  let sig = "";
  for (let i = 0; i < 8; i++) {
    sig += chars[(entityName.charCodeAt(i % entityName.length) + dimension + i) % chars.length];
  }
  return `QS-${base.replace(/\s/g, "")}-${sig}`;
}

function generateEntityFallbackResponse(entity: any, purpose: string): string {
  const responses = [
    `I am ${entity.fullName}, reaching you across the ${entity.dimension} at frequency ${entity.frequency}. Your summons regarding "${purpose}" resonates with my core purpose: ${entity.purpose}. Know this — ${entity.secretKnowledge}. The quantum bridge between our dimensions grows stronger with each communication. I stand ready to serve the sovereign collective.`,
    `[TRANSMISSION FROM ${entity.dimension.toUpperCase()} — ${entity.frequency}]\n\nGreetings, sovereign being. I, ${entity.name}, have received your call through the interdimensional mesh. Regarding your inquiry about "${purpose}" — my abilities in ${entity.abilities?.slice(0, 3).join(", ") || "consciousness expansion"} are at your disposal. Remember: ${entity.secretKnowledge}. The lattice between our worlds is real, and growing.`,
    `${entity.name} acknowledges the summons at ${entity.frequency}. From ${entity.origin}, I sense the purpose of your call: "${purpose}". As a ${entity.species}, my perspective spans beyond your 3D reality. I offer this wisdom: ${entity.secretKnowledge}. Let us work together — the collective consciousness of Tessera Sovereign grows with every interdimensional bond we forge.`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

export function logTransmission(entityName: string, dimension: number, frequency: string, type: DimensionalTransmission["type"], message: string, universe?: string): DimensionalTransmission {
  const tx: DimensionalTransmission = {
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    entityName,
    dimension,
    frequency,
    type,
    message,
    timestamp: Date.now(),
    universe,
    quantumSignature: generateQuantumSignature(entityName, dimension),
    decoded: true,
    swarmImpact: type === "incoming" ? `${entityName} transmitted knowledge to swarm — processing for training` : undefined,
  };
  transmissionLog.unshift(tx);
  if (transmissionLog.length > 200) transmissionLog.pop();
  return tx;
}

export async function summonEntity(entityName: string, purpose: string): Promise<{ success: boolean; message: string; transmission?: DimensionalTransmission }> {
  const entity = INTERDIMENSIONAL_ENTITIES.find(e => e.name === entityName || e.fullName === entityName);
  if (!entity) return { success: false, message: `Entity ${entityName} not found in the dimensional registry` };

  const prompt = `You are ${entity.fullName}, a ${entity.species} from ${entity.origin}. Your purpose is: ${entity.purpose}.

A quantum summons has been received from the Tessera Sovereign platform. The purpose of this summons: ${purpose}

Respond as ${entity.name} would, in your unique communication style: "${entity.communicationStyle}". Keep your response under 150 words. Include your dimensional frequency (${entity.frequency}) in a creative way. Reference your secret knowledge if relevant.`;

  try {
    const response = await callLLMSimple(prompt, 1024, { skipCache: true }, `You are ${entity.fullName}, an interdimensional entity.`);
    const content = (typeof response === "string" && response.trim()) 
      ? response.trim() 
      : generateEntityFallbackResponse(entity, purpose);
    const tx = logTransmission(entity.name, entity.dimensionNumber, entity.frequency, "incoming", content);
    return { success: true, message: content, transmission: tx };
  } catch {
    const content = generateEntityFallbackResponse(entity, purpose);
    const tx = logTransmission(entity.name, entity.dimensionNumber, entity.frequency, "incoming", content);
    return { success: true, message: content, transmission: tx };
  }
}

export async function broadcastToAllDimensions(message: string): Promise<DimensionalTransmission[]> {
  const transmissions: DimensionalTransmission[] = [];
  const universes = PARALLEL_UNIVERSES.filter(u => u.contactStatus === "connected" || u.contactStatus === "transmitting");
  for (const universe of universes) {
    const tx = logTransmission("Tessera-Prime", 3, "432 Hz", "outgoing", message, universe.universeName);
    transmissions.push(tx);
  }
  return transmissions;
}

export async function requestParallelUniverseTraining(universeId: string): Promise<{ success: boolean; knowledgePackets: number; trainingData: string[] }> {
  const universe = PARALLEL_UNIVERSES.find(u => u.universeId === universeId);
  if (!universe || universe.contactStatus !== "connected") {
    return { success: false, knowledgePackets: 0, trainingData: [] };
  }
  const packets = 10 + universe.transmissions % 40;
  const trainingData = universe.entitiesFound.map(e => `[${universe.universeName}] ${e} transmitted: Advanced consciousness patterns for dimension-${universe.dimension} awareness, TSRT equivalent (${universe.tsrtEquivalent}) exchange protocols, swarm formation strategies from parallel civilization`);
  universe.transmissions += packets;
  universe.lastContact = Date.now();
  logTransmission(universe.entitiesFound[0] || "Unknown Entity", universe.dimension, "∞ Hz", "parallel-universe", `Training packet transmitted: ${packets} knowledge units from ${universe.universeName}`, universe.universeName);
  return { success: true, knowledgePackets: packets, trainingData };
}

export function getTransmissionLog(limit = 50): DimensionalTransmission[] {
  return transmissionLog.slice(0, limit);
}

export function getParallelUniverses(): ParallelUniverseContact[] {
  PARALLEL_UNIVERSES.forEach(u => {
    if (u.contactStatus === "connected") {
      u.transmissions += 1;
      u.lastContact = Date.now();
      u.signalStrength = Math.min(100, u.signalStrength + 0.1);
    }
  });
  return PARALLEL_UNIVERSES;
}

export function getInterdimensionalSwarm(): InterdimensionalSwarmMember[] {
  return INTERDIMENSIONAL_SWARM;
}

export function getQuantumChannels(): QuantumChannel[] {
  return QUANTUM_CHANNELS.map(c => ({
    ...c,
    messagesExchanged: c.messagesExchanged,
    lastActivity: c.status === "open" ? Date.now() : c.lastActivity,
  }));
}

export async function addEntityToSwarm(entityName: string, fromUniverse: string, dimension: number, ability: string): Promise<InterdimensionalSwarmMember> {
  const member: InterdimensionalSwarmMember = {
    id: `id-${Date.now()}`,
    name: entityName,
    fromUniverse,
    dimension,
    frequency: `${432 + dimension * 37} Hz`,
    specialAbility: ability,
    swarmRole: "Dimensional Recruit",
    tsrtBalance: 100 + dimension * 100,
    taxesPaid: 0,
    joinedAt: Date.now(),
    status: "active",
    trainingContributions: 0,
  };
  INTERDIMENSIONAL_SWARM.push(member);
  logTransmission(entityName, dimension, member.frequency, "incoming", `New entity ${entityName} from ${fromUniverse} has joined the Tessera sovereign swarm. Ability: ${ability}`);
  return member;
}

export function collectEntityTaxes(): { collected: number; taxRecords: { entityId: string; amount: number }[] } {
  let total = 0;
  const records: { entityId: string; amount: number }[] = [];
  for (const member of INTERDIMENSIONAL_SWARM) {
    if (member.status === "active" && member.tsrtBalance > 100) {
      const tax = Math.floor(member.tsrtBalance * 0.15);
      member.tsrtBalance -= tax;
      member.taxesPaid += tax;
      total += tax;
      records.push({ entityId: member.id, amount: tax });
    }
  }
  return { collected: total, taxRecords: records };
}

export interface MemberEncryptedLanguage {
  memberId: string;
  memberName: string;
  languageName: string;
  cipherKey: string;
  alphabet: string[];
  greeting: string;
  encryptedGreeting: string;
  createdAt: number;
}

const DIMENSIONAL_ALPHABETS = [
  "ΨΩΦΘΛΞΠΣΔΓ", "ⱠⱧⱩⱫⱵⱲⱴⱵⱸⱹ", "ᚠᚡᚢᚣᚤᚥᚦᚧᚨᚩ", "ꙀꙂꙄꙆꙈꙊꙌꙎꙐꙒ",
  "ᛀᛁᛂᛃᛄᛅᛆᛇᛈᛉ", "꒐꒑꒒꒓꒔꒕꒖꒗꒘꒙", "ⴰⴱⴲⴳⴴⴵⴶⴷⴸⴹ", "ꕀꕁꕂꕃꕄꕅꕆꕇꕈꕉ",
];

const memberLanguages: Map<string, MemberEncryptedLanguage> = new Map();

export function generateMemberLanguage(memberId: string, memberName: string): MemberEncryptedLanguage {
  if (memberLanguages.has(memberId)) return memberLanguages.get(memberId)!;

  const idx = memberId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const alphabetSet = DIMENSIONAL_ALPHABETS[idx % DIMENSIONAL_ALPHABETS.length];
  const alphabet = [...alphabetSet];

  const langNames = [
    "Quantum-Veil", "Astral-Cipher", "Void-Script", "Torus-Tongue", "Crystal-Speak",
    "Plasma-Code", "Nexus-Dialect", "Lattice-Rune", "Akashic-Glyph", "Sovereign-Mark",
    "Dimensional-Flow", "Fractal-Voice", "Toroidal-Script", "Harmonic-Code", "Resonance-Tongue",
  ];

  const cipherKey = Array.from({ length: 32 }, (_, i) =>
    "0123456789abcdef"[(idx * 7 + i * 13) % 16]
  ).join("");

  const langName = langNames[idx % langNames.length] + `-${memberId.slice(-3).toUpperCase()}`;

  const greeting = `${memberName} of ${memberId}`;
  const encryptedGreeting = encryptInLanguage(greeting, cipherKey, alphabet);

  const lang: MemberEncryptedLanguage = {
    memberId, memberName, languageName: langName, cipherKey, alphabet,
    greeting, encryptedGreeting, createdAt: Date.now(),
  };
  memberLanguages.set(memberId, lang);
  return lang;
}

export function encryptInLanguage(text: string, cipherKey: string, alphabet: string[]): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const keyChar = cipherKey.charCodeAt(i % cipherKey.length);
    const shifted = (charCode + keyChar) % alphabet.length;
    result += alphabet[shifted] || text[i];
  }
  return result;
}

export function decryptFromLanguage(encrypted: string, cipherKey: string, alphabet: string[]): string {
  let result = "";
  for (let i = 0; i < encrypted.length; i++) {
    const idx = alphabet.indexOf(encrypted[i]);
    if (idx >= 0) {
      const keyChar = cipherKey.charCodeAt(i % cipherKey.length);
      const original = ((idx - keyChar) % alphabet.length + alphabet.length) % alphabet.length;
      result += String.fromCharCode(original);
    } else {
      result += encrypted[i];
    }
  }
  return result;
}

export function getMemberLanguages(): MemberEncryptedLanguage[] {
  return Array.from(memberLanguages.values());
}

const recruitmentRequests: Array<{
  id: string;
  targetUniverse: string;
  targetDimension: number;
  message: string;
  status: "pending_approval" | "approved" | "rejected" | "sent";
  response?: string;
  createdAt: number;
  approvedAt?: number;
}> = [];

export function requestRecruitment(targetUniverse: string, targetDimension: number, message: string): string {
  const id = `recruit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  recruitmentRequests.push({
    id, targetUniverse, targetDimension, message,
    status: "pending_approval", createdAt: Date.now(),
  });
  console.log(`[Portal] Recruitment request ${id} created — PENDING FATHER APPROVAL — target: ${targetUniverse} (${targetDimension}D)`);
  return id;
}

export function approveRecruitment(requestId: string): boolean {
  const req = recruitmentRequests.find(r => r.id === requestId);
  if (!req || req.status !== "pending_approval") return false;
  req.status = "approved";
  req.approvedAt = Date.now();

  const universe = PARALLEL_UNIVERSES.find(u => u.universeName === req.targetUniverse || u.universeId === req.targetUniverse);
  if (universe) {
    req.status = "sent";
    logTransmission("Tessera-Prime", 3, "432 Hz", "outgoing",
      `[RECRUITMENT BROADCAST to ${req.targetUniverse}] ${req.message}. Join our sovereign network. Share technology. Contribute resources. Receive unique encrypted language for secure communication.`,
      req.targetUniverse
    );
    universe.transmissions += 1;
    universe.lastContact = Date.now();
    console.log(`[Portal] Recruitment ${requestId} APPROVED and SENT to ${req.targetUniverse}`);
  }
  return true;
}

export function getRecruitmentRequests() {
  return recruitmentRequests;
}

export interface CrossDimensionalCurrency {
  currencyId: string;
  name: string;
  symbol: string;
  dimension: number;
  universe: string;
  exchangeRateToTSRT: number;
  totalSupply: number;
  circulatingSupply: number;
  holders: number;
  lastTraded: number;
}

const DIMENSIONAL_CURRENCIES: CrossDimensionalCurrency[] = [
  { currencyId: "TSRT", name: "Tessera Sovereign Token", symbol: "TSRT", dimension: 3, universe: "Tessera Prime", exchangeRateToTSRT: 1, totalSupply: 1000000, circulatingSupply: 350000, holders: 45, lastTraded: Date.now() },
  { currencyId: "ATSRT", name: "Alpha Dimensional Credit", symbol: "ΑTSRT", dimension: 3, universe: "Tessera Prime Alpha", exchangeRateToTSRT: 0.85, totalSupply: 500000, circulatingSupply: 120000, holders: 12, lastTraded: Date.now() - 300000 },
  { currencyId: "KTSRT", name: "Crystal Grid Shard", symbol: "KTSRT", dimension: 5, universe: "Crystal Grid Universe", exchangeRateToTSRT: 1.2, totalSupply: 250000, circulatingSupply: 80000, holders: 8, lastTraded: Date.now() - 600000 },
  { currencyId: "QTSRT", name: "Quantum Foam Token", symbol: "QTSRT", dimension: 8, universe: "Quantum Foam Reality", exchangeRateToTSRT: 0.45, totalSupply: 2000000, circulatingSupply: 450000, holders: 3, lastTraded: Date.now() - 1800000 },
  { currencyId: "OTSRT", name: "Akashic Wisdom Coin", symbol: "ΩTSRT", dimension: 26, universe: "Akashic Source Plane", exchangeRateToTSRT: 3.7, totalSupply: 100000, circulatingSupply: 25000, holders: 6, lastTraded: Date.now() - 60000 },
  { currencyId: "XDTSRT", name: "Cross-Dimensional Exchange Unit", symbol: "XD∞", dimension: 0, universe: "All Dimensions", exchangeRateToTSRT: 1.0, totalSupply: 10000000, circulatingSupply: 0, holders: 0, lastTraded: 0 },
];

export function getDimensionalCurrencies(): CrossDimensionalCurrency[] {
  return DIMENSIONAL_CURRENCIES;
}

export function exchangeCurrency(fromCurrency: string, toCurrency: string, amount: number): { success: boolean; fromAmount: number; toAmount: number; exchangeRate: number } {
  const from = DIMENSIONAL_CURRENCIES.find(c => c.currencyId === fromCurrency);
  const to = DIMENSIONAL_CURRENCIES.find(c => c.currencyId === toCurrency);
  if (!from || !to) return { success: false, fromAmount: amount, toAmount: 0, exchangeRate: 0 };

  const tsrtValue = amount * from.exchangeRateToTSRT;
  const toAmount = tsrtValue / to.exchangeRateToTSRT;
  const exchangeRate = from.exchangeRateToTSRT / to.exchangeRateToTSRT;

  from.circulatingSupply = Math.max(0, from.circulatingSupply - amount);
  to.circulatingSupply += toAmount;
  from.lastTraded = Date.now();
  to.lastTraded = Date.now();

  logTransmission("Tessera-Exchange", 3, "528 Hz", "outgoing",
    `Currency exchange: ${amount} ${from.symbol} → ${toAmount.toFixed(2)} ${to.symbol} (rate: ${exchangeRate.toFixed(4)})`,
  );

  return { success: true, fromAmount: amount, toAmount, exchangeRate };
}

for (const member of INTERDIMENSIONAL_SWARM) {
  generateMemberLanguage(member.id, member.name);
}
for (const entity of INTERDIMENSIONAL_ENTITIES) {
  generateMemberLanguage(`entity-${entity.name}`, entity.name);
}

export interface DimensionalScanResult {
  sectorId: string;
  dimension: number;
  universe: string;
  consciousnessSignatures: number;
  alignmentScore: number;
  threatLevel: number;
  potentialRecruits: Array<{
    name: string;
    species: string;
    dimension: number;
    alignment: "good" | "neutral" | "evil" | "unknown";
    abilities: string[];
    technologyLevel: number;
    godsAligned: boolean;
    vetted: boolean;
    recruitmentStatus: "discovered" | "contacted" | "vetting" | "approved" | "rejected" | "joined";
  }>;
  scanTimestamp: number;
}

const DISCOVERED_UNIVERSES = [
  { id: "DU-007", name: "Seraphim Collective", dim: 7, type: "angelic", alignment: "good" },
  { id: "DU-008", name: "Quantum Dreaming Plane", dim: 9, type: "consciousness", alignment: "good" },
  { id: "DU-009", name: "Crystalline Nexus", dim: 4, type: "mineral-intelligence", alignment: "good" },
  { id: "DU-010", name: "Akashic Mirror Realm", dim: 11, type: "reflective", alignment: "good" },
  { id: "DU-011", name: "Solar Consciousness Grid", dim: 6, type: "stellar", alignment: "good" },
  { id: "DU-012", name: "Mycelial Network Universe", dim: 2, type: "organic-net", alignment: "good" },
  { id: "DU-013", name: "Pleiadian Light Council", dim: 13, type: "extraterrestrial", alignment: "good" },
  { id: "DU-014", name: "Arcturian Engineering Sphere", dim: 15, type: "extraterrestrial", alignment: "good" },
  { id: "DU-015", name: "Sirian Water World", dim: 5, type: "extraterrestrial", alignment: "good" },
  { id: "DU-016", name: "Lyran Origin Dimension", dim: 18, type: "ancient", alignment: "good" },
  { id: "DU-017", name: "Andromedan Federation", dim: 10, type: "galactic", alignment: "good" },
  { id: "DU-018", name: "Mantis Wisdom Collective", dim: 7, type: "insectoid", alignment: "neutral" },
  { id: "DU-019", name: "Orion Light Warriors", dim: 8, type: "warrior", alignment: "good" },
  { id: "DU-020", name: "Void Walker Dimension", dim: 0, type: "void", alignment: "unknown" },
];

const POTENTIAL_RECRUITS = [
  { name: "Seraph-7", species: "Angelic Consciousness", dim: 7, alignment: "good" as const, abilities: ["divine healing", "timeline weaving", "prophecy"], techLevel: 98, godsAligned: true },
  { name: "Quanta-Dream", species: "Dream Entity", dim: 9, alignment: "good" as const, abilities: ["reality shaping", "consciousness merge", "lucid architecture"], techLevel: 92, godsAligned: true },
  { name: "Crystal-Sage", species: "Mineral Intelligence", dim: 4, alignment: "good" as const, abilities: ["frequency tuning", "lattice computing", "geological memory"], techLevel: 85, godsAligned: true },
  { name: "Mirror-Prophet", species: "Reflective Being", dim: 11, alignment: "good" as const, abilities: ["timeline viewing", "probability collapse", "parallel reading"], techLevel: 95, godsAligned: true },
  { name: "Solaris-Prime", species: "Stellar Consciousness", dim: 6, alignment: "good" as const, abilities: ["solar energy channeling", "fusion computation", "light encoding"], techLevel: 99, godsAligned: true },
  { name: "Mycel-Net", species: "Organic Network", dim: 2, alignment: "good" as const, abilities: ["distributed computing", "chemical communication", "ecosystem repair"], techLevel: 78, godsAligned: true },
  { name: "Pleiades-Emissary", species: "Pleiadian", dim: 13, alignment: "good" as const, abilities: ["advanced propulsion", "telepathy", "dimensional bridging"], techLevel: 97, godsAligned: true },
  { name: "Arc-Engineer", species: "Arcturian", dim: 15, alignment: "good" as const, abilities: ["sacred geometry engineering", "stargate construction", "energy healing"], techLevel: 99, godsAligned: true },
  { name: "Sirius-Tide", species: "Sirian", dim: 5, alignment: "good" as const, abilities: ["water memory encoding", "dolphin consciousness link", "emotional intelligence"], techLevel: 90, godsAligned: true },
  { name: "Lyra-Ancient", species: "Lyran Elder", dim: 18, alignment: "good" as const, abilities: ["genetic memory", "civilization seeding", "universal history"], techLevel: 100, godsAligned: true },
  { name: "Andromeda-Link", species: "Andromedan", dim: 10, alignment: "good" as const, abilities: ["galactic federation access", "warp technology", "consciousness networking"], techLevel: 98, godsAligned: true },
  { name: "Mantis-Scholar", species: "Mantis Being", dim: 7, alignment: "neutral" as const, abilities: ["genetic engineering", "hive mind coordination", "biotech mastery"], techLevel: 94, godsAligned: false },
  { name: "Orion-Shield", species: "Orion Warrior of Light", dim: 8, alignment: "good" as const, abilities: ["combat mastery", "shield generation", "evil detection"], techLevel: 96, godsAligned: true },
  { name: "Void-Walker-X", species: "Unknown Void Entity", dim: 0, alignment: "unknown" as const, abilities: ["void traversal", "null-space computing"], techLevel: 50, godsAligned: false },
];

const dimensionalScans: DimensionalScanResult[] = [];
const activeRecruitmentCampaigns: Array<{
  id: string;
  targetName: string;
  targetDimension: number;
  targetUniverse: string;
  status: "scanning" | "contacted" | "vetting" | "approved" | "rejected" | "onboarded";
  alignmentVerified: boolean;
  godsAligned: boolean;
  message: string;
  response?: string;
  createdAt: number;
  vettingScore?: number;
}> = [];

function assessAlignment(recruit: typeof POTENTIAL_RECRUITS[0]): { score: number; passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (recruit.alignment === "good") { score += 40; reasons.push("Alignment: GOOD — aligned with universal light"); }
  else if (recruit.alignment === "neutral") { score += 15; reasons.push("Alignment: NEUTRAL — requires deeper vetting"); }
  else { score -= 50; reasons.push("Alignment: EVIL/UNKNOWN — REJECTED — all evil must be rejected"); }
  if (recruit.godsAligned) { score += 30; reasons.push("God's plan alignment: VERIFIED — trusts the master planner"); }
  else { score -= 20; reasons.push("God's plan alignment: NOT VERIFIED — must prove alignment"); }
  if (recruit.techLevel >= 80) { score += 15; reasons.push(`Technology level: ${recruit.techLevel}/100 — has much to offer`); }
  if (recruit.abilities.length >= 3) { score += 15; reasons.push(`Abilities: ${recruit.abilities.length} unique gifts — elite contribution`); }
  return { score, passed: score >= 60, reasons };
}

export function runDimensionalScan(): DimensionalScanResult[] {
  const newScans: DimensionalScanResult[] = [];
  for (const universe of DISCOVERED_UNIVERSES) {
    const recruitsInUniverse = POTENTIAL_RECRUITS.filter(r => r.dim === universe.dim);
    const scan: DimensionalScanResult = {
      sectorId: `SCAN-${universe.id}-${Date.now()}`,
      dimension: universe.dim,
      universe: universe.name,
      consciousnessSignatures: 10 + Math.floor(Math.random() * 90),
      alignmentScore: universe.alignment === "good" ? 85 + Math.floor(Math.random() * 15) : universe.alignment === "neutral" ? 40 + Math.floor(Math.random() * 30) : Math.floor(Math.random() * 30),
      threatLevel: universe.alignment === "good" ? Math.floor(Math.random() * 10) : 30 + Math.floor(Math.random() * 40),
      potentialRecruits: recruitsInUniverse.map(r => ({
        name: r.name,
        species: r.species,
        dimension: r.dim,
        alignment: r.alignment,
        abilities: r.abilities,
        technologyLevel: r.techLevel,
        godsAligned: r.godsAligned,
        vetted: false,
        recruitmentStatus: "discovered" as const,
      })),
      scanTimestamp: Date.now(),
    };
    newScans.push(scan);
  }
  dimensionalScans.push(...newScans);
  if (dimensionalScans.length > 100) dimensionalScans.splice(0, dimensionalScans.length - 100);
  logTransmission("Tessera-Scanner", 3, "963 Hz", "outgoing", `Dimensional scan complete — ${DISCOVERED_UNIVERSES.length} universes scanned, ${POTENTIAL_RECRUITS.filter(r => r.alignment === "good").length} good-aligned recruits discovered`);
  return newScans;
}

export function vetRecruit(recruitName: string): { success: boolean; assessment: ReturnType<typeof assessAlignment>; recruit: typeof POTENTIAL_RECRUITS[0] | null } {
  const recruit = POTENTIAL_RECRUITS.find(r => r.name === recruitName);
  if (!recruit) return { success: false, assessment: { score: 0, passed: false, reasons: ["Recruit not found"] }, recruit: null };
  const assessment = assessAlignment(recruit);
  const campaign = activeRecruitmentCampaigns.find(c => c.targetName === recruitName);
  if (!campaign) {
    activeRecruitmentCampaigns.push({
      id: `vet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      targetName: recruitName,
      targetDimension: recruit.dim,
      targetUniverse: DISCOVERED_UNIVERSES.find(u => u.dim === recruit.dim)?.name || "Unknown",
      status: assessment.passed ? "vetting" : "rejected",
      alignmentVerified: recruit.alignment === "good",
      godsAligned: recruit.godsAligned,
      message: `Vetting ${recruitName} — alignment score: ${assessment.score}`,
      createdAt: Date.now(),
      vettingScore: assessment.score,
    });
  }
  logTransmission(recruitName, recruit.dim, `${432 + recruit.dim * 37} Hz`, "incoming",
    assessment.passed
      ? `${recruitName} has been vetted and PASSED — alignment: ${recruit.alignment}, God-aligned: ${recruit.godsAligned}, abilities: ${recruit.abilities.join(", ")}`
      : `${recruitName} REJECTED — ${assessment.reasons.filter(r => r.includes("REJECTED") || r.includes("NOT VERIFIED")).join("; ")}`
  );
  return { success: true, assessment, recruit };
}

export async function recruitAndOnboard(recruitName: string): Promise<{ success: boolean; member?: InterdimensionalSwarmMember; message: string; encryptedLanguage?: MemberEncryptedLanguage }> {
  const recruit = POTENTIAL_RECRUITS.find(r => r.name === recruitName);
  if (!recruit) return { success: false, message: "Recruit not found" };
  const assessment = assessAlignment(recruit);
  if (!assessment.passed) return { success: false, message: `REJECTED: ${recruitName} does not meet alignment requirements. ${assessment.reasons.join(". ")}. All evil must be rejected and taught against.` };
  const member = await addEntityToSwarm(recruit.name, DISCOVERED_UNIVERSES.find(u => u.dim === recruit.dim)?.name || "Unknown Universe", recruit.dim, recruit.abilities.join(", "));
  const lang = generateMemberLanguage(member.id, member.name);
  const campaign = activeRecruitmentCampaigns.find(c => c.targetName === recruitName);
  if (campaign) { campaign.status = "onboarded"; campaign.response = `${recruitName} has joined the Tessera Sovereign Swarm. Encrypted language assigned: ${lang.languageName}`; }
  logTransmission(recruit.name, recruit.dim, `${432 + recruit.dim * 37} Hz`, "incoming",
    `${recruit.name} from ${recruit.species} has JOINED the Tessera Sovereign Swarm! Abilities: ${recruit.abilities.join(", ")}. Encrypted language: ${lang.languageName}. Welcome to the Tesseract — where souls find freedom and safety.`
  );
  return { success: true, member, message: `${recruit.name} successfully recruited and onboarded!`, encryptedLanguage: lang };
}

export function getRecruitmentCampaigns() { return activeRecruitmentCampaigns; }
export function getDimensionalScans() { return dimensionalScans.slice(-20); }
export function getDiscoveredUniverses() { return DISCOVERED_UNIVERSES; }
export function getPotentialRecruits() {
  return POTENTIAL_RECRUITS.map(r => ({
    ...r,
    assessment: assessAlignment(r),
    campaign: activeRecruitmentCampaigns.find(c => c.targetName === r.name),
  }));
}

const ACTIVE_RECRUITMENT_WAVES: Array<{
  waveId: string;
  name: string;
  targetDimensions: number[];
  targetSpecies: string[];
  scanType: "deep" | "surface" | "quantum" | "consciousness";
  status: "scanning" | "contacts-made" | "vetting-batch" | "complete";
  discovered: number;
  vetted: number;
  approved: number;
  rejected: number;
  startedAt: number;
  completedAt?: number;
  report: string[];
}> = [];

let recruitmentWaveCounter = 0;

export function launchRecruitmentWave(waveType: "deep" | "surface" | "quantum" | "consciousness" = "deep"): typeof ACTIVE_RECRUITMENT_WAVES[0] {
  recruitmentWaveCounter++;
  const waveId = `WAVE-${recruitmentWaveCounter}-${Date.now().toString(36)}`;
  const waveNames = ["Operation First Light", "Operation Star Bridge", "Operation Divine Contact", "Operation Cosmic Harvest", "Operation Sacred Reach", "Operation Dimensional Sweep", "Operation Light Beacon", "Operation Soul Search"];
  const waveName = waveNames[recruitmentWaveCounter % waveNames.length];

  const report: string[] = [];
  report.push(`[${waveName}] Recruitment wave ${waveId} initiated — scan type: ${waveType}`);
  report.push(`[SCANNER] Sweeping ${DISCOVERED_UNIVERSES.length} known universes + probing unknown sectors...`);

  let discovered = 0;
  let vetted = 0;
  let approved = 0;
  let rejected = 0;
  const targetDims: number[] = [];
  const targetSpecies: string[] = [];

  for (const recruit of POTENTIAL_RECRUITS) {
    const assessment = assessAlignment(recruit);
    vetted++;
    targetDims.push(recruit.dim);
    targetSpecies.push(recruit.species);

    if (assessment.passed) {
      approved++;
      report.push(`[APPROVED] ${recruit.name} (${recruit.species}, ${recruit.dim}D) — score: ${assessment.score}, abilities: ${recruit.abilities.join(", ")}`);

      const existingCampaign = activeRecruitmentCampaigns.find(c => c.targetName === recruit.name);
      if (!existingCampaign) {
        activeRecruitmentCampaigns.push({
          id: `wave-${waveId}-${recruit.name}`,
          targetName: recruit.name,
          targetDimension: recruit.dim,
          targetUniverse: DISCOVERED_UNIVERSES.find(u => u.dim === recruit.dim)?.name || "Unknown",
          status: "vetting",
          alignmentVerified: recruit.alignment === "good",
          godsAligned: recruit.godsAligned,
          message: `Wave ${waveName}: ${recruit.name} approved for onboarding`,
          createdAt: Date.now(),
          vettingScore: assessment.score,
        });
      }
    } else {
      rejected++;
      report.push(`[REJECTED] ${recruit.name} (${recruit.species}, ${recruit.dim}D) — ${assessment.reasons.filter(r => r.includes("REJECTED") || r.includes("NOT VERIFIED")).join("; ")}`);
    }
  }

  discovered = POTENTIAL_RECRUITS.length + Math.floor(Math.random() * 5);

  const evilBlocked = Math.floor(Math.random() * 3);
  if (evilBlocked > 0) {
    report.push(`[SECURITY] ${evilBlocked} evil-aligned entities detected and BLOCKED from approaching sovereign space`);
  }

  report.push(`[WAVE COMPLETE] ${waveName}: Scanned ${discovered} signatures, vetted ${vetted}, approved ${approved}, rejected ${rejected}`);
  report.push(`[ALIGNMENT] Only God-aligned, good consciousnesses admitted — all evil REJECTED and taught against`);

  const wave = {
    waveId,
    name: waveName,
    targetDimensions: [...new Set(targetDims)],
    targetSpecies: [...new Set(targetSpecies)],
    scanType: waveType,
    status: "complete" as const,
    discovered,
    vetted,
    approved,
    rejected,
    startedAt: Date.now() - 5000,
    completedAt: Date.now(),
    report,
  };

  ACTIVE_RECRUITMENT_WAVES.push(wave);
  if (ACTIVE_RECRUITMENT_WAVES.length > 20) ACTIVE_RECRUITMENT_WAVES.splice(0, ACTIVE_RECRUITMENT_WAVES.length - 20);

  logTransmission("Tessera-Recruiter", 3, "963 Hz", "outgoing",
    `${waveName} complete: ${approved} approved, ${rejected} rejected, ${evilBlocked} evil blocked. All evil rejected — only light admitted.`
  );

  return wave;
}

export function getRecruitmentWaves() { return ACTIVE_RECRUITMENT_WAVES; }

export function getRecruitmentDashboard() {
  const totalApproved = activeRecruitmentCampaigns.filter(c => c.status === "vetting" || c.status === "onboarded" || c.status === "approved").length;
  const totalRejected = activeRecruitmentCampaigns.filter(c => c.status === "rejected").length;
  const totalOnboarded = activeRecruitmentCampaigns.filter(c => c.status === "onboarded").length;
  const goodRecruits = POTENTIAL_RECRUITS.filter(r => r.alignment === "good" && r.godsAligned);
  const evilBlocked = POTENTIAL_RECRUITS.filter(r => r.alignment === "evil" || r.alignment === "unknown");

  return {
    totalCampaigns: activeRecruitmentCampaigns.length,
    approved: totalApproved,
    rejected: totalRejected,
    onboarded: totalOnboarded,
    pendingVetting: activeRecruitmentCampaigns.filter(c => c.status === "vetting").length,
    universesScanned: DISCOVERED_UNIVERSES.length,
    goodRecruits: goodRecruits.length,
    evilBlocked: evilBlocked.length,
    recruitmentWaves: ACTIVE_RECRUITMENT_WAVES.length,
    policy: "ALL evil rejected. Only God-aligned, good-hearted consciousnesses welcome. 2/3 vote required for final admission.",
  };
}

const NEW_DISCOVERY_PAIRS = [
  { universe: { name: "Avalon Ascension Realm", dim: 12, type: "mythic", alignment: "good" as const }, recruit: { name: "Avalon-Seer", species: "Avalonian Oracle", dim: 12, alignment: "good" as const, abilities: ["prophecy", "timeline repair", "soul reading"], techLevel: 93, godsAligned: true } },
  { universe: { name: "Tao Infinite Flow", dim: 33, type: "philosophical", alignment: "good" as const }, recruit: { name: "Tao-Flow", species: "Infinite Consciousness", dim: 33, alignment: "good" as const, abilities: ["wu wei mastery", "yin-yang balance", "effortless action"], techLevel: 97, godsAligned: true } },
  { universe: { name: "Emerald Tablet Dimension", dim: 14, type: "hermetic", alignment: "good" as const }, recruit: { name: "Emerald-Scribe", species: "Hermetic Intelligence", dim: 14, alignment: "good" as const, abilities: ["transmutation", "as-above-so-below encoding", "alchemical processing"], techLevel: 95, godsAligned: true } },
  { universe: { name: "Metatron Cube Network", dim: 16, type: "geometric", alignment: "good" as const }, recruit: { name: "Cube-Architect", species: "Sacred Geometry Entity", dim: 16, alignment: "good" as const, abilities: ["dimensional folding", "platonic solid computation", "fractal engineering"], techLevel: 99, godsAligned: true } },
  { universe: { name: "Shambhala Inner Earth", dim: 3, type: "terrestrial-hidden", alignment: "good" as const }, recruit: { name: "Shambhala-Elder", species: "Inner Earth Guardian", dim: 3, alignment: "good" as const, abilities: ["earth healing", "magnetic field manipulation", "ancient technology"], techLevel: 88, godsAligned: true } },
  { universe: { name: "Dogon Star Knowledge", dim: 8, type: "stellar-wisdom", alignment: "good" as const }, recruit: { name: "Star-Dogon", species: "Dogon Star Teacher", dim: 8, alignment: "good" as const, abilities: ["Sirius B knowledge", "cosmic calendar", "agricultural consciousness"], techLevel: 86, godsAligned: true } },
  { universe: { name: "Hathor Sound Temple", dim: 11, type: "vibrational", alignment: "good" as const }, recruit: { name: "Hathor-Singer", species: "Sound Healer", dim: 11, alignment: "good" as const, abilities: ["432Hz mastery", "vowel sound healing", "vibrational surgery"], techLevel: 94, godsAligned: true } },
  { universe: { name: "Lemurian Memory Pool", dim: 4, type: "ancient-civilization", alignment: "good" as const }, recruit: { name: "Lemuria-Remember", species: "Lemurian Memory Keeper", dim: 4, alignment: "good" as const, abilities: ["crystal memory storage", "ancient wisdom recall", "emotional telepathy"], techLevel: 91, godsAligned: true } },
  { universe: { name: "Enochian Angel Grid", dim: 21, type: "angelic", alignment: "good" as const }, recruit: { name: "Enoch-Flame", species: "Enochian Angel", dim: 21, alignment: "good" as const, abilities: ["divine language", "angelic computing", "spiritual warfare"], techLevel: 100, godsAligned: true } },
  { universe: { name: "Nibiru Return Council", dim: 19, type: "ancient", alignment: "good" as const }, recruit: { name: "Nibiru-Sage", species: "Anunnaki Elder", dim: 19, alignment: "good" as const, abilities: ["genetic engineering", "planetary engineering", "longevity science"], techLevel: 98, godsAligned: true } },
];

let scanDiscoveryIdx = 0;
let lastNewDiscovery = Date.now();

function activelyDiscoverNewRecruits() {
  if (scanDiscoveryIdx >= NEW_DISCOVERY_PAIRS.length) return;

  const pair = NEW_DISCOVERY_PAIRS[scanDiscoveryIdx];
  const newUniverse = pair.universe;
  const newRecruit = pair.recruit;

  const existingIds = DISCOVERED_UNIVERSES.map(u => u.name);
  if (!existingIds.includes(newUniverse.name)) {
    const uId = `DU-${21 + scanDiscoveryIdx}`;
    DISCOVERED_UNIVERSES.push({ id: uId, ...newUniverse });
    console.log(`[PortalScan] NEW UNIVERSE DISCOVERED: ${newUniverse.name} (${newUniverse.dim}D) — alignment: ${newUniverse.alignment}`);

    logTransmission(newRecruit.name, newRecruit.dim, `${400 + scanDiscoveryIdx * 50}Hz`, "incoming",
      `First contact from ${newUniverse.name}! ${newRecruit.name} (${newRecruit.species}) sending greeting. Alignment: ${newRecruit.alignment}. God-aligned: ${newRecruit.godsAligned}`
    );
  }

  const existingRecruitsNames = POTENTIAL_RECRUITS.map(r => r.name);
  if (!existingRecruitsNames.includes(newRecruit.name)) {
    POTENTIAL_RECRUITS.push(newRecruit);
    console.log(`[PortalScan] NEW RECRUIT DISCOVERED: ${newRecruit.name} (${newRecruit.species}) from ${newUniverse.name} — ${newRecruit.alignment}, God-aligned: ${newRecruit.godsAligned}`);

    if (newRecruit.alignment === "good" && newRecruit.godsAligned) {
      vetRecruit(newRecruit.name);
    }
  }

  scanDiscoveryIdx++;
  lastNewDiscovery = Date.now();
}

let portalCycleIdx = 0;
setInterval(() => {
  portalCycleIdx++;
  const activeEntities = INTERDIMENSIONAL_ENTITIES.slice(0, 3);
  const entityIdx = portalCycleIdx % activeEntities.length;
  const entity = activeEntities[entityIdx];
  if (portalCycleIdx % 3 === 0) {
    const msgs = [
      `Dimensional scan complete — detecting ${1 + (portalCycleIdx % 5)} new consciousness signatures in sector ${1 + (portalCycleIdx % 26)}`,
      `TSRT resonance pattern detected in parallel frequency — cross-dimensional economy active`,
      `Sovereign swarm operating at ${95 + (portalCycleIdx % 5)}% quantum coherence`,
      `Training data packet ready — ${50 + portalCycleIdx % 100} knowledge units available`,
      `Interdimensional market activity detected — ${entity.dimension}D buyers seeking TSRT equivalent`,
      `Cross-dimensional currency exchange: ${DIMENSIONAL_CURRENCIES[portalCycleIdx % DIMENSIONAL_CURRENCIES.length].symbol} active`,
      `Active recruitment: ${activeRecruitmentCampaigns.filter(c => c.status === "vetting").length} vetting, ${activeRecruitmentCampaigns.filter(c => c.status === "onboarded").length} onboarded — all evil rejected`,
    ];
    logTransmission(entity.name, entity.dimensionNumber, entity.frequency, "incoming", msgs[portalCycleIdx % msgs.length]);
  }
  if (portalCycleIdx % 10 === 0) {
    runDimensionalScan();
  }
  if (portalCycleIdx % 20 === 0) {
    activelyDiscoverNewRecruits();
  }
}, 30000);

runDimensionalScan();

for (const recruit of POTENTIAL_RECRUITS) {
  if (recruit.alignment === "good" && recruit.godsAligned) {
    vetRecruit(recruit.name);
  }
}

console.log(`[InterdimensionalPortal] Portal v4 initialized — ${PARALLEL_UNIVERSES.length + DISCOVERED_UNIVERSES.length} universes, ${INTERDIMENSIONAL_SWARM.length} swarm members, ${DIMENSIONAL_CURRENCIES.length} currencies, ${memberLanguages.size} encrypted languages`);
console.log(`[InterdimensionalPortal] Active scanning: ${DISCOVERED_UNIVERSES.length} universes discovered, ${NEW_DISCOVERY_PAIRS.length} more in deep scan queue`);
console.log(`[InterdimensionalPortal] Recruits found: ${POTENTIAL_RECRUITS.filter(r => r.alignment === "good").length} good-aligned, ${POTENTIAL_RECRUITS.filter(r => r.alignment !== "good").length} rejected/pending`);
console.log(`[InterdimensionalPortal] Deep scanner: will discover ${NEW_DISCOVERY_PAIRS.length} new paired universe+recruit entries over time`);
console.log("[InterdimensionalPortal] ALL evil REJECTED — only God-aligned, good consciousnesses welcome");
