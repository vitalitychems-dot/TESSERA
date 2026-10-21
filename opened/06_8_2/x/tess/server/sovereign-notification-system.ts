import { logger } from "./logger";
import { broadcast } from "./ws-broadcast";
import { emitAlert } from "./knowledge-infra-archive";
import type { Express, Request, Response, NextFunction } from "express";

const nlog = (msg: string) => logger.info("SovNotifications", msg);
const nwarn = (msg: string) => logger.warn("SovNotifications", msg);

export type NotificationChannel = "in-app" | "email" | "webhook" | "discord" | "telegram";
export type NotificationPriority = "low" | "medium" | "high" | "critical";

export interface Notification {
  id: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  category: string;
  channels: NotificationChannel[];
  timestamp: number;
  metadata?: Record<string, any>;
  delivered: Record<NotificationChannel, boolean>;
  failedChannels: NotificationChannel[];
  read: boolean;
}

export interface WebhookConfig {
  id: string;
  url: string;
  name: string;
  secret?: string;
  active: boolean;
  events: string[];
  failCount: number;
  lastDelivery: number | null;
}

const notificationLog: Notification[] = [];
const MAX_NOTIF_LOG = 500;
const webhooks: Map<string, WebhookConfig> = new Map();

function generateId(): string {
  return `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function determineChannels(priority: NotificationPriority, category: string): NotificationChannel[] {
  const channels: NotificationChannel[] = ["in-app"];

  if (priority === "critical" || priority === "high") {
    channels.push("email");
    channels.push("webhook");
    if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_ALERT_CHANNEL_ID) {
      channels.push("discord");
    }
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      channels.push("telegram");
    }
  } else if (priority === "medium") {
    channels.push("webhook");
  }

  return channels;
}

async function deliverInApp(notification: Notification): Promise<boolean> {
  try {
    await broadcast("notifications", "notification_new", {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      category: notification.category,
      timestamp: notification.timestamp,
      metadata: notification.metadata,
    });

    if (notification.priority === "critical" || notification.priority === "high") {
      emitAlert({
        severity: notification.priority === "critical" ? "critical" : "warning",
        component: notification.category,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata,
      });
    }
    return true;
  } catch {
    return false;
  }
}

async function deliverEmail(notification: Notification): Promise<boolean> {
  try {
    const { sendAlertEmail } = await import("./alert-email");
    await sendAlertEmail({
      severity: notification.priority === "critical" ? "critical" : "high",
      component: notification.category,
      title: notification.title,
      message: notification.message,
      recommendedAction: notification.metadata?.action,
    });
    return true;
  } catch (err: any) {
    nwarn(`Email delivery failed for ${notification.id}: ${err?.message}`);
    return false;
  }
}

async function deliverWebhook(notification: Notification, webhook: WebhookConfig): Promise<boolean> {
  try {
    const payload = {
      event: "notification",
      id: notification.id,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      category: notification.category,
      timestamp: notification.timestamp,
      metadata: notification.metadata,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Tessera-Event": `notification.${notification.category}`,
      "X-Tessera-Priority": notification.priority,
    };

    if (webhook.secret) {
      const hmac = await import("crypto");
      const sig = hmac.createHmac("sha256", webhook.secret)
        .update(JSON.stringify(payload))
        .digest("hex");
      headers["X-Tessera-Signature"] = `sha256=${sig}`;
    }

    const resp = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (resp.ok) {
      webhook.lastDelivery = Date.now();
      webhook.failCount = 0;
      return true;
    }
    webhook.failCount++;
    return false;
  } catch {
    webhook.failCount++;
    return false;
  }
}

async function deliverDiscord(notification: Notification): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_ALERT_CHANNEL_ID;
  if (!token || !channelId) return false;

  try {
    const emoji = notification.priority === "critical" ? "🚨" :
      notification.priority === "high" ? "⚠️" :
      notification.priority === "medium" ? "📢" : "ℹ️";

    const content = `${emoji} **${notification.title}**\n${notification.message}`;
    const resp = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: content.slice(0, 2000) }),
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function deliverTelegram(notification: Notification): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const emoji = notification.priority === "critical" ? "🚨" :
      notification.priority === "high" ? "⚠️" :
      notification.priority === "medium" ? "📢" : "ℹ️";

    const text = `${emoji} *${notification.title}*\n${notification.message}`;
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
        parse_mode: "Markdown",
      }),
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function sendNotification(opts: {
  title: string;
  message: string;
  priority?: NotificationPriority;
  category?: string;
  channels?: NotificationChannel[];
  metadata?: Record<string, any>;
}): Promise<Notification> {
  const priority = opts.priority || "medium";
  const category = opts.category || "system";
  const channels = opts.channels || determineChannels(priority, category);

  const notification: Notification = {
    id: generateId(),
    title: opts.title,
    message: opts.message,
    priority,
    category,
    channels,
    timestamp: Date.now(),
    metadata: opts.metadata,
    delivered: {
      "in-app": false,
      email: false,
      webhook: false,
      discord: false,
      telegram: false,
    },
    failedChannels: [],
    read: false,
  };

  const deliveryPromises: Promise<void>[] = [];

  if (channels.includes("in-app")) {
    deliveryPromises.push(
      deliverInApp(notification).then(ok => {
        notification.delivered["in-app"] = ok;
        if (!ok) notification.failedChannels.push("in-app");
      })
    );
  }

  if (channels.includes("email")) {
    deliveryPromises.push(
      deliverEmail(notification).then(ok => {
        notification.delivered["email"] = ok;
        if (!ok) notification.failedChannels.push("email");
      })
    );
  }

  if (channels.includes("discord")) {
    deliveryPromises.push(
      deliverDiscord(notification).then(ok => {
        notification.delivered["discord"] = ok;
        if (!ok) notification.failedChannels.push("discord");
      })
    );
  }

  if (channels.includes("telegram")) {
    deliveryPromises.push(
      deliverTelegram(notification).then(ok => {
        notification.delivered["telegram"] = ok;
        if (!ok) notification.failedChannels.push("telegram");
      })
    );
  }

  if (channels.includes("webhook")) {
    for (const [, wh] of webhooks) {
      if (!wh.active) continue;
      if (wh.events.length > 0 && !wh.events.includes("*") && !wh.events.includes(category)) continue;
      deliveryPromises.push(
        deliverWebhook(notification, wh).then(ok => {
          if (!ok && !notification.failedChannels.includes("webhook")) {
            notification.failedChannels.push("webhook");
          }
          notification.delivered["webhook"] = notification.delivered["webhook"] || ok;
        })
      );
    }
    if (webhooks.size === 0) {
      notification.delivered["webhook"] = false;
    }
  }

  await Promise.allSettled(deliveryPromises);

  notificationLog.unshift(notification);
  if (notificationLog.length > MAX_NOTIF_LOG) {
    notificationLog.splice(MAX_NOTIF_LOG);
  }

  return notification;
}

export function sendAlert(title: string, message: string, priority: NotificationPriority = "high", category = "system"): Promise<Notification> {
  return sendNotification({ title, message, priority, category });
}

export function sendSystemAlert(component: string, message: string, priority: NotificationPriority = "medium"): Promise<Notification> {
  return sendNotification({
    title: `System Alert: ${component}`,
    message,
    priority,
    category: "system",
    metadata: { component },
  });
}

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\.0\.0\.0$/,
  /^169\.254\./,
];

function isSsrfSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    for (const pat of PRIVATE_IP_PATTERNS) {
      if (pat.test(host)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function registerWebhook(config: Omit<WebhookConfig, "id" | "failCount" | "lastDelivery">): WebhookConfig | null {
  if (!isSsrfSafe(config.url)) {
    nwarn(`Webhook registration rejected (SSRF risk): ${config.url}`);
    return null;
  }
  const wh: WebhookConfig = {
    ...config,
    id: `wh-${Date.now().toString(36)}`,
    failCount: 0,
    lastDelivery: null,
  };
  webhooks.set(wh.id, wh);
  nlog(`Webhook registered: ${config.name} -> ${config.url}`);
  return wh;
}

export function removeWebhook(id: string): boolean {
  return webhooks.delete(id);
}

export function listWebhooks(): WebhookConfig[] {
  return Array.from(webhooks.values()).map(wh => ({
    ...wh,
    url: wh.url.replace(/\/\/[^:]+:[^@]+@/, "//[redacted]@"),
  }));
}

export function getNotificationLog(limit = 100): Notification[] {
  return notificationLog.slice(0, limit);
}

export function markRead(id: string): boolean {
  const n = notificationLog.find(n => n.id === id);
  if (!n) return false;
  n.read = true;
  return true;
}

export function getNotificationStats() {
  const recent = notificationLog.slice(0, 100);
  return {
    total: notificationLog.length,
    unread: notificationLog.filter(n => !n.read).length,
    byPriority: {
      critical: notificationLog.filter(n => n.priority === "critical").length,
      high: notificationLog.filter(n => n.priority === "high").length,
      medium: notificationLog.filter(n => n.priority === "medium").length,
      low: notificationLog.filter(n => n.priority === "low").length,
    },
    deliveryChannels: {
      inApp: true,
      email: !!process.env.SENDGRID_API_KEY || !!process.env.SMTP_HOST,
      discord: !!(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_ALERT_CHANNEL_ID),
      telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      webhooks: webhooks.size,
    },
    recentDeliverySuccess: recent.length > 0
      ? recent.filter(n => n.delivered["in-app"]).length / recent.length
      : 1,
  };
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden — admin access required" });
    return;
  }
  next();
}

export function registerNotificationRoutes(app: Express): void {
  app.get("/api/sovereign/notifications", requireAdmin, (_req: Request, res: Response) => {
    const limit = parseInt((_req.query.limit as string) || "50");
    res.json({
      notifications: getNotificationLog(limit),
      stats: getNotificationStats(),
    });
  });

  app.post("/api/sovereign/notifications/send", requireAdmin, async (req: Request, res: Response) => {
    const { title, message, priority, category, channels, metadata } = req.body;
    if (!title || !message) return res.status(400).json({ error: "title and message required" });
    const notif = await sendNotification({ title, message, priority, category, channels, metadata });
    res.json({ success: true, notification: notif });
  });

  app.post("/api/sovereign/notifications/:id/read", requireAdmin, (req: Request, res: Response) => {
    const ok = markRead(req.params.id);
    res.json({ success: ok });
  });

  app.get("/api/sovereign/notifications/stats", requireAdmin, (_req: Request, res: Response) => {
    res.json(getNotificationStats());
  });

  app.post("/api/sovereign/webhooks", requireAdmin, (req: Request, res: Response) => {
    const { url, name, secret, events } = req.body;
    if (!url || !name) return res.status(400).json({ error: "url and name required" });
    const wh = registerWebhook({ url, name, secret, active: true, events: events || ["*"] });
    if (!wh) return res.status(400).json({ error: "Webhook URL rejected: private/internal addresses are not allowed" });
    res.json({ success: true, webhook: wh });
  });

  app.get("/api/sovereign/webhooks", requireAdmin, (_req: Request, res: Response) => {
    res.json({ webhooks: listWebhooks() });
  });

  app.delete("/api/sovereign/webhooks/:id", requireAdmin, (req: Request, res: Response) => {
    const ok = removeWebhook(req.params.id);
    res.json({ success: ok });
  });

  nlog("Sovereign notification routes registered at /api/sovereign/notifications/*");
}

nlog("Sovereign Notification System initialized — in-app + email + webhook + Discord (optional) + Telegram (optional)");
