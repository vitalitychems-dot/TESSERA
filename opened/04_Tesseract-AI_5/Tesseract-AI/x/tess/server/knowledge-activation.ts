import { getKnowledgeStats as baseGetStats, searchKnowledge, addKnowledge, getKnowledgeContext } from "./knowledge-engine";
import { getInventionsKnowledgeFeed, getKnowledgeStore, getInventionsStats, type InventionsStats } from "./inventions-engine";

interface ActivationEntry {
  id: string;
  source: string;
  title: string;
  content: string;
  tags: string[];
  status: "active" | "archived";
  addedAt: number;
}

const activationEntries: ActivationEntry[] = [];
let entryCounter = 1;

function makeId(): string {
  return `KA-${Date.now().toString(36)}-${(entryCounter++).toString(36)}`;
}

export function getKnowledgeStats(): any {
  const base = baseGetStats();
  const inventionsFeed = getInventionsKnowledgeFeed(20);
  const activeCount = activationEntries.filter(e => e.status === "active").length;

  let invStats: InventionsStats | undefined;
  try {
    invStats = getInventionsStats();
  } catch {}

  return {
    ...base,
    activationLayer: {
      totalActivationEntries: activationEntries.length,
      activeEntries: activeCount,
      archivedEntries: activationEntries.length - activeCount,
      inventionsKnowledge: inventionsFeed.length,
    },
    inventionsEngine: invStats,
    totalCombined: base.totalEntries + activationEntries.length + inventionsFeed.length,
  };
}

export function getKnowledgeEntries(limit: number = 50, typeFilter?: string): ActivationEntry[] {
  const inventionsFeed = getInventionsKnowledgeFeed(limit).map(inv => ({
    id: inv.id,
    source: inv.source,
    title: inv.title,
    content: inv.content,
    tags: inv.tags,
    status: "active" as const,
    addedAt: inv.timestamp,
  }));

  const baseResult = searchKnowledge(typeFilter || "", Math.max(limit - inventionsFeed.length, 10));
  const baseEntries: ActivationEntry[] = baseResult.entries.map((e, i) => ({
    id: `base-${i}`,
    source: e.source,
    title: e.title,
    content: e.content,
    tags: e.tags,
    status: "active" as const,
    addedAt: Date.now(),
  }));

  const localActive = activationEntries.filter(e =>
    e.status === "active" &&
    (!typeFilter || e.tags.includes(typeFilter) || e.source === typeFilter)
  );

  const combined = [...localActive, ...inventionsFeed, ...baseEntries]
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, limit);

  return combined;
}

export function getKnowledgeFeed(limit: number = 30): Array<{
  id: string;
  title: string;
  content: string;
  tags: string[];
  source: string;
  addedAt: number;
}> {
  const inventionsFeed = getInventionsKnowledgeFeed(Math.floor(limit / 2)).map(inv => ({
    id: inv.id,
    title: inv.title,
    content: inv.content.slice(0, 500),
    tags: inv.tags,
    source: inv.source,
    addedAt: inv.timestamp,
  }));

  const localFeed = activationEntries
    .filter(e => e.status === "active")
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, Math.floor(limit / 3))
    .map(e => ({
      id: e.id,
      title: e.title,
      content: e.content.slice(0, 500),
      tags: e.tags,
      source: e.source,
      addedAt: e.addedAt,
    }));

  const baseResult = searchKnowledge("tessera sovereign knowledge", Math.floor(limit / 3));
  const baseFeed = baseResult.entries.map((e, i) => ({
    id: `base-feed-${i}`,
    title: e.title,
    content: (e.content || "").slice(0, 500),
    tags: e.tags,
    source: e.source,
    addedAt: Date.now() - i * 1000,
  }));

  return [...inventionsFeed, ...localFeed, ...baseFeed]
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, limit);
}

export function retrieveRelevantKnowledge(
  query: string,
  topN: number = 5,
  agentId: string = "user",
): {
  entries: any[];
  inventionsContext: any[];
  totalSearched: number;
  queryTokens: string[];
  agentId: string;
  knowledgeContext: string;
} {
  const result = searchKnowledge(query, topN);
  const context = getKnowledgeContext(query, 800);

  const queryLower = query.toLowerCase();
  const inventionsFeed = getInventionsKnowledgeFeed(20);
  const inventionsContext = inventionsFeed
    .filter(inv =>
      inv.title.toLowerCase().includes(queryLower) ||
      inv.content.toLowerCase().includes(queryLower) ||
      inv.tags.some(t => queryLower.includes(t))
    )
    .slice(0, 3);

  const knowledgeStoreSources = getKnowledgeStore();
  const storeMatches = knowledgeStoreSources
    .filter(e =>
      e.status === "active" && (
        e.content.toLowerCase().includes(queryLower) ||
        e.domain.toLowerCase().includes(queryLower) ||
        e.source.toLowerCase().includes(queryLower)
      )
    )
    .slice(0, 2);

  const localMatches = activationEntries
    .filter(e =>
      e.status === "active" &&
      (e.title.toLowerCase().includes(queryLower) || e.content.toLowerCase().includes(queryLower))
    )
    .slice(0, 2);

  return {
    entries: [...result.entries, ...localMatches, ...storeMatches],
    inventionsContext,
    totalSearched: result.totalSearched + activationEntries.length + knowledgeStoreSources.length,
    queryTokens: result.queryTokens,
    agentId,
    knowledgeContext: context,
  };
}

export function addKnowledgeEntry(entry: {
  source?: string;
  title: string;
  content: string;
  tags?: string[];
}): ActivationEntry {
  const newEntry: ActivationEntry = {
    id: makeId(),
    source: entry.source || "manual",
    title: entry.title,
    content: entry.content,
    tags: entry.tags || [],
    status: "active",
    addedAt: Date.now(),
  };

  activationEntries.push(newEntry);

  try {
    addKnowledge({
      source: newEntry.source,
      title: newEntry.title,
      content: newEntry.content,
      tags: newEntry.tags,
    });
  } catch {}

  return newEntry;
}

export function updateEntryStatus(id: string, status: "active" | "archived"): boolean {
  const entry = activationEntries.find(e => e.id === id);
  if (entry) {
    entry.status = status;
    return true;
  }
  const storeEntry = getKnowledgeStore().find(e => e.id === id);
  if (storeEntry) {
    storeEntry.status = status;
    return true;
  }
  return false;
}
