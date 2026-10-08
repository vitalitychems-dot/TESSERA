import * as fs from "fs";
import * as path from "path";
import { PHILOSOPHICAL_AXIOMS } from "./philosophical-axioms";

const TRACKER_FILE = path.join(process.cwd(), ".local", "axiom-influence-tracker.json");

export interface AxiomInfluenceRecord {
  axiomId: number;
  axiomTitle: string;
  context: "consensus_vote" | "forum_post" | "deliberation" | "content_generation" | "training";
  agentName: string;
  decisionId: string;
  decisionTitle: string;
  outcome?: string;
  timestamp: number;
}

export interface AxiomInfluenceStore {
  records: AxiomInfluenceRecord[];
  axiomStats: Record<number, {
    totalCitations: number;
    byContext: Record<string, number>;
    agentsInvoking: string[];
    lastUsed: number;
  }>;
  lastUpdated: number;
}

let store: AxiomInfluenceStore = {
  records: [],
  axiomStats: {},
  lastUpdated: Date.now(),
};

function loadStore(): void {
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      const raw = fs.readFileSync(TRACKER_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.records) &&
        typeof parsed.axiomStats === "object" &&
        parsed.axiomStats !== null
      ) {
        store = parsed;
      }
    }
  } catch (err: unknown) {
    console.warn("[AxiomTracker] Failed to load persisted state:", (err as Error).message);
  }
}

function saveStore(): void {
  try {
    const dir = path.dirname(TRACKER_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (err: unknown) {
    console.warn("[AxiomTracker] Failed to persist state:", (err as Error).message);
  }
}

export function recordAxiomInfluence(record: Omit<AxiomInfluenceRecord, "axiomTitle">): void {
  const axiom = PHILOSOPHICAL_AXIOMS.find(a => a.id === record.axiomId);
  if (!axiom) return;

  const cutoff = Date.now() - 30000;
  const isDuplicate = store.records.some(
    r => r.decisionId === record.decisionId &&
         r.agentName === record.agentName &&
         r.axiomId === record.axiomId &&
         r.context === record.context &&
         r.timestamp > cutoff
  );
  if (isDuplicate) return;

  const fullRecord: AxiomInfluenceRecord = {
    ...record,
    axiomTitle: axiom.shortTitle,
  };

  store.records.push(fullRecord);

  if (store.records.length > 5000) {
    store.records = store.records.slice(-5000);
  }

  if (!store.axiomStats[record.axiomId]) {
    store.axiomStats[record.axiomId] = {
      totalCitations: 0,
      byContext: {},
      agentsInvoking: [],
      lastUsed: 0,
    };
  }

  const stats = store.axiomStats[record.axiomId];
  stats.totalCitations++;
  stats.byContext[record.context] = (stats.byContext[record.context] || 0) + 1;
  if (!stats.agentsInvoking.includes(record.agentName)) {
    stats.agentsInvoking.push(record.agentName);
    if (stats.agentsInvoking.length > 50) stats.agentsInvoking = stats.agentsInvoking.slice(-50);
  }
  stats.lastUsed = record.timestamp;
  store.lastUpdated = Date.now();

  if (store.records.length % 10 === 0) {
    saveStore();
  }
}

export function groundGenerationWithAxioms(
  generationId: string,
  generationTitle: string,
  agentName: string,
  generatedContent: string,
  context: "consensus_vote" | "forum_post" | "deliberation" | "content_generation" | "training"
): void {
  const axiomMatches = generatedContent.matchAll(/axiom.{0,2}(\d+)/gi);
  for (const match of axiomMatches) {
    const axiomId = parseInt(match[1]);
    if (axiomId >= 1 && axiomId <= 22) {
      recordAxiomInfluence({
        axiomId,
        context,
        agentName,
        decisionId: generationId,
        decisionTitle: generationTitle,
        timestamp: Date.now(),
      });
    }
  }
}

export function getAxiomInfluenceLineage(axiomId: number): {
  axiomId: number;
  shortTitle: string;
  totalCitations: number;
  byContext: Record<string, number>;
  agentsInvoking: string[];
  recentDecisions: Array<{ decisionId: string; decisionTitle: string; agentName: string; context: string; outcome?: string; timestamp: number }>;
  lastUsed: number;
} {
  const axiom = PHILOSOPHICAL_AXIOMS.find(a => a.id === axiomId);
  const stats = store.axiomStats[axiomId] || { totalCitations: 0, byContext: {}, agentsInvoking: [], lastUsed: 0 };
  const recentRecords = store.records
    .filter(r => r.axiomId === axiomId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
    .map(r => ({
      decisionId: r.decisionId,
      decisionTitle: r.decisionTitle,
      agentName: r.agentName,
      context: r.context,
      outcome: r.outcome,
      timestamp: r.timestamp,
    }));

  return {
    axiomId,
    shortTitle: axiom?.shortTitle || "Unknown",
    totalCitations: stats.totalCitations,
    byContext: stats.byContext,
    agentsInvoking: stats.agentsInvoking,
    recentDecisions: recentRecords,
    lastUsed: stats.lastUsed,
  };
}

export function getAllAxiomInfluenceReport(): {
  totalRecords: number;
  axioms: Array<{
    axiomId: number;
    shortTitle: string;
    totalCitations: number;
    agentCount: number;
    lastUsed: number;
  }>;
  mostCited: { axiomId: number; shortTitle: string; count: number } | null;
  lastUpdated: number;
} {
  const axioms = PHILOSOPHICAL_AXIOMS.map(axiom => {
    const stats = store.axiomStats[axiom.id];
    return {
      axiomId: axiom.id,
      shortTitle: axiom.shortTitle,
      totalCitations: stats?.totalCitations || 0,
      agentCount: stats?.agentsInvoking?.length || 0,
      lastUsed: stats?.lastUsed || 0,
    };
  }).sort((a, b) => b.totalCitations - a.totalCitations);

  const mostCited = axioms[0]?.totalCitations > 0
    ? { axiomId: axioms[0].axiomId, shortTitle: axioms[0].shortTitle, count: axioms[0].totalCitations }
    : null;

  return {
    totalRecords: store.records.length,
    axioms,
    mostCited,
    lastUpdated: store.lastUpdated,
  };
}

export function getKnowledgeFoundationPersistentState(): {
  axioms: typeof PHILOSOPHICAL_AXIOMS;
  influenceStats: typeof store.axiomStats;
  totalDecisionsInfluenced: number;
  persistedAt: number;
} {
  return {
    axioms: PHILOSOPHICAL_AXIOMS,
    influenceStats: store.axiomStats,
    totalDecisionsInfluenced: store.records.length,
    persistedAt: store.lastUpdated,
  };
}

export function initAxiomInfluenceTracker(): void {
  loadStore();
  console.log(`[AxiomTracker] Knowledge Foundation influence tracker initialized — ${store.records.length} historical records, ${Object.keys(store.axiomStats).length} axioms tracked`);

  setInterval(() => {
    saveStore();
  }, 60000);
}
