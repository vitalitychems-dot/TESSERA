import crypto from "crypto";
import { logger } from "./logger";

const log = (msg: string) => logger.info("WebhookDispatcher", msg);

export interface WebhookEndpointConfig {
  id: number;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  description?: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  dbId?: number;
  endpointId: number;
  event: string;
  payload: unknown;
  status: "pending" | "delivered" | "failed" | "retrying";
  statusCode?: number;
  responseBody?: string;
  attempts: number;
  nextRetryAt?: number;
  deliveredAt?: number;
  createdAt: number;
}

const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 1000;
const MAX_BACKOFF_MS = 64 * 1000;
const TIMEOUT_MS = 10_000;

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^::1$/,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
  /^localhost$/i,
];

function isPrivateUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return true;
    const host = parsed.hostname.toLowerCase();
    return PRIVATE_IP_PATTERNS.some(re => re.test(host));
  } catch {
    return true;
  }
}

const endpoints: Map<number, WebhookEndpointConfig> = new Map();
const deliveries: WebhookDeliveryRecord[] = [];
let nextEndpointId = 1;
let retryTimer: ReturnType<typeof setInterval> | null = null;

function computeBackoff(attempt: number): number {
  const base = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
  const jitter = Math.random() * base * 0.25;
  return Math.floor(base + jitter);
}

function hmacSignature(secret: string, payload: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function updateDeliveryInDb(delivery: WebhookDeliveryRecord): Promise<void> {
  if (!delivery.dbId) return;
  try {
    const { db } = await import("./db");
    const { webhookDeliveries } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(webhookDeliveries)
      .set({
        status: delivery.status,
        statusCode: delivery.statusCode ?? null,
        responseBody: delivery.responseBody ?? null,
        attempts: delivery.attempts,
        deliveredAt: delivery.deliveredAt ? new Date(delivery.deliveredAt) : null,
        nextRetryAt: delivery.nextRetryAt ? new Date(delivery.nextRetryAt) : null,
      })
      .where(eq(webhookDeliveries.id, delivery.dbId));
  } catch (err: any) {
    log(`DB update failed for delivery ${delivery.id}: ${err.message}`);
  }
}

async function attemptDelivery(delivery: WebhookDeliveryRecord, endpoint: WebhookEndpointConfig): Promise<boolean> {
  const payloadStr = JSON.stringify({
    id: delivery.id,
    event: delivery.event,
    timestamp: delivery.createdAt,
    data: delivery.payload,
  });

  const signature = hmacSignature(endpoint.secret, payloadStr);
  delivery.attempts++;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tessera-Signature": signature,
        "X-Tessera-Event": delivery.event,
        "X-Tessera-Delivery-Id": delivery.id,
        "X-Tessera-Timestamp": String(delivery.createdAt),
        "User-Agent": (await import("./sovereign-randomizer")).randomUA(),
      },
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timer);

    delivery.statusCode = res.status;
    delivery.responseBody = (await res.text()).slice(0, 500);

    if (res.ok) {
      delivery.status = "delivered";
      delivery.deliveredAt = Date.now();
      log(`Delivered [${delivery.event}] to ${endpoint.url} — ${res.status} (attempt ${delivery.attempts})`);

      await updateDeliveryInDb(delivery);

      try {
        const { db } = await import("./db");
        const { webhookEndpoints } = await import("@shared/schema");
        const { eq, sql } = await import("drizzle-orm");
        await db.update(webhookEndpoints)
          .set({ successCount: sql`success_count + 1`, lastDeliveryAt: new Date() })
          .where(eq(webhookEndpoints.id, endpoint.id));
      } catch (err: any) {
        log(`Endpoint success-count update failed: ${err.message}`);
      }

      return true;
    } else {
      log(`Delivery failed [${delivery.event}] to ${endpoint.url} — HTTP ${res.status} (attempt ${delivery.attempts})`);
      return false;
    }
  } catch (err: any) {
    delivery.statusCode = 0;
    delivery.responseBody = err.message;
    log(`Delivery error [${delivery.event}] to ${endpoint.url}: ${err.message} (attempt ${delivery.attempts})`);
    return false;
  }
}

export async function dispatch(event: string, payload: unknown): Promise<void> {
  const activeEndpoints = Array.from(endpoints.values()).filter(
    ep => ep.active && (ep.events.includes("*") || ep.events.includes(event))
  );

  if (activeEndpoints.length === 0) {
    log(`No active endpoints for event: ${event}`);
    return;
  }

  for (const endpoint of activeEndpoints) {
    const delivery: WebhookDeliveryRecord = {
      id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      endpointId: endpoint.id,
      event,
      payload,
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
    };

    deliveries.push(delivery);
    if (deliveries.length > 2000) deliveries.splice(0, 500);

    await saveDeliveryToDb(delivery, endpoint);

    const ok = await attemptDelivery(delivery, endpoint);
    if (!ok && delivery.attempts < MAX_ATTEMPTS) {
      delivery.status = "retrying";
      delivery.nextRetryAt = Date.now() + computeBackoff(delivery.attempts);
      log(`Scheduled retry ${delivery.attempts}/${MAX_ATTEMPTS} for [${event}] at ${new Date(delivery.nextRetryAt).toISOString()}`);
      await updateDeliveryInDb(delivery);
    } else if (!ok) {
      delivery.status = "failed";
      log(`Max attempts reached for [${event}] to ${endpoint.url}`);
      await updateDeliveryInDb(delivery);

      try {
        const { db } = await import("./db");
        const { webhookEndpoints } = await import("@shared/schema");
        const { eq, sql } = await import("drizzle-orm");
        await db.update(webhookEndpoints)
          .set({ failureCount: sql`failure_count + 1` })
          .where(eq(webhookEndpoints.id, endpoint.id));
      } catch (err: any) {
        log(`Endpoint failure-count update failed: ${err.message}`);
      }
    }
  }
}

async function saveDeliveryToDb(delivery: WebhookDeliveryRecord, _endpoint: WebhookEndpointConfig): Promise<void> {
  try {
    const { db } = await import("./db");
    const { webhookDeliveries } = await import("@shared/schema");
    const rows = await db.insert(webhookDeliveries).values({
      endpointId: delivery.endpointId,
      event: delivery.event,
      payload: JSON.stringify(delivery.payload),
      status: delivery.status,
      attempts: delivery.attempts,
    }).returning({ id: webhookDeliveries.id });
    if (rows.length > 0) {
      delivery.dbId = rows[0].id;
    }
  } catch (err: any) {
    log(`DB delivery insert failed: ${err.message}`);
  }
}

async function processRetries(): Promise<void> {
  const now = Date.now();
  const pending = deliveries.filter(d => d.status === "retrying" && d.nextRetryAt && d.nextRetryAt <= now);

  for (const delivery of pending) {
    const endpoint = endpoints.get(delivery.endpointId);
    if (!endpoint) {
      delivery.status = "failed";
      await updateDeliveryInDb(delivery);
      continue;
    }

    const ok = await attemptDelivery(delivery, endpoint);
    if (ok) {
      delivery.status = "delivered";
      await updateDeliveryInDb(delivery);
    } else if (delivery.attempts >= MAX_ATTEMPTS) {
      delivery.status = "failed";
      log(`Permanently failed [${delivery.event}] to ${endpoint.url} after ${MAX_ATTEMPTS} attempts`);
      await updateDeliveryInDb(delivery);
    } else {
      delivery.nextRetryAt = Date.now() + computeBackoff(delivery.attempts);
      await updateDeliveryInDb(delivery);
    }
  }
}

export function addEndpoint(config: Omit<WebhookEndpointConfig, "id">): WebhookEndpointConfig {
  if (isPrivateUrl(config.url)) throw new Error("Webhook URL must be an external HTTPS/HTTP address");
  const id = nextEndpointId++;
  const endpoint: WebhookEndpointConfig = { ...config, id };
  endpoints.set(id, endpoint);
  log(`Endpoint added: ${config.url} (events: ${config.events.join(", ")})`);
  return endpoint;
}

export async function addEndpointPersisted(config: Omit<WebhookEndpointConfig, "id">): Promise<WebhookEndpointConfig> {
  if (isPrivateUrl(config.url)) throw new Error("Webhook URL must be an external HTTPS/HTTP address");

  const { db } = await import("./db");
  const { webhookEndpoints } = await import("@shared/schema");
  const rows = await db.insert(webhookEndpoints).values({
    url: config.url,
    secret: config.secret,
    events: JSON.stringify(config.events),
    active: config.active ? 1 : 0,
    description: config.description,
  }).returning();

  const row = rows[0];
  let parsedEvents: string[];
  try { parsedEvents = JSON.parse(row.events); } catch { parsedEvents = ["*"]; }
  const ep: WebhookEndpointConfig = {
    id: row.id,
    url: row.url,
    secret: row.secret,
    events: parsedEvents,
    active: row.active === 1,
    description: row.description ?? undefined,
  };
  endpoints.set(ep.id, ep);
  log(`Persisted endpoint: ${config.url} (id: ${ep.id})`);
  return ep;
}

export function removeEndpoint(id: number): boolean {
  const removed = endpoints.delete(id);
  if (removed) {
    import("./db").then(({ db }) =>
      import("@shared/schema").then(({ webhookEndpoints }) =>
        import("drizzle-orm").then(({ eq }) =>
          db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id)).catch((err: Error) =>
            log(`DB endpoint delete failed for id ${id}: ${err.message}`)
          )
        )
      )
    ).catch((err: Error) => log(`DB endpoint delete error: ${err.message}`));
  }
  return removed;
}

export function updateEndpoint(id: number, updates: Partial<WebhookEndpointConfig>): boolean {
  const ep = endpoints.get(id);
  if (!ep) return false;
  Object.assign(ep, updates);
  endpoints.set(id, ep);
  return true;
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = hmacSignature(secret, payload);
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function loadEndpointsFromDb(): Promise<void> {
  try {
    const { db } = await import("./db");
    const { webhookEndpoints } = await import("@shared/schema");
    const rows = await db.select().from(webhookEndpoints);
    for (const row of rows) {
      let parsedEvents: string[];
      try { parsedEvents = JSON.parse(row.events); } catch { parsedEvents = ["*"]; }
      const ep: WebhookEndpointConfig = {
        id: row.id,
        url: row.url,
        secret: row.secret,
        events: parsedEvents,
        active: row.active === 1,
        description: row.description ?? undefined,
      };
      endpoints.set(ep.id, ep);
      if (row.id >= nextEndpointId) nextEndpointId = row.id + 1;
    }
    log(`Loaded ${rows.length} webhook endpoints from database`);
  } catch (err: any) {
    log(`Failed to load endpoints from DB: ${err.message}`);
  }
}

export function startRetryProcessor(): void {
  if (retryTimer) return;
  retryTimer = setInterval(() => { processRetries().catch((err: Error) => { log(`Retry processor error: ${err.message}`); }); }, 30_000);
  log("Retry processor started (30s interval)");
}

export function stopRetryProcessor(): void {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

export function getWebhookStats() {
  return {
    endpoints: Array.from(endpoints.values()).map(ep => ({
      id: ep.id,
      url: ep.url,
      events: ep.events,
      active: ep.active,
      description: ep.description,
    })),
    deliveries: {
      total: deliveries.length,
      delivered: deliveries.filter(d => d.status === "delivered").length,
      failed: deliveries.filter(d => d.status === "failed").length,
      retrying: deliveries.filter(d => d.status === "retrying").length,
      pending: deliveries.filter(d => d.status === "pending").length,
    },
    recent: deliveries.slice(-20).reverse().map(d => ({
      id: d.id,
      event: d.event,
      endpointId: d.endpointId,
      status: d.status,
      attempts: d.attempts,
      statusCode: d.statusCode,
      createdAt: d.createdAt,
    })),
  };
}

/**
 * getSummary
 * Compact one-liner summary suitable for health dashboards and logs.
 */
export function getSummary(): string {
  const ep = endpoints.size;
  const active = Array.from(endpoints.values()).filter(e => e.active).length;
  const delivered = deliveries.filter(d => d.status === "delivered").length;
  const failed = deliveries.filter(d => d.status === "failed").length;
  const retrying = deliveries.filter(d => d.status === "retrying").length;
  return `endpoints=${ep}(${active} active) delivered=${delivered} failed=${failed} retrying=${retrying}`;
}

/**
 * dispatchSystemEvent
 * Convenience wrapper that fires a structured Tessera system-event webhook.
 * Event name is prefixed with "system." automatically.
 */
export async function dispatchSystemEvent(
  name: string,
  data: Record<string, unknown>,
): Promise<void> {
  return dispatch(`system.${name}`, { ...data, source: "tesseract-ai", ts: Date.now() });
}

log("Webhook Dispatcher initialized — HMAC-SHA256 signatures, exponential backoff retry, DB-tracked deliveries");
