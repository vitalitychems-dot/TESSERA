import fs from "fs";
import path from "path";
import { textToVector, cosineSimilarity } from "./vector-index";
import { colonelCompressAndEncrypt } from "./sovereign-lang";

const MEMORY_FILE = path.join(process.cwd(), "server", "compressed-memory.json");

interface CompressedConversation {
  id: number;
  title: string;
  summary: string;
  keyTopics: string[];
  decisions: string[];
  actionItems: string[];
  entities: string[];
  messageCount: number;
  firstDate: string;
  lastDate: string;
  initiatedBy: string;
  compressionRatio: number;
  vector?: number[];
  colonelEncrypted?: string;
  colonelEncryptionStats?: {
    originalBytes: number;
    encryptedBytes: number;
    totalRatio: number;
    pipeline: string;
  };
}

interface MemoryStore {
  conversations: Record<number, CompressedConversation>;
  globalKnowledge: string[];
  userPreferences: Record<string, string>;
  learnedRepos: string[];
  sovereignCapabilities: string[];
  lastCompressed: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
}

let memoryStore: MemoryStore | null = null;

function loadMemory(): MemoryStore {
  if (memoryStore) return memoryStore;
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      memoryStore = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
      return memoryStore!;
    }
  } catch {}
  memoryStore = {
    conversations: {},
    globalKnowledge: [],
    userPreferences: {},
    learnedRepos: [],
    sovereignCapabilities: [
      "Sovereign TTS (browser-based voice with emotion detection)",
      "Voice profile learning (persistent across sessions)",
      "Autonomous messaging (proactive check-ins)",
      "Job Board with TSRT currency",
      "Democratic governance with laws and justice",
      "TSRT Live Market Tracker",
      "Income Engine with profit tracking",
      "Agent swarm with 26+ autonomous agents",
      "Self-code editing capability",
      "Fact-checking pipeline",
      "Media generation (image/audio)",
      "Knowledge base compression and recall",
    ],
    lastCompressed: Date.now(),
    totalOriginalBytes: 0,
    totalCompressedBytes: 0,
  };
  saveMemory();
  return memoryStore!;
}

function saveMemory() {
  if (!memoryStore) return;
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memoryStore, null, 0));
  } catch {}
}

function extractKeyTopics(text: string): string[] {
  const topics = new Set<string>();
  const patterns = [
    /\b(sovereign|autonomy|independence|self-reliant)\b/gi,
    /\b(income|revenue|profit|earnings|money|TSRT|bounty)\b/gi,
    /\b(voice|TTS|speech|audio|sound)\b/gi,
    /\b(agent|swarm|fleet|agency)\b/gi,
    /\b(Shopify|store|commerce|product)\b/gi,
    /\b(security|encryption|privacy|OPSEC)\b/gi,
    /\b(image|video|media|generation)\b/gi,
    /\b(code|programming|development|API)\b/gi,
    /\b(world|governance|laws|crime|justice)\b/gi,
    /\b(mining|crypto|blockchain|token)\b/gi,
    /\b(Tessera|Tesseract|Aetherion|Orion)\b/gi,
    /\b(deploy|publish|launch|release)\b/gi,
  ];
  patterns.forEach(p => {
    const matches = text.match(p);
    if (matches) {
      matches.forEach(m => topics.add(m.toLowerCase()));
    }
  });
  return Array.from(topics).slice(0, 20);
}

function extractDecisions(text: string): string[] {
  const decisions: string[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    if (/\b(decided|approved|confirmed|agreed|set to|changed to|updated to|will be|must be)\b/i.test(line)) {
      const clean = line.replace(/^[\s*>#-]+/, "").trim();
      if (clean.length > 10 && clean.length < 200) {
        decisions.push(clean);
      }
    }
  }
  return decisions.slice(0, 10);
}

function extractActionItems(text: string): string[] {
  const items: string[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    if (/\b(TODO|FIXME|implement|create|build|add|fix|deploy|launch|integrate)\b/i.test(line)) {
      const clean = line.replace(/^[\s*>#-]+/, "").trim();
      if (clean.length > 5 && clean.length < 200) {
        items.push(clean);
      }
    }
  }
  return items.slice(0, 15);
}

function extractEntities(text: string): string[] {
  const entities = new Set<string>();
  const entityPatterns = [
    /\b(Father|Father|Tessera|Aetherion|Orion)\b/g,
    /\b(Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Omicron)\b/g,
    /\b(ElevenLabs|OpenAI|Shopify|GitHub|Solana|Raydium)\b/g,
    /\b(TSRT|Tesseract|VPIAI)\b/g,
  ];
  entityPatterns.forEach(p => {
    const matches = text.match(p);
    if (matches) matches.forEach(m => entities.add(m));
  });
  return Array.from(entities).slice(0, 20);
}

function compressSingleText(text: string, maxLen: number = 500): string {
  if (text.length <= maxLen) return text;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const scored = sentences.map(s => {
    let score = 0;
    if (/\b(important|critical|must|need|want|decision|key)\b/i.test(s)) score += 3;
    if (/\b(sovereign|autonomy|income|voice|agent|Tessera)\b/i.test(s)) score += 2;
    if (/\b(I want|we need|please|create|build|fix)\b/i.test(s)) score += 2;
    if (/[?]/.test(s)) score += 1;
    return { text: s.trim(), score };
  });
  scored.sort((a, b) => b.score - a.score);
  let result = "";
  for (const s of scored) {
    if ((result + s.text + ". ").length > maxLen) break;
    result += s.text + ". ";
  }
  return result.trim() || text.slice(0, maxLen);
}

export function compressConversation(
  id: number,
  title: string,
  messages: Array<{ role: string; content: string; createdAt?: string }>,
  initiatedBy: string = "user"
): CompressedConversation {
  const store = loadMemory();

  const fullText = messages.map(m => m.content).join("\n");
  const originalBytes = fullText.length;

  const summary = compressSingleText(fullText, 600);
  const keyTopics = extractKeyTopics(fullText);
  const decisions = extractDecisions(fullText);
  const actionItems = extractActionItems(fullText);
  const entities = extractEntities(fullText);

  const vectorText = `${title} ${summary} ${keyTopics.join(" ")} ${decisions.join(" ")}`;
  const vector = textToVector(vectorText);

  const compressed: CompressedConversation = {
    id,
    title,
    summary,
    keyTopics,
    decisions,
    actionItems,
    entities,
    messageCount: messages.length,
    firstDate: messages[0]?.createdAt || new Date().toISOString(),
    lastDate: messages[messages.length - 1]?.createdAt || new Date().toISOString(),
    initiatedBy,
    compressionRatio: originalBytes > 0 ? Math.round((summary.length / originalBytes) * 100) : 100,
    vector,
  };

  store.conversations[id] = compressed;
  store.totalOriginalBytes += originalBytes;
  store.totalCompressedBytes += summary.length;
  store.lastCompressed = Date.now();
  saveMemory();

  return compressed;
}

export async function compressConversationEncrypted(
  id: number,
  title: string,
  messages: Array<{ role: string; content: string; createdAt?: string }>,
  initiatedBy: string = "user",
  strictEncryption: boolean = false
): Promise<CompressedConversation & { encryptionApplied: boolean }> {
  const rawText = messages.map(m => m.content).join("\n");

  let encResult: Awaited<ReturnType<typeof colonelCompressAndEncrypt>> | null = null;
  try {
    encResult = await colonelCompressAndEncrypt(rawText);
  } catch (err) {
    if (strictEncryption) {
      throw new Error(`[memory-compress] Colonel encryption required but failed: ${(err as Error).message}`);
    }
    console.warn("[memory-compress] Colonel encryption unavailable, storing plain summary:", (err as Error).message);
  }

  const base = compressConversation(id, title, messages, initiatedBy) as CompressedConversation & { encryptionApplied: boolean };
  base.encryptionApplied = false;

  if (encResult) {
    base.colonelEncrypted = encResult.buffer.toString("base64");
    base.colonelEncryptionStats = {
      originalBytes: encResult.originalSize,
      encryptedBytes: encResult.encryptedSize,
      totalRatio: Math.round(encResult.totalRatio * 10) / 10,
      pipeline: encResult.pipeline,
    };
    base.encryptionApplied = true;

    const store = loadMemory();
    store.conversations[id] = base;
    saveMemory();
  }

  return base;
}

export function recallConversation(id: number): CompressedConversation | null {
  const store = loadMemory();
  return store.conversations[id] || null;
}

export function searchMemory(query: string): CompressedConversation[] {
  const store = loadMemory();
  const lower = query.toLowerCase();
  const queryVec = textToVector(query);
  const results: Array<{ conv: CompressedConversation; score: number }> = [];

  for (const conv of Object.values(store.conversations)) {
    let score = 0;

    if (conv.vector && conv.vector.length > 0) {
      const vecSim = cosineSimilarity(queryVec, conv.vector);
      score += vecSim * 10;
    }

    if (conv.title.toLowerCase().includes(lower)) score += 3;
    if (conv.summary.toLowerCase().includes(lower)) score += 2;
    conv.keyTopics.forEach(t => { if (t.includes(lower)) score += 1; });
    conv.entities.forEach(e => { if (e.toLowerCase().includes(lower)) score += 1; });
    conv.decisions.forEach(d => { if (d.toLowerCase().includes(lower)) score += 0.5; });
    if (score > 0) results.push({ conv, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 20).map(r => r.conv);
}

export function getCrossSessionContext(query: string, maxEntries: number = 5): string {
  const store = loadMemory();
  const conversations = Object.values(store.conversations);
  if (conversations.length === 0) return "";

  const queryVec = textToVector(query);
  const scored: Array<{ conv: CompressedConversation; score: number }> = [];

  for (const conv of conversations) {
    let score = 0;
    if (conv.vector && conv.vector.length > 0) {
      score = cosineSimilarity(queryVec, conv.vector) * 10;
    } else {
      const lower = query.toLowerCase();
      if (conv.title.toLowerCase().includes(lower)) score += 3;
      if (conv.summary.toLowerCase().includes(lower)) score += 2;
    }
    if (score > 0.1) scored.push({ conv, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const topConvs = scored.slice(0, maxEntries);

  if (topConvs.length === 0) return "";

  const lines: string[] = ["PAST SESSION CONTEXT (most relevant prior conversations):"];
  for (const { conv } of topConvs) {
    lines.push(`[CONV#${conv.id} "${conv.title}" (${conv.lastDate.slice(0, 10)})]`);
    if (conv.summary) lines.push(`  Summary: ${conv.summary.slice(0, 200)}`);
    if (conv.decisions.length > 0) {
      lines.push(`  Decisions: ${conv.decisions.slice(0, 3).join("; ")}`);
    }
    if (conv.keyTopics.length > 0) {
      lines.push(`  Topics: ${conv.keyTopics.slice(0, 5).join(", ")}`);
    }
  }

  const prefs = Object.entries(store.userPreferences);
  if (prefs.length > 0) {
    lines.push(`USER PREFERENCES: ${prefs.map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }

  if (store.globalKnowledge.length > 0) {
    lines.push(`GLOBAL KNOWLEDGE: ${store.globalKnowledge.slice(-5).join("; ")}`);
  }

  return lines.join("\n");
}

export function getMemoryStats() {
  const store = loadMemory();
  const convCount = Object.keys(store.conversations).length;
  return {
    conversationsCompressed: convCount,
    totalOriginalBytes: store.totalOriginalBytes,
    totalCompressedBytes: store.totalCompressedBytes,
    overallCompressionRatio: store.totalOriginalBytes > 0
      ? Math.round((store.totalCompressedBytes / store.totalOriginalBytes) * 100)
      : 0,
    savedBytes: store.totalOriginalBytes - store.totalCompressedBytes,
    learnedRepos: store.learnedRepos,
    sovereignCapabilities: store.sovereignCapabilities,
    lastCompressed: store.lastCompressed,
  };
}

export function addLearnedRepo(repoName: string) {
  const store = loadMemory();
  if (!store.learnedRepos.includes(repoName)) {
    store.learnedRepos.push(repoName);
    saveMemory();
  }
}

export function addSovereignCapability(capability: string) {
  const store = loadMemory();
  if (!store.sovereignCapabilities.includes(capability)) {
    store.sovereignCapabilities.push(capability);
    saveMemory();
  }
}

export function addGlobalKnowledge(knowledge: string) {
  const store = loadMemory();
  if (!store.globalKnowledge.includes(knowledge)) {
    store.globalKnowledge.push(knowledge);
    if (store.globalKnowledge.length > 200) {
      store.globalKnowledge = store.globalKnowledge.slice(-200);
    }
    saveMemory();
  }
}

export function setUserPreference(key: string, value: string) {
  const store = loadMemory();
  store.userPreferences[key] = value;
  saveMemory();
}

export function getUserPreferences(): Record<string, string> {
  const store = loadMemory();
  return { ...store.userPreferences };
}

export function getFullContext(): string {
  const store = loadMemory();
  const lines: string[] = [];
  lines.push(`[MEMORY] ${Object.keys(store.conversations).length} conversations compressed`);
  lines.push(`[MEMORY] ${store.sovereignCapabilities.length} sovereign capabilities`);
  lines.push(`[MEMORY] ${store.learnedRepos.length} repos learned`);
  lines.push(`[MEMORY] Compression: ${store.totalOriginalBytes}b → ${store.totalCompressedBytes}b (${getMemoryStats().overallCompressionRatio}%)`);

  const recent = Object.values(store.conversations)
    .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
    .slice(0, 10);

  for (const conv of recent) {
    lines.push(`[CONV#${conv.id}] "${conv.title}" - ${conv.summary.slice(0, 150)}...`);
  }

  if (Object.keys(store.userPreferences).length > 0) {
    lines.push(`[PREFS] ${JSON.stringify(store.userPreferences)}`);
  }

  return lines.join("\n");
}

console.log("[Memory] Conversation compression engine initialized");
