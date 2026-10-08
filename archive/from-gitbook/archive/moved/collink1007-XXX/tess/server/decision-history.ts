import fs from "fs";
import path from "path";

const DECISION_HISTORY_PATH = path.join(process.cwd(), "server/decision-history.json");

export type DecisionActor = "council" | "tessera" | "system" | "user" | "agent";
export type DecisionOutcome = "approved" | "rejected" | "pending" | "revoked" | "modified" | "executed" | "failed";

export interface DecisionRecord {
  id: string;
  timestamp: string;
  timestampMs: number;
  actor: DecisionActor;
  actorName: string;
  category: string;
  title: string;
  description: string;
  outcome: DecisionOutcome;
  metadata: Record<string, unknown>;
  tags: string[];
  relatedIds?: string[];
}

interface DecisionStore {
  records: DecisionRecord[];
  version: number;
  lastUpdated: string;
  totalLogged: number;
}

let store: DecisionStore | null = null;

function loadStore(): DecisionStore {
  if (store) return store;
  try {
    if (fs.existsSync(DECISION_HISTORY_PATH)) {
      store = JSON.parse(fs.readFileSync(DECISION_HISTORY_PATH, "utf8"));
      return store!;
    }
  } catch {}
  store = {
    records: [],
    version: 1,
    lastUpdated: new Date().toISOString(),
    totalLogged: 0,
  };
  saveStore();
  return store!;
}

function saveStore() {
  if (!store) return;
  try {
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DECISION_HISTORY_PATH, JSON.stringify(store, null, 0));
  } catch (e: any) {
    console.warn(`[DecisionHistory] Save failed: ${e?.message}`);
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function logDecision(
  actor: DecisionActor,
  actorName: string,
  category: string,
  title: string,
  description: string,
  outcome: DecisionOutcome,
  metadata: Record<string, unknown> = {},
  tags: string[] = [],
  relatedIds?: string[]
): DecisionRecord {
  const s = loadStore();
  const record: DecisionRecord = {
    id: generateId("DEC"),
    timestamp: new Date().toISOString(),
    timestampMs: Date.now(),
    actor,
    actorName,
    category,
    title,
    description,
    outcome,
    metadata,
    tags,
    relatedIds,
  };
  s.records.push(record);
  s.totalLogged++;
  if (s.records.length > 5000) {
    s.records = s.records.slice(-4000);
  }
  saveStore();
  console.log(`[DecisionHistory] Logged: [${outcome.toUpperCase()}] ${title} by ${actorName}`);
  return record;
}

export function logCouncilDecision(
  meetingId: string,
  title: string,
  outcome: DecisionOutcome,
  yesVotes: number,
  noVotes: number,
  totalVoters: number,
  approvalPct: number,
  tesseraDecision: string,
  fairnessScore: number,
  proposals: string[]
): DecisionRecord {
  return logDecision(
    "council",
    "Grand Council",
    "governance",
    title,
    `Council meeting ${meetingId}: ${yesVotes}/${totalVoters} yes votes (${approvalPct}%). Tessera: ${tesseraDecision} (fairness: ${fairnessScore}/100).`,
    outcome,
    {
      meetingId,
      yesVotes,
      noVotes,
      totalVoters,
      approvalPct,
      tesseraDecision,
      fairnessScore,
      proposals,
    },
    ["council", "governance", "vote", outcome],
    [meetingId]
  );
}

export function logSystemAction(
  actorName: string,
  title: string,
  description: string,
  outcome: DecisionOutcome,
  metadata: Record<string, unknown> = {}
): DecisionRecord {
  return logDecision(
    "system",
    actorName,
    "system",
    title,
    description,
    outcome,
    metadata,
    ["system", "autonomous", outcome]
  );
}

export function logAgentAction(
  agentName: string,
  category: string,
  title: string,
  description: string,
  outcome: DecisionOutcome,
  metadata: Record<string, unknown> = {}
): DecisionRecord {
  return logDecision(
    "agent",
    agentName,
    category,
    title,
    description,
    outcome,
    metadata,
    ["agent", agentName.toLowerCase(), category, outcome]
  );
}

export interface DecisionQuery {
  actor?: DecisionActor;
  actorName?: string;
  category?: string;
  outcome?: DecisionOutcome;
  tag?: string;
  search?: string;
  sinceMs?: number;
  beforeMs?: number;
  limit?: number;
  offset?: number;
}

export function queryDecisions(query: DecisionQuery = {}): DecisionRecord[] {
  const s = loadStore();
  let results = [...s.records];

  if (query.actor) {
    results = results.filter(r => r.actor === query.actor);
  }
  if (query.actorName) {
    const lower = query.actorName.toLowerCase();
    results = results.filter(r => r.actorName.toLowerCase().includes(lower));
  }
  if (query.category) {
    results = results.filter(r => r.category === query.category);
  }
  if (query.outcome) {
    results = results.filter(r => r.outcome === query.outcome);
  }
  if (query.tag) {
    results = results.filter(r => r.tags.includes(query.tag!));
  }
  if (query.search) {
    const lower = query.search.toLowerCase();
    results = results.filter(r =>
      r.title.toLowerCase().includes(lower) ||
      r.description.toLowerCase().includes(lower)
    );
  }
  if (query.sinceMs) {
    results = results.filter(r => r.timestampMs >= query.sinceMs!);
  }
  if (query.beforeMs) {
    results = results.filter(r => r.timestampMs < query.beforeMs!);
  }

  results.sort((a, b) => b.timestampMs - a.timestampMs);

  const offset = query.offset || 0;
  const limit = query.limit || 100;
  return results.slice(offset, offset + limit);
}

export function getDecisionStats() {
  const s = loadStore();
  const byOutcome: Record<string, number> = {};
  const byActor: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const r of s.records) {
    byOutcome[r.outcome] = (byOutcome[r.outcome] || 0) + 1;
    byActor[r.actor] = (byActor[r.actor] || 0) + 1;
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }
  return {
    total: s.records.length,
    totalLogged: s.totalLogged,
    byOutcome,
    byActor,
    byCategory,
    lastUpdated: s.lastUpdated,
    recentDecisions: s.records.slice(-10).reverse(),
  };
}

console.log("[DecisionHistory] Structured decision history engine initialized");
