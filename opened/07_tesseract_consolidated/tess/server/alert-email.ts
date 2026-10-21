import { logger } from "./logger";

const log = (msg: string) => logger.info("AlertEmail", msg);

export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertType = "trade_failure" | "security_event" | "budget_exhausted" | "system_error" | "agent_down" | "general";

export interface AlertEmailRecord {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  subject: string;
  body: string;
  recipient: string;
  status: "sent" | "failed" | "skipped";
  provider: "sendgrid" | "smtp" | "none";
  sentAt?: number;
  error?: string;
  createdAt: number;
}

const alertHistory: AlertEmailRecord[] = [];
const ALERT_EMAIL = () => process.env.ALERT_EMAIL || process.env.OUTREACH_EMAIL || "alerts@sovereign.ai";
const SENDGRID_KEY = () => process.env.SENDGRID_API_KEY;
const SMTP_HOST = () => process.env.SMTP_HOST;

const dedupeCache = new Map<string, number>();
const DEDUPE_WINDOW_MS = 15 * 60 * 1000;

function dedupeKey(type: AlertType, subject: string): string {
  return `${type}:${subject.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 60)}`;
}

function isDuplicate(type: AlertType, subject: string): boolean {
  const key = dedupeKey(type, subject);
  const last = dedupeCache.get(key);
  if (last && Date.now() - last < DEDUPE_WINDOW_MS) return true;
  dedupeCache.set(key, Date.now());
  if (dedupeCache.size > 200) {
    const oldest = Array.from(dedupeCache.entries()).sort((a, b) => a[1] - b[1]).slice(0, 100);
    for (const [k] of oldest) dedupeCache.delete(k);
  }
  return false;
}

async function sendViaSendGrid(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const key = SENDGRID_KEY();
  if (!key) return { ok: false, error: "SENDGRID_API_KEY not configured" };

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.SENDGRID_FROM_EMAIL || "noreply@sovereign.ai", name: "Tesseract AI" },
        subject,
        content: [{ type: "text/html", value: html }],
        mail_settings: { sandbox_mode: { enable: process.env.NODE_ENV !== "production" } },
      }),
    });

    if (res.ok || res.status === 202) {
      return { ok: true };
    }
    const body = await res.text();
    return { ok: false, error: `SendGrid ${res.status}: ${body.slice(0, 200)}` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

async function sendViaNodemailer(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const host = SMTP_HOST();
  if (!host) return { ok: false, error: "SMTP_HOST not configured" };

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || "",
      } : undefined,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `Tesseract AI <noreply@sovereign.ai>`,
      to,
      subject,
      html,
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

function buildAlertHtml(type: AlertType, severity: AlertSeverity, message: string, details?: Record<string, any>): string {
  const colors: Record<AlertSeverity, string> = {
    critical: "#ff0000",
    high: "#ff6600",
    medium: "#ffaa00",
    low: "#00aa00",
  };

  const detailRows = details
    ? Object.entries(details).map(([k, v]) => `<tr><td style="color:#aaa;padding:4px 8px">${k}</td><td style="padding:4px 8px">${v}</td></tr>`).join("")
    : "";

  return `<!DOCTYPE html><html><body style="font-family:monospace;background:#0a0a0f;color:#e8e8e8;padding:24px">
<div style="max-width:600px;margin:0 auto;border:1px solid ${colors[severity]};border-radius:8px;overflow:hidden">
<div style="background:${colors[severity]}22;border-bottom:1px solid ${colors[severity]};padding:16px 24px">
<h2 style="margin:0;color:${colors[severity]}">⚠ ${severity.toUpperCase()} ALERT — ${type.replace(/_/g, " ").toUpperCase()}</h2>
</div>
<div style="padding:24px">
<p style="font-size:16px;line-height:1.6">${message}</p>
${details ? `<table style="margin-top:16px;width:100%;border-collapse:collapse">${detailRows}</table>` : ""}
<p style="margin-top:24px;color:#666;font-size:12px">Sent by Tesseract AI autonomous monitoring — ${new Date().toISOString()}</p>
</div>
</div>
</body></html>`;
}

export async function sendAlert(
  type: AlertType,
  severity: AlertSeverity,
  subject: string,
  message: string,
  details?: Record<string, any>
): Promise<AlertEmailRecord> {
  const recipient = ALERT_EMAIL();
  const record: AlertEmailRecord = {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    severity,
    subject: `[${severity.toUpperCase()}] ${subject}`,
    body: message,
    recipient,
    status: "skipped",
    provider: "none",
    createdAt: Date.now(),
  };

  if (severity === "low" || severity === "medium") {
    if (isDuplicate(type, subject)) {
      log(`Alert deduplicated: ${subject}`);
      alertHistory.push(record);
      return record;
    }
  }

  const html = buildAlertHtml(type, severity, message, details);

  const sgResult = await sendViaSendGrid(recipient, record.subject, html);
  if (sgResult.ok) {
    record.status = "sent";
    record.provider = "sendgrid";
    record.sentAt = Date.now();
    log(`Alert sent via SendGrid: [${severity}] ${subject}`);
  } else {
    const smtpResult = await sendViaNodemailer(recipient, record.subject, html);
    if (smtpResult.ok) {
      record.status = "sent";
      record.provider = "smtp";
      record.sentAt = Date.now();
      log(`Alert sent via SMTP: [${severity}] ${subject}`);
    } else {
      record.status = "failed";
      record.error = sgResult.error || smtpResult.error;
      log(`Alert FAILED [${severity}] ${subject}: ${record.error}`);
    }
  }

  alertHistory.push(record);
  if (alertHistory.length > 1000) alertHistory.splice(0, 200);
  return record;
}

export async function sendTradeFailureAlert(details: {
  agent: string;
  action: string;
  amount?: string;
  error: string;
  txId?: string;
}): Promise<AlertEmailRecord> {
  return sendAlert(
    "trade_failure",
    "critical",
    `Trade execution failed — ${details.agent}`,
    `Agent <strong>${details.agent}</strong> failed to execute: <strong>${details.action}</strong>.<br>Error: ${details.error}`,
    details
  );
}

export async function sendSecurityAlert(details: {
  event: string;
  source?: string;
  severity?: AlertSeverity;
  description: string;
}): Promise<AlertEmailRecord> {
  return sendAlert(
    "security_event",
    details.severity || "high",
    `Security event: ${details.event}`,
    details.description,
    { event: details.event, source: details.source || "unknown" }
  );
}

export async function sendBudgetExhaustedAlert(details: {
  agentId: string;
  budgetType: string;
  used: number;
  limit: number;
}): Promise<AlertEmailRecord> {
  const pct = Math.round((details.used / details.limit) * 100);
  return sendAlert(
    "budget_exhausted",
    pct >= 100 ? "critical" : "high",
    `Budget ${pct >= 100 ? "exhausted" : "warning"} — ${details.agentId}`,
    `Agent <strong>${details.agentId}</strong> has used ${pct}% of its ${details.budgetType} budget.`,
    details
  );
}

export function getAlertEmailStats() {
  return {
    configured: {
      sendgrid: !!SENDGRID_KEY(),
      smtp: !!SMTP_HOST(),
    },
    alertsTotal: alertHistory.length,
    alertsSent: alertHistory.filter(a => a.status === "sent").length,
    alertsFailed: alertHistory.filter(a => a.status === "failed").length,
    recentAlerts: alertHistory.slice(-10).reverse(),
    recipient: ALERT_EMAIL(),
  };
}

/**
 * testAlertConnectivity
 * Sends a lightweight probe to verify the active email provider responds.
 * Uses SendGrid sandbox mode (no actual email delivered) when SENDGRID_API_KEY
 * is set; falls back to SMTP VRFY when only SMTP is configured.
 * Returns { provider, ok, latencyMs, error? }.
 */
export async function testAlertConnectivity(): Promise<{ provider: "sendgrid" | "smtp" | "none"; ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  const key = SENDGRID_KEY();
  if (key) {
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: ALERT_EMAIL() }] }],
          from: { email: process.env.SENDGRID_FROM_EMAIL || "noreply@sovereign.ai" },
          subject: "Tesseract connectivity probe",
          content: [{ type: "text/plain", value: "probe" }],
          mail_settings: { sandbox_mode: { enable: true } },
        }),
      });
      const latencyMs = Date.now() - start;
      if (res.ok || res.status === 202) return { provider: "sendgrid", ok: true, latencyMs };
      const body = await res.text();
      return { provider: "sendgrid", ok: false, latencyMs, error: `${res.status}: ${body.slice(0, 120)}` };
    } catch (err: any) {
      return { provider: "sendgrid", ok: false, latencyMs: Date.now() - start, error: err.message };
    }
  }
  const host = SMTP_HOST();
  if (host) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined,
      });
      await transporter.verify();
      return { provider: "smtp", ok: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { provider: "smtp", ok: false, latencyMs: Date.now() - start, error: err.message };
    }
  }
  return { provider: "none", ok: false, latencyMs: 0, error: "No email provider configured" };
}

log("Alert Email service initialized — SendGrid primary / SMTP fallback / connectivity test available");
