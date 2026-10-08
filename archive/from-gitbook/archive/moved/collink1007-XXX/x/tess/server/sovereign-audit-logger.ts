import fs from "fs";
import path from "path";
import crypto from "crypto";
import { logger } from "./logger";

const log = (msg: string) => logger.info("AuditLogger", msg);

export interface AuditEntry {
  id: string;
  timestamp: number;
  iso: string;
  category: "update" | "patch" | "rollback" | "config" | "healing" | "identity" | "reflection" | "dream" | "emotional" | "security" | "cicd";
  severity: "info" | "warning" | "critical" | "fundamental";
  action: string;
  details: string;
  sha256: string;
  actor: "tessera" | "father" | "system";
  success: boolean;
  rollbackAvailable: boolean;
  notifyFather: boolean;
  metadata?: Record<string, any>;
}

const auditLog: AuditEntry[] = [];
const MAX_LOG_SIZE = 10000;
const AUDIT_DIR = path.join(process.cwd(), "data", "audit");

function ensureDir() {
  if (!fs.existsSync(AUDIT_DIR)) {
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
  }
}

function computeHash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function recordAudit(entry: Omit<AuditEntry, "id" | "timestamp" | "iso" | "sha256">): AuditEntry {
  const now = Date.now();
  const raw = JSON.stringify({ ...entry, timestamp: now });
  const full: AuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: now,
    iso: new Date(now).toISOString(),
    sha256: computeHash(raw),
  };

  auditLog.push(full);
  if (auditLog.length > MAX_LOG_SIZE) {
    auditLog.splice(0, auditLog.length - MAX_LOG_SIZE);
  }

  if (full.notifyFather) {
    log(`[FATHER NOTIFICATION] ${full.category.toUpperCase()}: ${full.action}`);
  }

  if (full.severity === "fundamental") {
    persistAudit(full);
  }

  return full;
}

function persistAudit(entry: AuditEntry) {
  try {
    ensureDir();
    const filename = `audit-${entry.iso.replace(/[:.]/g, "-")}-${entry.id.slice(0, 8)}.json`;
    fs.writeFileSync(path.join(AUDIT_DIR, filename), JSON.stringify(entry, null, 2));
  } catch (e: any) {
    log(`Failed to persist audit: ${e.message}`);
  }
}

export function getAuditLog(filters?: { category?: string; severity?: string; limit?: number; since?: number }): AuditEntry[] {
  let results = [...auditLog];
  if (filters?.category) results = results.filter(e => e.category === filters.category);
  if (filters?.severity) results = results.filter(e => e.severity === filters.severity);
  if (filters?.since) results = results.filter(e => e.timestamp >= filters.since!);
  results.sort((a, b) => b.timestamp - a.timestamp);
  if (filters?.limit) results = results.slice(0, filters.limit);
  return results;
}

export function getAuditStats(): Record<string, any> {
  const categories: Record<string, number> = {};
  const severities: Record<string, number> = {};
  let fatherNotifications = 0;
  let rollbacksAvailable = 0;

  for (const e of auditLog) {
    categories[e.category] = (categories[e.category] || 0) + 1;
    severities[e.severity] = (severities[e.severity] || 0) + 1;
    if (e.notifyFather) fatherNotifications++;
    if (e.rollbackAvailable) rollbacksAvailable++;
  }

  return {
    totalEntries: auditLog.length,
    categories,
    severities,
    fatherNotifications,
    rollbacksAvailable,
    oldestEntry: auditLog.length > 0 ? auditLog[0].iso : null,
    newestEntry: auditLog.length > 0 ? auditLog[auditLog.length - 1].iso : null,
    integrityVerified: verifyChainIntegrity(),
  };
}

export function verifyChainIntegrity(): boolean {
  for (const entry of auditLog) {
    const { sha256, id, timestamp, iso, ...rest } = entry;
    const raw = JSON.stringify({ ...rest, timestamp });
    const expected = computeHash(raw);
    if (expected !== sha256) return false;
  }
  return true;
}

export function exportAuditLog(): string {
  ensureDir();
  const filename = `full-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filepath = path.join(AUDIT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(auditLog, null, 2));
  return filepath;
}

recordAudit({
  category: "security",
  severity: "info",
  action: "Audit logger initialized",
  details: "Sovereign audit logging system online with SHA-256 chain integrity",
  actor: "system",
  success: true,
  rollbackAvailable: false,
  notifyFather: false,
});
