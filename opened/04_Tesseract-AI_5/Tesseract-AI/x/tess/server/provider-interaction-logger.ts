import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { NormalizedProviderResponse } from "./normalization-layer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = (m: string) => console.log(`[ProviderLogger] ${m}`);

const LOG_DIR = path.join(__dirname, "../../../.local/provider-logs");
const MAX_LOG_SIZE = 50 * 1024 * 1024;
const MAX_IN_MEMORY = 500;

interface InteractionEntry {
  id: string;
  timestamp: number;
  providerId: string;
  providerName: string;
  model: string;
  format: string;
  promptPreview: string;
  responsePreview: string;
  tokensUsed: number;
  latencyMs: number;
  quality: number;
  success: boolean;
  error?: string;
  contentHash: string;
  rawResponseSize: number;
  truncated: boolean;
  finishReason: string;
}

interface ProviderStats {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  avgQuality: number;
  totalTokens: number;
  lastCallTimestamp: number;
  callHistory: Array<{ timestamp: number; latencyMs: number; quality: number; success: boolean }>;
}

const interactions: InteractionEntry[] = [];
const providerStatsMap = new Map<string, ProviderStats>();

function ensureLogDir(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Failed to create log dir: ${message}`);
  }
}

function generateId(): string {
  return `pil-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function logInteraction(
  normalized: NormalizedProviderResponse,
  promptPreview: string,
): void {
  const entry: InteractionEntry = {
    id: generateId(),
    timestamp: normalized.timestamp,
    providerId: normalized.providerId,
    providerName: normalized.providerName,
    model: normalized.model,
    format: normalized.format,
    promptPreview: promptPreview.slice(0, 200),
    responsePreview: normalized.content.slice(0, 500),
    tokensUsed: normalized.tokensUsed,
    latencyMs: normalized.latencyMs,
    quality: normalized.quality,
    success: normalized.success,
    error: normalized.error,
    contentHash: normalized.metadata.contentHash,
    rawResponseSize: normalized.metadata.rawResponseSize,
    truncated: normalized.metadata.truncated,
    finishReason: normalized.metadata.finishReason,
  };

  interactions.push(entry);
  if (interactions.length > MAX_IN_MEMORY) {
    interactions.splice(0, interactions.length - MAX_IN_MEMORY);
  }

  updateProviderStats(entry);
  persistEntry(entry);
}

function updateProviderStats(entry: InteractionEntry): void {
  let stats = providerStatsMap.get(entry.providerId);
  if (!stats) {
    stats = {
      totalCalls: 0,
      successCount: 0,
      failureCount: 0,
      avgLatencyMs: 0,
      avgQuality: 0,
      totalTokens: 0,
      lastCallTimestamp: 0,
      callHistory: [],
    };
    providerStatsMap.set(entry.providerId, stats);
  }

  stats.totalCalls++;
  if (entry.success) stats.successCount++;
  else stats.failureCount++;
  stats.totalTokens += entry.tokensUsed;
  stats.lastCallTimestamp = entry.timestamp;

  stats.avgLatencyMs = ((stats.avgLatencyMs * (stats.totalCalls - 1)) + entry.latencyMs) / stats.totalCalls;
  stats.avgQuality = ((stats.avgQuality * (stats.totalCalls - 1)) + entry.quality) / stats.totalCalls;

  stats.callHistory.push({
    timestamp: entry.timestamp,
    latencyMs: entry.latencyMs,
    quality: entry.quality,
    success: entry.success,
  });

  if (stats.callHistory.length > 100) {
    stats.callHistory.splice(0, stats.callHistory.length - 100);
  }
}

function persistEntry(entry: InteractionEntry): void {
  ensureLogDir();
  const logFile = path.join(LOG_DIR, `interactions-${new Date().toISOString().split("T")[0]}.jsonl`);

  try {
    const stat = fs.existsSync(logFile) ? fs.statSync(logFile) : null;
    if (stat && stat.size > MAX_LOG_SIZE) {
      const archiveName = logFile.replace(".jsonl", `-${Date.now()}.jsonl.old`);
      fs.renameSync(logFile, archiveName);
    }
    fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Failed to persist interaction: ${message}`);
  }
}

export function getRecentInteractions(limit: number = 50): InteractionEntry[] {
  return interactions.slice(-limit);
}

export function getProviderStats(providerId?: string): Record<string, ProviderStats> | ProviderStats | undefined {
  if (providerId) return providerStatsMap.get(providerId);
  const result: Record<string, ProviderStats> = {};
  for (const [id, stats] of providerStatsMap) {
    result[id] = stats;
  }
  return result;
}

export function getTopProviders(metric: "quality" | "speed" | "reliability" = "quality", limit: number = 10): Array<{ providerId: string; score: number }> {
  const entries: Array<{ providerId: string; score: number }> = [];

  for (const [id, stats] of providerStatsMap) {
    if (stats.totalCalls < 3) continue;
    let score = 0;
    switch (metric) {
      case "quality":
        score = stats.avgQuality;
        break;
      case "speed":
        score = Math.max(0, 100 - (stats.avgLatencyMs / 100));
        break;
      case "reliability":
        score = stats.totalCalls > 0 ? (stats.successCount / stats.totalCalls) * 100 : 0;
        break;
    }
    entries.push({ providerId: id, score });
  }

  return entries.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function getReverseEngineeringReport(): {
  totalInteractions: number;
  uniqueProviders: number;
  providerBreakdown: Array<{ id: string; calls: number; successRate: number; avgLatency: number; avgQuality: number }>;
  responsePatterns: { avgResponseSize: number; avgTokens: number; truncationRate: number };
  timeDistribution: { last5min: number; last1hr: number; last24hr: number };
} {
  const now = Date.now();
  const breakdown: Array<{ id: string; calls: number; successRate: number; avgLatency: number; avgQuality: number }> = [];

  for (const [id, stats] of providerStatsMap) {
    breakdown.push({
      id,
      calls: stats.totalCalls,
      successRate: stats.totalCalls > 0 ? stats.successCount / stats.totalCalls : 0,
      avgLatency: Math.round(stats.avgLatencyMs),
      avgQuality: Math.round(stats.avgQuality * 10) / 10,
    });
  }

  const totalSize = interactions.reduce((s, i) => s + i.rawResponseSize, 0);
  const totalTokens = interactions.reduce((s, i) => s + i.tokensUsed, 0);
  const truncated = interactions.filter(i => i.truncated).length;

  return {
    totalInteractions: interactions.length,
    uniqueProviders: providerStatsMap.size,
    providerBreakdown: breakdown.sort((a, b) => b.calls - a.calls),
    responsePatterns: {
      avgResponseSize: interactions.length > 0 ? Math.round(totalSize / interactions.length) : 0,
      avgTokens: interactions.length > 0 ? Math.round(totalTokens / interactions.length) : 0,
      truncationRate: interactions.length > 0 ? truncated / interactions.length : 0,
    },
    timeDistribution: {
      last5min: interactions.filter(i => now - i.timestamp < 300_000).length,
      last1hr: interactions.filter(i => now - i.timestamp < 3_600_000).length,
      last24hr: interactions.filter(i => now - i.timestamp < 86_400_000).length,
    },
  };
}

export type { InteractionEntry, ProviderStats };
