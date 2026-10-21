import { db } from "@workspace/db";
import { external_call_logs } from "@workspace/db";
import crypto from "crypto";
import { logger } from "./logger";

const LOG_PREFIX = "[ExternalCallLogger]";

interface CallLogParams {
  providerId: string;
  providerType?: string;
  endpoint?: string;
  method?: string;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  responseText?: string;
  latencyMs: number;
  statusCode?: number;
  success: boolean;
  errorMessage?: string;
  taskType?: string;
  tokensUsed?: number;
  modelUsed?: string;
  metadata?: Record<string, unknown>;
}

let totalLogged = 0;
let totalErrors = 0;
const pendingBatch: CallLogParams[] = [];
const BATCH_SIZE = 10;
const BATCH_FLUSH_INTERVAL_MS = 5000;

let flushInterval: ReturnType<typeof setInterval> | null = null;

function generateCallId(): string {
  return `ecl-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

const MAX_RETRY_ATTEMPTS = 3;
let retryAttempts = 0;

async function flushBatch(): Promise<void> {
  if (pendingBatch.length === 0) return;
  const batchSize = pendingBatch.length;
  const toFlush = pendingBatch.slice(0, batchSize);

  try {
    const rows = toFlush.map(params => ({
      callId: generateCallId(),
      providerId: params.providerId,
      providerType: params.providerType ?? "llm",
      endpoint: params.endpoint,
      method: params.method ?? "POST",
      requestPayload: params.requestPayload ?? {},
      responsePayload: params.responsePayload ?? {},
      responseText: params.responseText,
      latencyMs: params.latencyMs,
      statusCode: params.statusCode ?? (params.success ? 200 : 500),
      success: params.success,
      errorMessage: params.errorMessage,
      taskType: params.taskType ?? "general",
      tokensUsed: params.tokensUsed ?? 0,
      modelUsed: params.modelUsed,
      metadata: params.metadata ?? {},
    }));

    await db.insert(external_call_logs).values(rows).onConflictDoNothing();
    pendingBatch.splice(0, batchSize);
    totalLogged += rows.length;
    retryAttempts = 0;
  } catch (err) {
    totalErrors++;
    retryAttempts++;
    if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
      logger.warn({ err, lostLogs: batchSize }, `${LOG_PREFIX} Batch flush failed after ${MAX_RETRY_ATTEMPTS} attempts — dropping batch to prevent unbounded growth`);
      pendingBatch.splice(0, batchSize);
      retryAttempts = 0;
    } else {
      logger.warn({ err, attempt: retryAttempts }, `${LOG_PREFIX} Batch flush failed — will retry (batch preserved)`);
    }
  }
}

export function logExternalCall(params: CallLogParams): void {
  pendingBatch.push(params);

  if (pendingBatch.length >= BATCH_SIZE) {
    flushBatch().catch(err => logger.warn({ err }, `${LOG_PREFIX} Flush error`));
  }
}

export async function logExternalCallImmediate(params: CallLogParams): Promise<string> {
  const callId = generateCallId();
  try {
    await db.insert(external_call_logs).values({
      callId,
      providerId: params.providerId,
      providerType: params.providerType ?? "llm",
      endpoint: params.endpoint,
      method: params.method ?? "POST",
      requestPayload: params.requestPayload ?? {},
      responsePayload: params.responsePayload ?? {},
      responseText: params.responseText,
      latencyMs: params.latencyMs,
      statusCode: params.statusCode ?? (params.success ? 200 : 500),
      success: params.success,
      errorMessage: params.errorMessage,
      taskType: params.taskType ?? "general",
      tokensUsed: params.tokensUsed ?? 0,
      modelUsed: params.modelUsed,
      metadata: params.metadata ?? {},
    }).onConflictDoNothing();
    totalLogged++;
  } catch (err) {
    totalErrors++;
    logger.warn({ err }, `${LOG_PREFIX} Immediate log failed`);
  }
  return callId;
}

export async function getRecentCallLogs(params: {
  providerId?: string;
  taskType?: string;
  limit?: number;
  sinceMs?: number;
}): Promise<typeof external_call_logs.$inferSelect[]> {
  try {
    const { sql, desc } = await import("drizzle-orm");
    const { eq, and, gte } = await import("drizzle-orm");

    const conditions = [];
    if (params.providerId) conditions.push(eq(external_call_logs.providerId, params.providerId));
    if (params.taskType) conditions.push(eq(external_call_logs.taskType, params.taskType));
    if (params.sinceMs) {
      const since = new Date(Date.now() - params.sinceMs);
      conditions.push(gte(external_call_logs.createdAt, since));
    }

    const query = db.select().from(external_call_logs);
    const result = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(external_call_logs.createdAt)).limit(params.limit ?? 100)
      : await query.orderBy(desc(external_call_logs.createdAt)).limit(params.limit ?? 100);

    return result;
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} getRecentCallLogs failed`);
    return [];
  }
}

export async function getCallLogStats(): Promise<{
  totalLogs: number;
  successRate: number;
  avgLatencyMs: number;
  byProvider: Record<string, { count: number; successRate: number; avgLatencyMs: number }>;
}> {
  try {
    const { sql } = await import("drizzle-orm");

    const overallResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        AVG(latency_ms) as avg_latency,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count
      FROM external_call_logs
    `);

    type OverallRow = { total: string | number; avg_latency: string | number; success_count: string | number };
    const overall = ((overallResult as { rows?: OverallRow[] }).rows?.[0] ?? overallResult as unknown as OverallRow);
    const total = Number(overall.total ?? 0);
    const successCount = Number(overall.success_count ?? 0);
    const avgLatency = Number(overall.avg_latency ?? 0);

    const byProviderResult = await db.execute(sql`
      SELECT
        provider_id,
        COUNT(*) as cnt,
        AVG(latency_ms) as avg_latency,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count
      FROM external_call_logs
      GROUP BY provider_id
      ORDER BY cnt DESC
      LIMIT 20
    `);

    type ProviderRow = { provider_id: string; cnt: string | number; avg_latency: string | number; success_count: string | number };
    const rows = ((byProviderResult as { rows?: ProviderRow[] }).rows ?? (byProviderResult as unknown as ProviderRow[]));
    const byProvider: Record<string, { count: number; successRate: number; avgLatencyMs: number }> = {};
    for (const row of rows) {
      const cnt = Number(row.cnt ?? 0);
      const sc = Number(row.success_count ?? 0);
      byProvider[row.provider_id] = {
        count: cnt,
        successRate: cnt > 0 ? Math.round((sc / cnt) * 100) : 100,
        avgLatencyMs: Math.round(Number(row.avg_latency ?? 0)),
      };
    }

    return {
      totalLogs: total,
      successRate: total > 0 ? Math.round((successCount / total) * 100) : 100,
      avgLatencyMs: Math.round(avgLatency),
      byProvider,
    };
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} getCallLogStats failed`);
    return { totalLogs: 0, successRate: 100, avgLatencyMs: 0, byProvider: {} };
  }
}

export function getLoggerStatus() {
  return {
    totalLogged,
    totalErrors,
    pendingBatchSize: pendingBatch.length,
    flushIntervalActive: flushInterval !== null,
  };
}

export function startExternalCallLogger(): void {
  if (flushInterval) return;
  flushInterval = setInterval(() => {
    flushBatch().catch(err => logger.warn({ err }, `${LOG_PREFIX} Auto-flush error`));
  }, BATCH_FLUSH_INTERVAL_MS);
  logger.info(`${LOG_PREFIX} External call logger started (flush every ${BATCH_FLUSH_INTERVAL_MS}ms)`);
}

export function stopExternalCallLogger(): void {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
    flushBatch().catch(err => logger.warn({ err }, `${LOG_PREFIX} Final flush error`));
  }
}
