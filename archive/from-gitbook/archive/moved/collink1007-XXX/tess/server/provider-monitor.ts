import * as fs from "fs";
import * as path from "path";

const log = (msg: string) => console.log(`[ProviderMonitor] ${msg}`);
const PERSIST_PATH = path.join(process.cwd(), "server", "provider-performance.json");

interface ProviderCall {
  provider: string;
  latencyMs: number;
  success: boolean;
  tokensUsed: number;
  category: string;
  timestamp: number;
  errorType?: string;
}

interface ProviderProfile {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  lastUsed: number;
  bestCategories: string[];
  errorBreakdown: Record<string, number>;
  recentLatencies: number[];
  status: "healthy" | "degraded" | "down" | "cooldown";
}

interface AgentPreference {
  agentId: string;
  preferredProviders: Array<{ provider: string; score: number; reason: string }>;
  lastUpdated: number;
}

const callHistory: ProviderCall[] = [];
const MAX_HISTORY = 2000;
const agentPreferences: Map<string, AgentPreference> = new Map();
const categoryScores: Map<string, Map<string, number>> = new Map();

function loadPersistedData() {
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const raw = fs.readFileSync(PERSIST_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (data.callHistory) callHistory.push(...data.callHistory.slice(-MAX_HISTORY));
      if (data.agentPreferences) {
        for (const [k, v] of Object.entries(data.agentPreferences)) {
          agentPreferences.set(k, v as AgentPreference);
        }
      }
      if (data.categoryScores) {
        for (const [cat, scores] of Object.entries(data.categoryScores)) {
          const m = new Map<string, number>();
          for (const [prov, score] of Object.entries(scores as Record<string, number>)) m.set(prov, score);
          categoryScores.set(cat, m);
        }
      }
      log(`Loaded ${callHistory.length} call records, ${agentPreferences.size} agent preferences`);
    }
  } catch (e: any) { log(`Load failed: ${e.message}`); }
}

function persistData() {
  try {
    const catScoresObj: Record<string, Record<string, number>> = {};
    for (const [cat, m] of categoryScores) catScoresObj[cat] = Object.fromEntries(m);
    fs.writeFileSync(PERSIST_PATH, JSON.stringify({
      callHistory: callHistory.slice(-MAX_HISTORY),
      agentPreferences: Object.fromEntries(agentPreferences),
      categoryScores: catScoresObj,
    }, null, 2));
  } catch {}
}

loadPersistedData();

export function recordProviderCall(call: Omit<ProviderCall, "timestamp">) {
  const entry: ProviderCall = { ...call, timestamp: Date.now() };
  callHistory.push(entry);
  if (callHistory.length > MAX_HISTORY) callHistory.splice(0, callHistory.length - MAX_HISTORY);

  if (!categoryScores.has(call.category)) categoryScores.set(call.category, new Map());
  const catMap = categoryScores.get(call.category)!;
  const prev = catMap.get(call.provider) || 50;
  const adjustment = call.success ? Math.min(5, 100 - prev) : -Math.min(10, prev);
  catMap.set(call.provider, Math.max(0, Math.min(100, prev + adjustment)));

  if (callHistory.length % 20 === 0) persistData();
}

export function getProviderProfiles(): Record<string, ProviderProfile> {
  const profiles: Record<string, ProviderProfile> = {};
  const now = Date.now();
  const recentWindow = 3600000;

  const providers = new Set(callHistory.map(c => c.provider));
  for (const provider of providers) {
    const calls = callHistory.filter(c => c.provider === provider);
    const recent = calls.filter(c => now - c.timestamp < recentWindow);
    const successes = calls.filter(c => c.success);
    const recentSuccesses = recent.filter(c => c.success);
    const recentFailures = recent.filter(c => !c.success);
    const latencies = successes.map(c => c.latencyMs);

    const errorBreakdown: Record<string, number> = {};
    calls.filter(c => !c.success && c.errorType).forEach(c => {
      errorBreakdown[c.errorType!] = (errorBreakdown[c.errorType!] || 0) + 1;
    });

    const catCounts: Record<string, number> = {};
    successes.forEach(c => { catCounts[c.category] = (catCounts[c.category] || 0) + 1; });
    const bestCategories = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);

    let status: ProviderProfile["status"] = "healthy";
    if (recent.length >= 3) {
      const recentRate = recentSuccesses.length / recent.length;
      if (recentRate < 0.3) status = "down";
      else if (recentRate < 0.7) status = "degraded";
    } else if (recent.length > 0 && recent.length < 3) {
      const recentRate = recentSuccesses.length / recent.length;
      if (recentRate === 0 && recent.length >= 2) status = "down";
      else if (recentRate < 0.5) status = "degraded";
    }
    if (recentFailures.length >= 3 && recentFailures.slice(-3).every(c => now - c.timestamp < 300000)) status = "cooldown";

    profiles[provider] = {
      totalCalls: calls.length,
      successCalls: successes.length,
      failedCalls: calls.length - successes.length,
      successRate: calls.length > 0 ? Math.round((successes.length / calls.length) * 100) : 0,
      avgLatencyMs: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      totalTokens: calls.reduce((s, c) => s + (c.tokensUsed || 0), 0),
      lastUsed: calls.length > 0 ? calls[calls.length - 1].timestamp : 0,
      bestCategories,
      errorBreakdown,
      recentLatencies: latencies.slice(-10),
      status,
    };
  }
  return profiles;
}

export function getBestProviderForCategory(category: string): string | null {
  const catMap = categoryScores.get(category);
  if (!catMap || catMap.size === 0) return null;
  let best = "";
  let bestScore = -1;
  for (const [prov, score] of catMap) {
    if (score > bestScore) { bestScore = score; best = prov; }
  }
  return best || null;
}

export function setAgentPreference(agentId: string, providers: Array<{ provider: string; score: number; reason: string }>) {
  agentPreferences.set(agentId, {
    agentId,
    preferredProviders: providers.sort((a, b) => b.score - a.score),
    lastUpdated: Date.now(),
  });
  persistData();
}

export function getAgentPreferences(): Record<string, AgentPreference> {
  return Object.fromEntries(agentPreferences);
}

export function getCategoryScores(): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const [cat, m] of categoryScores) result[cat] = Object.fromEntries(m);
  return result;
}

export function getProviderMonitorDashboard() {
  const profiles = getProviderProfiles();
  const catScores = getCategoryScores();
  const preferences = getAgentPreferences();

  const providers = Object.entries(profiles).sort((a, b) => b[1].successRate - a[1].successRate);
  const healthyCount = providers.filter(([, p]) => p.status === "healthy").length;
  const degradedCount = providers.filter(([, p]) => p.status === "degraded").length;
  const downCount = providers.filter(([, p]) => p.status === "down" || p.status === "cooldown").length;

  const now = Date.now();
  const last24h = callHistory.filter(c => now - c.timestamp < 86400000);
  const last1h = callHistory.filter(c => now - c.timestamp < 3600000);

  return {
    summary: {
      totalProviders: providers.length,
      healthy: healthyCount,
      degraded: degradedCount,
      down: downCount,
      totalCallsAllTime: callHistory.length,
      callsLast24h: last24h.length,
      callsLast1h: last1h.length,
      overallSuccessRate: callHistory.length > 0 ? Math.round((callHistory.filter(c => c.success).length / callHistory.length) * 100) : 0,
    },
    providers: Object.fromEntries(providers),
    categoryScores: catScores,
    agentPreferences: preferences,
    timestamp: now,
  };
}

log("Provider performance monitoring initialized");
