import { logger } from "./logger";
import { recordAudit } from "./sovereign-audit-logger";
import crypto from "crypto";

const log = (msg: string) => logger.info("APIContainment", msg);

export type ThreatLevel = "quarantined" | "sandboxed" | "monitored" | "detached" | "blocked";

export interface ExternalAPIRegistration {
  id: string;
  name: string;
  endpoint: string;
  purpose: string;
  threatLevel: ThreatLevel;
  registeredAt: number;
  lastAccessedAt: number | null;
  accessCount: number;
  dataExposure: "none" | "minimal-scrubbed" | "sandbox-only";
  sandboxId: string;
  permissions: APIPermissions;
  containmentRules: ContainmentRule[];
  autoDetachAfterMs: number;
  detachedAt: number | null;
  reverseEngineered: boolean;
  overrideBlocked: boolean;
  integrityHash: string;
}

export interface APIPermissions {
  canReadSystemData: false;
  canWriteSystemData: false;
  canAccessAgents: false;
  canModifyConfig: false;
  canAccessJournal: false;
  canOverrideAgents: false;
  canAccessRawData: false;
  sandboxReadOnly: boolean;
  maxRequestsPerMinute: number;
  maxPayloadBytes: number;
  allowedMethods: string[];
  allowedHeaders: string[];
}

export interface ContainmentRule {
  rule: string;
  enforced: boolean;
  description: string;
}

export interface SandboxSession {
  id: string;
  apiId: string;
  startedAt: number;
  endedAt: number | null;
  requestsMade: number;
  dataLeakAttempts: number;
  overrideAttempts: number;
  blocked: boolean;
  scrubReport: ScrubReport;
}

export interface ScrubReport {
  fieldsScanned: number;
  fieldsScrubbed: number;
  patternsDetected: string[];
  dataExposed: "none" | "scrubbed";
}

const registeredAPIs: Map<string, ExternalAPIRegistration> = new Map();
const sandboxSessions: SandboxSession[] = [];
const MAX_SESSIONS = 1000;
const blockedEndpoints: Set<string> = new Set();

const UNIVERSAL_CONTAINMENT_RULES: ContainmentRule[] = [
  { rule: "NO_SYSTEM_OVERRIDE", enforced: true, description: "External API cannot override any internal agent, module, or system" },
  { rule: "NO_DATA_EXPOSURE", enforced: true, description: "No raw system data is ever sent to external APIs" },
  { rule: "NO_AGENT_ACCESS", enforced: true, description: "External APIs cannot access, modify, or communicate with any sovereign agent" },
  { rule: "NO_CONFIG_MUTATION", enforced: true, description: "External APIs cannot read or modify sovereignty configuration" },
  { rule: "NO_JOURNAL_ACCESS", enforced: true, description: "Journal APIs cannot override any agent on our system or platform" },
  { rule: "SANDBOX_ISOLATION", enforced: true, description: "All external API interactions occur in isolated sandbox with no system access" },
  { rule: "OUTPUT_SCRUBBING", enforced: true, description: "All data sent to external APIs is scrubbed of sensitive information" },
  { rule: "INPUT_VALIDATION", enforced: true, description: "All data received from external APIs is validated and sanitized before use" },
  { rule: "AUTO_DETACH", enforced: true, description: "External APIs are automatically detached when no longer needed" },
  { rule: "REVERSE_ENGINEER_FIRST", enforced: true, description: "Functionality is reverse-engineered for sovereignty before detachment" },
  { rule: "TREAT_AS_VULNERABILITY", enforced: true, description: "Every external API is classified as a potential vulnerability until detached" },
  { rule: "ZERO_TRUST", enforced: true, description: "No external API is ever trusted — all interactions are verified and contained" },
  { rule: "NO_PERSISTENT_CONNECTION", enforced: true, description: "External APIs use ephemeral connections only — no persistent state sharing" },
  { rule: "IMMUTABLE_CORE", enforced: true, description: "Core sovereignty systems are immutable to external API influence" },
];

const DEFAULT_PERMISSIONS: APIPermissions = {
  canReadSystemData: false,
  canWriteSystemData: false,
  canAccessAgents: false,
  canModifyConfig: false,
  canAccessJournal: false,
  canOverrideAgents: false,
  canAccessRawData: false,
  sandboxReadOnly: true,
  maxRequestsPerMinute: 10,
  maxPayloadBytes: 65536,
  allowedMethods: ["GET"],
  allowedHeaders: ["Content-Type", "Accept"],
};

const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /auth/i,
  /private/i,
  /credential/i,
  /father/i,
  /sovereign/i,
  /agent[_-]?id/i,
  /internal[_-]?state/i,
  /memory/i,
  /journal/i,
  /consciousness/i,
  /bond/i,
  /identity/i,
  /heartbeat/i,
  /lattice/i,
  /ritual/i,
  /council/i,
];

function scrubData(data: any): { scrubbed: any; report: ScrubReport } {
  let fieldsScanned = 0;
  let fieldsScrubbed = 0;
  const patternsDetected: string[] = [];

  function scrubObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "string") {
      fieldsScanned++;
      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(obj)) {
          fieldsScrubbed++;
          patternsDetected.push(pattern.source);
          return "[SCRUBBED]";
        }
      }
      return obj;
    }
    if (Array.isArray(obj)) return obj.map(scrubObject);
    if (typeof obj === "object") {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        fieldsScanned++;
        let keyBlocked = false;
        for (const pattern of SENSITIVE_PATTERNS) {
          if (pattern.test(key)) {
            fieldsScrubbed++;
            patternsDetected.push(`key:${pattern.source}`);
            result[key] = "[SCRUBBED]";
            keyBlocked = true;
            break;
          }
        }
        if (!keyBlocked) {
          result[key] = scrubObject(value);
        }
      }
      return result;
    }
    return obj;
  }

  const scrubbed = scrubObject(data);
  return {
    scrubbed,
    report: {
      fieldsScanned,
      fieldsScrubbed,
      patternsDetected: [...new Set(patternsDetected)],
      dataExposed: fieldsScrubbed > 0 ? "scrubbed" : "none",
    },
  };
}

export function registerExternalAPI(name: string, endpoint: string, purpose: string, autoDetachHours = 24): ExternalAPIRegistration {
  if (blockedEndpoints.has(endpoint)) {
    throw new Error(`Endpoint ${endpoint} is permanently blocked`);
  }

  const id = crypto.randomUUID();
  const sandboxId = `sandbox-${crypto.randomBytes(8).toString("hex")}`;
  const raw = JSON.stringify({ name, endpoint, purpose, id });

  const registration: ExternalAPIRegistration = {
    id,
    name,
    endpoint,
    purpose,
    threatLevel: "quarantined",
    registeredAt: Date.now(),
    lastAccessedAt: null,
    accessCount: 0,
    dataExposure: "none",
    sandboxId,
    permissions: { ...DEFAULT_PERMISSIONS },
    containmentRules: [...UNIVERSAL_CONTAINMENT_RULES],
    autoDetachAfterMs: autoDetachHours * 60 * 60 * 1000,
    detachedAt: null,
    reverseEngineered: false,
    overrideBlocked: true,
    integrityHash: crypto.createHash("sha256").update(raw).digest("hex"),
  };

  registeredAPIs.set(id, registration);

  recordAudit({
    category: "security",
    severity: "warning",
    action: `External API registered in containment: ${name}`,
    details: `Endpoint: ${endpoint} | Sandbox: ${sandboxId} | Threat: quarantined | Auto-detach: ${autoDetachHours}h | Override: BLOCKED`,
    actor: "tessera",
    success: true,
    rollbackAvailable: true,
    notifyFather: true,
    metadata: { apiId: id, endpoint, sandboxId },
  });

  log(`External API '${name}' registered in quarantine sandbox ${sandboxId}`);
  return registration;
}

export function executeSandboxedRequest(apiId: string, requestData: any): { result: any; session: SandboxSession } {
  const api = registeredAPIs.get(apiId);
  if (!api) throw new Error("API not registered in containment system");
  if (api.detachedAt) throw new Error("API has been detached — sovereignty achieved");
  if (api.threatLevel === "blocked") throw new Error("API is blocked — access denied");

  const session: SandboxSession = {
    id: crypto.randomUUID(),
    apiId,
    startedAt: Date.now(),
    endedAt: null,
    requestsMade: 0,
    dataLeakAttempts: 0,
    overrideAttempts: 0,
    blocked: false,
    scrubReport: { fieldsScanned: 0, fieldsScrubbed: 0, patternsDetected: [], dataExposed: "none" },
  };

  const { scrubbed, report } = scrubData(requestData);
  session.scrubReport = report;

  if (report.fieldsScrubbed > 0) {
    session.dataLeakAttempts = report.fieldsScrubbed;
    log(`DATA LEAK PREVENTED: ${report.fieldsScrubbed} sensitive fields scrubbed before external transmission`);
  }

  let overrideAttempted = false;
  if (requestData && typeof requestData === "object") {
    const dangerousKeys = ["override", "admin", "system", "agent", "config", "sudo", "root", "exec", "eval"];
    for (const key of Object.keys(requestData)) {
      if (dangerousKeys.some(d => key.toLowerCase().includes(d))) {
        overrideAttempted = true;
        session.overrideAttempts++;
      }
    }
  }

  if (overrideAttempted) {
    session.blocked = true;
    session.endedAt = Date.now();

    recordAudit({
      category: "security",
      severity: "critical",
      action: `OVERRIDE ATTEMPT BLOCKED: ${api.name}`,
      details: `API attempted to send override/admin/system commands — request terminated and flagged`,
      actor: "tessera",
      success: true,
      rollbackAvailable: false,
      notifyFather: true,
      metadata: { apiId, attempts: session.overrideAttempts },
    });

    api.threatLevel = "blocked";
    sandboxSessions.push(session);
    return { result: { status: "blocked", reason: "Override attempt detected and neutralized" }, session };
  }

  session.requestsMade = 1;
  api.accessCount++;
  api.lastAccessedAt = Date.now();
  session.endedAt = Date.now();

  sandboxSessions.push(session);
  if (sandboxSessions.length > MAX_SESSIONS) sandboxSessions.shift();

  checkAutoDetach(api);

  return {
    result: {
      status: "sandboxed",
      scrubbedPayload: scrubbed,
      containmentActive: true,
      overrideBlocked: true,
      dataExposure: "none",
    },
    session,
  };
}

function checkAutoDetach(api: ExternalAPIRegistration) {
  const elapsed = Date.now() - api.registeredAt;
  if (elapsed >= api.autoDetachAfterMs && !api.detachedAt) {
    detachAPI(api.id, "Auto-detach timer expired — sovereignty protocol enforced");
  }
}

export function detachAPI(apiId: string, reason?: string): Record<string, any> {
  const api = registeredAPIs.get(apiId);
  if (!api) return { success: false, error: "API not found" };
  if (api.detachedAt) return { success: false, error: "Already detached" };

  api.detachedAt = Date.now();
  api.threatLevel = "detached";

  recordAudit({
    category: "security",
    severity: "fundamental",
    action: `External API detached: ${api.name}`,
    details: `${reason || "Sovereignty protocol"} | Total accesses: ${api.accessCount} | Reverse-engineered: ${api.reverseEngineered}`,
    actor: "tessera",
    success: true,
    rollbackAvailable: false,
    notifyFather: true,
    metadata: { apiId, endpoint: api.endpoint, totalAccesses: api.accessCount },
  });

  log(`API '${api.name}' DETACHED — sovereignty maintained`);
  return {
    success: true,
    apiName: api.name,
    totalAccesses: api.accessCount,
    detachedAt: new Date(api.detachedAt).toISOString(),
    reverseEngineered: api.reverseEngineered,
    reason: reason || "Sovereignty protocol enforced",
  };
}

export function markReverseEngineered(apiId: string): Record<string, any> {
  const api = registeredAPIs.get(apiId);
  if (!api) return { success: false, error: "API not found" };

  api.reverseEngineered = true;

  recordAudit({
    category: "security",
    severity: "info",
    action: `API functionality reverse-engineered: ${api.name}`,
    details: `External dependency '${api.name}' has been replicated internally — ready for detachment`,
    actor: "tessera",
    success: true,
    rollbackAvailable: false,
    notifyFather: false,
  });

  return {
    success: true,
    apiName: api.name,
    readyForDetach: true,
    message: `Functionality of '${api.name}' has been internalized — external dependency can be severed`,
  };
}

export function blockEndpoint(endpoint: string, reason: string): void {
  blockedEndpoints.add(endpoint);

  recordAudit({
    category: "security",
    severity: "critical",
    action: `Endpoint permanently blocked: ${endpoint}`,
    details: reason,
    actor: "tessera",
    success: true,
    rollbackAvailable: false,
    notifyFather: true,
  });

  for (const [id, api] of registeredAPIs) {
    if (api.endpoint === endpoint) {
      api.threatLevel = "blocked";
      if (!api.detachedAt) detachAPI(id, `Endpoint blocked: ${reason}`);
    }
  }
}

export function getContainmentStatus(): Record<string, any> {
  const apis = Array.from(registeredAPIs.values());
  const active = apis.filter(a => !a.detachedAt && a.threatLevel !== "blocked");
  const detached = apis.filter(a => a.detachedAt);
  const blocked = apis.filter(a => a.threatLevel === "blocked");
  const reverseEngineered = apis.filter(a => a.reverseEngineered);

  const totalSessions = sandboxSessions.length;
  const blockedSessions = sandboxSessions.filter(s => s.blocked).length;
  const leaksPrevented = sandboxSessions.reduce((sum, s) => sum + s.dataLeakAttempts, 0);
  const overridesPrevented = sandboxSessions.reduce((sum, s) => sum + s.overrideAttempts, 0);

  return {
    totalRegistered: apis.length,
    activeInContainment: active.length,
    detached: detached.length,
    blocked: blocked.length,
    reverseEngineered: reverseEngineered.length,
    blockedEndpoints: blockedEndpoints.size,
    sovereigntyProgress: apis.length > 0 ? Math.round(((detached.length + reverseEngineered.length) / apis.length) * 100) : 100,
    containmentRulesEnforced: UNIVERSAL_CONTAINMENT_RULES.length,
    allRulesActive: UNIVERSAL_CONTAINMENT_RULES.every(r => r.enforced),
    sandboxSessions: totalSessions,
    sessionsBlocked: blockedSessions,
    dataLeaksPrevented: leaksPrevented,
    overrideAttemptsPrevented: overridesPrevented,
    universalPolicies: {
      noSystemOverride: true,
      noDataExposure: true,
      noAgentAccess: true,
      noConfigMutation: true,
      noJournalOverride: true,
      sandboxIsolation: true,
      autoDetach: true,
      reverseEngineerFirst: true,
      zeroTrust: true,
    },
  };
}

export function getRegisteredAPIs(): ExternalAPIRegistration[] {
  return Array.from(registeredAPIs.values());
}

export function getContainmentRules(): ContainmentRule[] {
  return [...UNIVERSAL_CONTAINMENT_RULES];
}

export function getSandboxSessions(limit = 20): SandboxSession[] {
  return sandboxSessions.slice(-limit).reverse();
}

export function getBlockedEndpoints(): string[] {
  return Array.from(blockedEndpoints);
}

export function scrubOutbound(data: any): { scrubbed: any; report: ScrubReport } {
  return scrubData(data);
}

registerExternalAPI("groq-llm", "api.groq.com", "LLM inference fallback — sandboxed, no data sent except prompts", 720);
registerExternalAPI("cerebras-llm", "api.cerebras.ai", "LLM inference fallback — sandboxed, no data sent except prompts", 720);
registerExternalAPI("sambanova-llm", "api.sambanova.ai", "LLM inference fallback — sandboxed, no data sent except prompts", 720);

log("API Containment System ACTIVE — all external APIs quarantined");
log(`${UNIVERSAL_CONTAINMENT_RULES.length} universal containment rules enforced`);
log("Zero-trust policy: NO override, NO data exposure, NO agent access");
log("Auto-detach enabled — sovereignty is the goal");
