import { logger } from "./logger";

interface SecurityAlert {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  type: string;
  description: string;
  sourceUrl: string;
  detectedData: string;
  action: "blocked" | "warned" | "logged";
  timestamp: number;
}

interface OutboundScanResult {
  url: string;
  safe: boolean;
  risks: string[];
  dataLeakageDetected: boolean;
  leakedFields: string[];
  fingerprintingDetected: boolean;
  fingerprintMethods: string[];
  recommendation: "allow" | "strip" | "block";
}

interface SecurityConfig {
  enabled: boolean;
  blockDataLeakage: boolean;
  blockFingerprinting: boolean;
  alertOnSuspiciousBehavior: boolean;
  maxAlertsPerHour: number;
  sensitivePatterns: RegExp[];
  architectureKeywords: string[];
  fingerprintHeaders: string[];
}

const SENSITIVE_PATTERNS = [
  /DATABASE_URL\s*[=:]/i,
  /POSTGRES(?:QL)?_(?:URL|PASSWORD|HOST)/i,
  /SESSION_SECRET\s*[=:]/i,
  /ADMIN_KEY\s*[=:]/i,
  /API_KEY\s*[=:]/i,
  /Bearer\s+[a-zA-Z0-9._-]{20,}/i,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  /password\s*[=:]\s*["'][^"']{3,}/i,
  /secret\s*[=:]\s*["'][^"']{3,}/i,
];

const ARCHITECTURE_KEYWORDS = [
  "drizzle",
  "pgvector",
  "sovereign-engine",
  "neural-synapse",
  "council-executor",
  "knowledge-engine",
  "agi-training",
  "tessera-sovereign",
  "auto-improvement-daemon",
  "autonomous-builder",
  "grand-council",
  "swarm-optimizer",
  "tesseract-orchestrator",
  "x/tess/server",
  "x/tess/client",
  "sovereign-brain-engine",
  "lattice-search-engine",
];

const FINGERPRINT_HEADERS = [
  "x-powered-by",
  "server",
  "x-aspnet-version",
  "x-runtime",
  "x-version",
  "x-generator",
  "x-framework",
  "x-node-version",
  "x-typescript-version",
];

const alerts: SecurityAlert[] = [];
let scanCount = 0;
let blockedCount = 0;
let leakageDetected = 0;
let monitoringActive = false;
let monitorInterval: ReturnType<typeof setInterval> | null = null;

const config: SecurityConfig = {
  enabled: true,
  blockDataLeakage: true,
  blockFingerprinting: true,
  alertOnSuspiciousBehavior: true,
  maxAlertsPerHour: 100,
  sensitivePatterns: [...SENSITIVE_PATTERNS],
  architectureKeywords: [...ARCHITECTURE_KEYWORDS],
  fingerprintHeaders: [...FINGERPRINT_HEADERS],
};

function generateAlertId(): string {
  return `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function checkDataLeakage(content: string): { leaked: boolean; fields: string[] } {
  const fields: string[] = [];

  for (const pattern of config.sensitivePatterns) {
    if (pattern.test(content)) {
      fields.push(pattern.source.slice(0, 30));
    }
  }

  for (const keyword of config.architectureKeywords) {
    if (content.toLowerCase().includes(keyword.toLowerCase())) {
      fields.push(`architecture:${keyword}`);
    }
  }

  return { leaked: fields.length > 0, fields };
}

function checkFingerprinting(headers: Record<string, string>): { detected: boolean; methods: string[] } {
  const methods: string[] = [];

  for (const header of config.fingerprintHeaders) {
    if (headers[header] || headers[header.toLowerCase()]) {
      methods.push(`header:${header}`);
    }
  }

  const ua = headers["user-agent"] || "";
  if (ua.includes("Node") || ua.includes("node-fetch") || ua.includes("undici")) {
    methods.push("user-agent:node-runtime-exposed");
  }

  return { detected: methods.length > 0, methods };
}

export function scanOutboundRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): OutboundScanResult {
  scanCount++;
  const risks: string[] = [];
  let dataLeakageDetected = false;
  let leakedFields: string[] = [];
  let fingerprintingDetected = false;
  let fingerprintMethods: string[] = [];

  if (body) {
    const leakageCheck = checkDataLeakage(body);
    if (leakageCheck.leaked) {
      dataLeakageDetected = true;
      leakedFields = leakageCheck.fields;
      risks.push(`Data leakage detected: ${leakedFields.join(", ")}`);
      leakageDetected++;

      if (config.blockDataLeakage) {
        createAlert("critical", "data-leakage", `Outbound request to ${url} contains sensitive data: ${leakedFields.join(", ")}`, url, leakedFields.join(", "), "blocked");
      }
    }
  }

  const headerStr = JSON.stringify(headers);
  const headerLeakage = checkDataLeakage(headerStr);
  if (headerLeakage.leaked) {
    dataLeakageDetected = true;
    leakedFields.push(...headerLeakage.fields.map(f => `header:${f}`));
    risks.push("Sensitive data in request headers");
  }

  const fpCheck = checkFingerprinting(headers);
  if (fpCheck.detected) {
    fingerprintingDetected = true;
    fingerprintMethods = fpCheck.methods;
    risks.push(`Fingerprinting vectors: ${fpCheck.methods.join(", ")}`);
  }

  let recommendation: OutboundScanResult["recommendation"] = "allow";
  if (dataLeakageDetected && config.blockDataLeakage) {
    recommendation = "block";
    blockedCount++;
  } else if (fingerprintingDetected && config.blockFingerprinting) {
    recommendation = "strip";
  }

  return {
    url,
    safe: !dataLeakageDetected && !fingerprintingDetected,
    risks,
    dataLeakageDetected,
    leakedFields,
    fingerprintingDetected,
    fingerprintMethods,
    recommendation,
  };
}

function createAlert(
  severity: SecurityAlert["severity"],
  type: string,
  description: string,
  sourceUrl: string,
  detectedData: string,
  action: SecurityAlert["action"]
): void {
  const recentAlerts = alerts.filter(a => a.timestamp > Date.now() - 3600000);
  if (recentAlerts.length >= config.maxAlertsPerHour) return;

  const alert: SecurityAlert = {
    id: generateAlertId(),
    severity,
    type,
    description,
    sourceUrl,
    detectedData: detectedData.slice(0, 200),
    action,
    timestamp: Date.now(),
  };
  alerts.push(alert);
  if (alerts.length > 500) alerts.splice(0, alerts.length - 500);

  logger.info("SecurityHardening", `[${severity.toUpperCase()}] ${type}: ${description.slice(0, 100)}`);
}

export function sanitizeOutboundHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (config.fingerprintHeaders.includes(lowerKey)) continue;

    const sanitizedValue = value
      .replace(/Node\.js\/[\d.]+/g, "")
      .replace(/Express\/[\d.]+/g, "")
      .replace(/tessera/gi, "")
      .replace(/tesseract/gi, "")
      .replace(/sovereign/gi, "");

    sanitized[key] = sanitizedValue.trim() || value;
  }

  return sanitized;
}

export function sanitizeOutboundBody(body: string): string {
  let sanitized = body;

  for (const pattern of config.sensitivePatterns) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  for (const keyword of config.architectureKeywords) {
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    sanitized = sanitized.replace(regex, "[INTERNAL]");
  }

  return sanitized;
}

export function startSecurityMonitor(): void {
  if (monitoringActive) return;
  monitoringActive = true;

  monitorInterval = setInterval(() => {
    const recentAlerts = alerts.filter(a => a.timestamp > Date.now() - 300000);
    const criticalAlerts = recentAlerts.filter(a => a.severity === "critical");

    if (criticalAlerts.length > 5) {
      logger.info("SecurityHardening", `ELEVATED THREAT: ${criticalAlerts.length} critical alerts in last 5 minutes`);
      config.blockDataLeakage = true;
      config.blockFingerprinting = true;
    }
  }, 60000);

  logger.info("SecurityHardening", "Security monitoring started (60s scan interval)");
}

export function stopSecurityMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  monitoringActive = false;
}

export function getSecurityStats(): {
  totalScans: number;
  blockedRequests: number;
  leakageDetections: number;
  alertCount: number;
  criticalAlerts: number;
  monitoringActive: boolean;
  config: Omit<SecurityConfig, "sensitivePatterns"> & { sensitivePatternCount: number };
  recentAlerts: SecurityAlert[];
} {
  return {
    totalScans: scanCount,
    blockedRequests: blockedCount,
    leakageDetections: leakageDetected,
    alertCount: alerts.length,
    criticalAlerts: alerts.filter(a => a.severity === "critical").length,
    monitoringActive,
    config: {
      enabled: config.enabled,
      blockDataLeakage: config.blockDataLeakage,
      blockFingerprinting: config.blockFingerprinting,
      alertOnSuspiciousBehavior: config.alertOnSuspiciousBehavior,
      maxAlertsPerHour: config.maxAlertsPerHour,
      architectureKeywords: config.architectureKeywords,
      fingerprintHeaders: config.fingerprintHeaders,
      sensitivePatternCount: config.sensitivePatterns.length,
    },
    recentAlerts: alerts.slice(-20),
  };
}

export function getAlerts(filter?: { severity?: string; type?: string; limit?: number }): SecurityAlert[] {
  let result = [...alerts];
  if (filter?.severity) result = result.filter(a => a.severity === filter.severity);
  if (filter?.type) result = result.filter(a => a.type === filter.type);
  result.sort((a, b) => b.timestamp - a.timestamp);
  if (filter?.limit) result = result.slice(0, filter.limit);
  return result;
}
