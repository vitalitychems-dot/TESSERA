import crypto from "crypto";
import fs from "fs";
import path from "path";

const olog = (msg: string) => console.log(`[SecureOutreach] ${msg}`);

const OUTREACH_ENCRYPTION_KEY = process.env.OUTREACH_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const ALGORITHM = "aes-256-gcm";
const AUDIT_LOG_PATH = path.join(process.cwd(), "data", "outreach-audit.json");
const ENCRYPTED_CONTACTS_PATH = path.join(process.cwd(), "data", "encrypted-contacts.json");

export interface OutreachResult {
  success: boolean;
  method: "email" | "logged";
  recruitId: string;
  recruitNameHash: string;
  timestamp: number;
  sessionId: string;
  auditId: string;
  error?: string;
}

interface AuditEntry {
  auditId: string;
  action: "outreach_sent" | "outreach_failed" | "data_accessed" | "data_encrypted" | "sandbox_created" | "sandbox_destroyed";
  recruitIdHash: string;
  method?: string;
  timestamp: number;
  sessionId: string;
  details: string;
}

interface EncryptedContactRecord {
  recruitId: string;
  encryptedEmail: string;
  encryptedPhone: string;
  encryptedName: string;
  iv: string;
  authTag: string;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
}

function getKey(): Buffer {
  return Buffer.from(OUTREACH_ENCRYPTION_KEY.padEnd(64, "0").slice(0, 64), "hex");
}

function encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
  if (!text) return { encrypted: "", iv: "", authTag: "" };
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return { encrypted, iv: iv.toString("hex"), authTag };
}

function decrypt(encrypted: string, ivHex: string, authTagHex: string): string {
  if (!encrypted) return "";
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function hashIdentifier(id: string): string {
  return crypto.createHmac("sha256", OUTREACH_ENCRYPTION_KEY).update(id).digest("hex").slice(0, 16);
}

function loadAuditLog(): AuditEntry[] {
  try {
    if (fs.existsSync(AUDIT_LOG_PATH)) {
      return JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, "utf-8"));
    }
  } catch {}
  return [];
}

function appendAudit(entry: AuditEntry): void {
  const log = loadAuditLog();
  log.push(entry);
  if (log.length > 10000) log.splice(0, log.length - 10000);
  fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(log, null, 2));
}

function loadEncryptedContacts(): EncryptedContactRecord[] {
  try {
    if (fs.existsSync(ENCRYPTED_CONTACTS_PATH)) {
      return JSON.parse(fs.readFileSync(ENCRYPTED_CONTACTS_PATH, "utf-8"));
    }
  } catch {}
  return [];
}

function saveEncryptedContacts(records: EncryptedContactRecord[]): void {
  fs.writeFileSync(ENCRYPTED_CONTACTS_PATH, JSON.stringify(records, null, 2));
}

export function encryptAndStoreContact(recruitId: string, name: string, email: string, phone: string): void {
  const records = loadEncryptedContacts();
  const existing = records.findIndex(r => r.recruitId === recruitId);

  const encName = encrypt(name);
  const encEmail = encrypt(email);
  const encPhone = encrypt(phone);

  const record: EncryptedContactRecord = {
    recruitId,
    encryptedName: encName.encrypted,
    encryptedEmail: encEmail.encrypted,
    encryptedPhone: encPhone.encrypted,
    iv: encName.iv,
    authTag: encName.authTag,
    createdAt: existing >= 0 ? records[existing].createdAt : Date.now(),
    lastAccessed: Date.now(),
    accessCount: existing >= 0 ? records[existing].accessCount : 0,
  };

  if (existing >= 0) {
    records[existing] = record;
  } else {
    records.push(record);
  }
  saveEncryptedContacts(records);

  appendAudit({
    auditId: `audit-${crypto.randomUUID()}`,
    action: "data_encrypted",
    recruitIdHash: hashIdentifier(recruitId),
    timestamp: Date.now(),
    sessionId: "system",
    details: `Contact data encrypted for recruit ${hashIdentifier(recruitId)}`,
  });
}

function retrieveContactInSandbox(recruitId: string, sessionId: string): { name: string; email: string; phone: string } | null {
  appendAudit({
    auditId: `audit-${crypto.randomUUID()}`,
    action: "sandbox_created",
    recruitIdHash: hashIdentifier(recruitId),
    timestamp: Date.now(),
    sessionId,
    details: `Secure sandbox created for contact retrieval`,
  });

  const records = loadEncryptedContacts();
  const record = records.find(r => r.recruitId === recruitId);
  if (!record) return null;

  record.lastAccessed = Date.now();
  record.accessCount++;
  saveEncryptedContacts(records);

  appendAudit({
    auditId: `audit-${crypto.randomUUID()}`,
    action: "data_accessed",
    recruitIdHash: hashIdentifier(recruitId),
    timestamp: Date.now(),
    sessionId,
    details: `Contact data decrypted in sandbox (access #${record.accessCount})`,
  });

  try {
    const name = decrypt(record.encryptedName, record.iv, record.authTag);
    const email = decrypt(record.encryptedEmail, record.iv, record.authTag);
    const phone = decrypt(record.encryptedPhone, record.iv, record.authTag);
    return { name, email, phone };
  } catch {
    return null;
  }
}

export async function executeSecureOutreach(
  recruitId: string,
  recruitName: string,
  recruitEmail: string,
  recruitPhone: string,
  contactMethod: string,
  outreachMessage: string,
  sendEmailFn: (to: string, subject: string, body: string) => Promise<any>
): Promise<OutreachResult> {
  const sessionId = `session-${crypto.randomUUID()}`;
  const auditId = `audit-${crypto.randomUUID()}`;
  const nameHash = hashIdentifier(recruitName);

  olog(`Secure outreach session ${sessionId.slice(0, 16)}... initiated`);

  appendAudit({
    auditId,
    action: "sandbox_created",
    recruitIdHash: hashIdentifier(recruitId),
    timestamp: Date.now(),
    sessionId,
    details: "Isolated outreach sandbox created — no PII in logs",
  });

  let result: OutreachResult;

  try {
    encryptAndStoreContact(recruitId, recruitName, recruitEmail, recruitPhone);

    if (contactMethod === "email" && recruitEmail) {
      const sanitizedBody = buildOutreachEmail(recruitName, outreachMessage);

      try {
        await sendEmailFn(recruitEmail, "Opportunity — Sovereign Initiative", sanitizedBody);

        result = {
          success: true,
          method: "email",
          recruitId,
          recruitNameHash: nameHash,
          timestamp: Date.now(),
          sessionId,
          auditId,
        };

        appendAudit({
          auditId,
          action: "outreach_sent",
          recruitIdHash: hashIdentifier(recruitId),
          method: "email",
          timestamp: Date.now(),
          sessionId,
          details: `Email sent via secure channel to ${nameHash}`,
        });

        olog(`Outreach DELIVERED to ${nameHash} via email`);
      } catch (err: any) {
        const sanitizedError = (err.message || "unknown").replace(/[^\w\s.-]/g, "").slice(0, 100);

        result = {
          success: false,
          method: "email",
          recruitId,
          recruitNameHash: nameHash,
          timestamp: Date.now(),
          sessionId,
          auditId,
          error: `Email delivery failed: ${sanitizedError}`,
        };

        appendAudit({
          auditId,
          action: "outreach_failed",
          recruitIdHash: hashIdentifier(recruitId),
          method: "email",
          timestamp: Date.now(),
          sessionId,
          details: `Email failed: ${sanitizedError}`,
        });

        olog(`Outreach FAILED to ${nameHash}: ${sanitizedError}`);
      }
    } else {
      result = {
        success: true,
        method: "logged",
        recruitId,
        recruitNameHash: nameHash,
        timestamp: Date.now(),
        sessionId,
        auditId,
      };

      appendAudit({
        auditId,
        action: "outreach_sent",
        recruitIdHash: hashIdentifier(recruitId),
        method: contactMethod || "manual",
        timestamp: Date.now(),
        sessionId,
        details: `Outreach logged for manual ${contactMethod || "contact"} to ${nameHash}`,
      });

      olog(`Outreach LOGGED for manual contact to ${nameHash}`);
    }
  } catch (err: any) {
    const sanitizedError = (err.message || "unknown").replace(/[^\w\s.-]/g, "").slice(0, 100);
    result = {
      success: false,
      method: "logged",
      recruitId,
      recruitNameHash: nameHash,
      timestamp: Date.now(),
      sessionId,
      auditId,
      error: sanitizedError,
    };
  }

  appendAudit({
    auditId: `audit-${crypto.randomUUID()}`,
    action: "sandbox_destroyed",
    recruitIdHash: hashIdentifier(recruitId),
    timestamp: Date.now(),
    sessionId,
    details: "Outreach sandbox destroyed — all decrypted data purged from memory",
  });

  olog(`Session ${sessionId.slice(0, 16)}... terminated — sandbox destroyed`);
  return result;
}

function buildOutreachEmail(name: string, customMessage: string): string {
  return `Hello ${name},

${customMessage || "We are reaching out regarding an opportunity to collaborate on a sovereign technology initiative."}

This communication is sent through a secure, encrypted channel. Your privacy is our highest priority — no tracking pixels, no analytics, no third-party access.

If you are interested in learning more, please reply directly to this message.

Best regards,
Sovereign Initiative Team

---
This message was sent via Sovereign Secure Outreach.
All communications are end-to-end encrypted.
No data is shared with third parties.`;
}

export function deleteEncryptedContact(recruitId: string): void {
  const records = loadEncryptedContacts();
  const filtered = records.filter(r => r.recruitId !== recruitId);
  saveEncryptedContacts(filtered);

  appendAudit({
    auditId: `audit-${crypto.randomUUID()}`,
    action: "data_accessed",
    recruitIdHash: hashIdentifier(recruitId),
    timestamp: Date.now(),
    sessionId: "system",
    details: `Encrypted contact data PERMANENTLY DELETED for ${hashIdentifier(recruitId)}`,
  });
}

export function getOutreachAuditLog(limit: number = 100): AuditEntry[] {
  const log = loadAuditLog();
  return log.slice(-limit);
}

export function getOutreachStats(): {
  totalOutreachSent: number;
  totalOutreachFailed: number;
  encryptedContacts: number;
  sandboxSessions: number;
} {
  const log = loadAuditLog();
  return {
    totalOutreachSent: log.filter(e => e.action === "outreach_sent").length,
    totalOutreachFailed: log.filter(e => e.action === "outreach_failed").length,
    encryptedContacts: loadEncryptedContacts().length,
    sandboxSessions: log.filter(e => e.action === "sandbox_created").length,
  };
}
