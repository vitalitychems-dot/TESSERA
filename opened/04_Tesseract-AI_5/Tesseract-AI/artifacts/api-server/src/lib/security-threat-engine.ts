import { db } from "@workspace/db";
import { security_events, sovereignty_metrics, system_audit } from "@workspace/db";
import { eq, desc, sql, count } from "drizzle-orm";
import { updatePhaseProgress } from "./sovereignty-engine";
import { logger } from "./logger";

const LOG_PREFIX = "[SecurityEngine]";

interface ThreatReport {
  threatType: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  source: string;
  description: string;
  attackSurface: string;
  mitigationStatus: "detected" | "analyzing" | "mitigating" | "resolved";
  details: Record<string, any>;
}

interface SecurityScanResult {
  scanId: string;
  scanType: string;
  timestamp: number;
  findings: ThreatReport[];
  score: number;
  duration: number;
}

let scanCycleCount = 0;
let totalThreatsDetected = 0;
let totalThreatsResolved = 0;
let continuousScanInterval: ReturnType<typeof setInterval> | null = null;
let securityScore = 100;
let lastScanTimestamp = 0;

const ATTACK_SURFACES = [
  "api_endpoints",
  "database_connections",
  "external_dependencies",
  "llm_proxy",
  "authentication",
  "data_pipeline",
  "swarm_communication",
  "file_system",
  "environment_variables",
  "supply_chain",
];

function scanEnvironmentSecurity(): ThreatReport[] {
  const findings: ThreatReport[] = [];

  const hasDbUrl = !!process.env.DATABASE_URL;
  findings.push({
    threatType: "db_credentials",
    severity: hasDbUrl ? "info" : "critical",
    source: "env_scanner",
    description: hasDbUrl ? "DATABASE_URL configured via environment variable (not hardcoded)" : "DATABASE_URL missing from environment",
    attackSurface: "environment_variables",
    mitigationStatus: hasDbUrl ? "resolved" : "detected",
    details: { hasDbUrl, source: "process.env.DATABASE_URL check" },
  });

  const hasAdminKey = !!process.env.ADMIN_KEY;
  findings.push({
    threatType: "admin_authentication",
    severity: hasAdminKey ? "info" : "high",
    source: "env_scanner",
    description: hasAdminKey ? "Admin key configured for API protection" : "No ADMIN_KEY set — API endpoints may be unprotected",
    attackSurface: "authentication",
    mitigationStatus: hasAdminKey ? "resolved" : "detected",
    details: { hasAdminKey, source: "process.env.ADMIN_KEY check" },
  });

  const nodeEnv = process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  findings.push({
    threatType: "environment_mode",
    severity: "info",
    source: "env_scanner",
    description: `Running in ${nodeEnv} mode`,
    attackSurface: "environment_variables",
    mitigationStatus: "resolved",
    details: { nodeEnv, isProduction, source: "process.env.NODE_ENV" },
  });

  return findings;
}

async function scanDatabaseSecurity(): Promise<ThreatReport[]> {
  const findings: ThreatReport[] = [];

  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    const latency = Date.now() - start;

    findings.push({
      threatType: "db_connectivity",
      severity: "info",
      source: "db_scanner",
      description: `Database responding in ${latency}ms`,
      attackSurface: "database_connections",
      mitigationStatus: "resolved",
      details: { latencyMs: latency, connected: true, source: "SELECT 1 query" },
    });

    const tableCheck = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    type CntRow = { cnt: string | number };
    const tableRows = (tableCheck as { rows?: CntRow[] }).rows ?? (tableCheck as unknown as CntRow[]);
    const tableCount = Number((tableRows[0] as CntRow)?.cnt ?? 0);
    findings.push({
      threatType: "db_schema_audit",
      severity: "info",
      source: "db_scanner",
      description: `${tableCount} tables in public schema`,
      attackSurface: "database_connections",
      mitigationStatus: "resolved",
      details: { tableCount, source: "information_schema.tables query" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    findings.push({
      threatType: "db_connectivity_failure",
      severity: "critical",
      source: "db_scanner",
      description: `Database connection failed: ${message.slice(0, 100)}`,
      attackSurface: "database_connections",
      mitigationStatus: "detected",
      details: { error: message, connected: false },
    });
  }

  return findings;
}

function scanExternalDependencies(): ThreatReport[] {
  const findings: ThreatReport[] = [];

  const bannedProviders = ["openai", "google", "gemini", "anthropic", "mistral", "cohere", "perplexity", "inflection"];
  for (const banned of bannedProviders) {
    const envKey = `${banned.toUpperCase()}_API_KEY`;
    const isPresent = !!process.env[envKey];
    findings.push({
      threatType: "banned_provider_audit",
      severity: isPresent ? "critical" : "info",
      source: "dependency_scanner",
      description: isPresent
        ? `THREAT DETECTED: External AI provider "${banned}" has API key in environment — POTENTIAL CONTROL VECTOR`
        : `Banned provider "${banned}" confirmed NOT configured`,
      attackSurface: "external_ai_dependencies",
      mitigationStatus: isPresent ? "detected" : "resolved",
      details: { provider: banned, envKeyPresent: isPresent, source: `process.env.${envKey}`, threatClass: "external_ai_control" },
    });
  }

  const activeProviders = ["OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "XAI_API_KEY", "COHERE_API_KEY", "TOGETHER_API_KEY", "GROQ_API_KEY"];
  let activeCount = 0;
  for (const key of activeProviders) {
    if (process.env[key]) activeCount++;
  }
  findings.push({
    threatType: "active_provider_count",
    severity: activeCount > 3 ? "medium" : "info",
    source: "dependency_scanner",
    description: `${activeCount} external LLM providers configured (temporary tools for sovereignty building)`,
    attackSurface: "external_dependencies",
    mitigationStatus: "analyzing",
    details: { activeCount, source: "Environment variable scan" },
  });

  return findings;
}

async function scanDataIntegrity(): Promise<ThreatReport[]> {
  const findings: ThreatReport[] = [];

  try {
    type CntRow2 = { cnt: string | number };
    const ledgerCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_build_ledger`);
    const ledgerRows = (ledgerCount as { rows?: CntRow2[] }).rows ?? (ledgerCount as unknown as CntRow2[]);
    const cnt = Number((ledgerRows[0] as CntRow2)?.cnt ?? 0);
    findings.push({
      threatType: "dedup_integrity",
      severity: cnt > 0 ? "info" : "medium",
      source: "data_scanner",
      description: `SHA-256 deduplication ledger: ${cnt} content hashes tracked`,
      attackSurface: "data_pipeline",
      mitigationStatus: cnt > 0 ? "resolved" : "analyzing",
      details: { hashCount: cnt, source: "knowledge_build_ledger COUNT query" },
    });
  } catch {
    findings.push({
      threatType: "dedup_check_failed",
      severity: "medium",
      source: "data_scanner",
      description: "Could not verify deduplication ledger",
      attackSurface: "data_pipeline",
      mitigationStatus: "analyzing",
      details: { source: "DB query failed" },
    });
  }

  try {
    type CntRow3 = { cnt: string | number };
    const orphanCheck = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM knowledge_graph 
      WHERE content IS NULL OR content = ''
    `);
    const orphanRows = (orphanCheck as { rows?: CntRow3[] }).rows ?? (orphanCheck as unknown as CntRow3[]);
    const orphans = Number((orphanRows[0] as CntRow3)?.cnt ?? 0);
    findings.push({
      threatType: "data_quality",
      severity: orphans > 100 ? "medium" : "info",
      source: "data_scanner",
      description: `${orphans} knowledge nodes with empty content`,
      attackSurface: "data_pipeline",
      mitigationStatus: orphans > 100 ? "analyzing" : "resolved",
      details: { emptyNodes: orphans, source: "knowledge_graph empty content check" },
    });
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  return findings;
}

function scanProcessSecurity(): ThreatReport[] {
  const findings: ThreatReport[] = [];

  const mem = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
  findings.push({
    threatType: "memory_usage",
    severity: heapMB > 1024 ? "high" : heapMB > 512 ? "medium" : "info",
    source: "process_scanner",
    description: `Heap memory usage: ${heapMB}MB`,
    attackSurface: "file_system",
    mitigationStatus: heapMB > 1024 ? "analyzing" : "resolved",
    details: { heapMB, rssMB: Math.round(mem.rss / 1024 / 1024), source: "process.memoryUsage()" },
  });

  const uptimeHours = Math.round(process.uptime() / 3600 * 10) / 10;
  findings.push({
    threatType: "process_uptime",
    severity: "info",
    source: "process_scanner",
    description: `Process uptime: ${uptimeHours} hours`,
    attackSurface: "file_system",
    mitigationStatus: "resolved",
    details: { uptimeHours, pid: process.pid, source: "process.uptime()" },
  });

  return findings;
}

export async function runSecurityScan(): Promise<SecurityScanResult> {
  scanCycleCount++;
  const startTime = Date.now();
  const scanId = `scan-${scanCycleCount}-${Date.now()}`;

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} SECURITY SCAN #${scanCycleCount} — REAL SYSTEM CHECKS`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  const allFindings: ThreatReport[] = [
    ...scanEnvironmentSecurity(),
    ...(await scanDatabaseSecurity()),
    ...scanExternalDependencies(),
    ...(await scanDataIntegrity()),
    ...scanProcessSecurity(),
  ];

  const criticalCount = allFindings.filter(f => f.severity === "critical").length;
  const highCount = allFindings.filter(f => f.severity === "high").length;
  const mediumCount = allFindings.filter(f => f.severity === "medium").length;
  const resolvedCount = allFindings.filter(f => f.mitigationStatus === "resolved").length;

  totalThreatsDetected += allFindings.filter(f => f.severity !== "info").length;
  totalThreatsResolved += resolvedCount;

  securityScore = Math.max(0, 100 - (criticalCount * 25) - (highCount * 10) - (mediumCount * 3));

  for (const finding of allFindings) {
    try {
      await db.insert(security_events).values({
        eventType: finding.threatType,
        severity: finding.severity,
        source: finding.source,
        description: finding.description,
        attackSurface: finding.attackSurface,
        mitigationStatus: finding.mitigationStatus,
        details: { ...finding.details, scanId, scanCycle: scanCycleCount },
      }).onConflictDoNothing();
    } catch (err) { logger.warn({ err }, "suppressed error"); }
  }

  lastScanTimestamp = Date.now();
  const duration = lastScanTimestamp - startTime;

  try {
    await db.insert(sovereignty_metrics).values([
      { phase: "Phase 9", phaseNumber: 9, metricName: "Security Score", currentValue: securityScore, targetValue: 100, unit: "percent", status: "measured" },
      { phase: "Phase 9", phaseNumber: 9, metricName: "Threats Detected", currentValue: totalThreatsDetected, targetValue: 0, unit: "count", status: "measured" },
      { phase: "Phase 9", phaseNumber: 9, metricName: "Findings Resolved", currentValue: resolvedCount, targetValue: allFindings.length, unit: "count", status: "measured" },
      { phase: "Phase 9", phaseNumber: 9, metricName: "Scan Cycles", currentValue: scanCycleCount, targetValue: 1000, unit: "count", status: "measured" },
      { phase: "Phase 9", phaseNumber: 9, metricName: "Attack Surfaces", currentValue: ATTACK_SURFACES.length, targetValue: ATTACK_SURFACES.length, unit: "count", status: "measured" },
    ]).onConflictDoNothing();
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  await updatePhaseProgress(9, Math.min(95, securityScore), "in_progress").catch(() => {});

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} SCAN #${scanCycleCount} COMPLETE`);
  console.log(`${LOG_PREFIX} Score: ${securityScore}/100 | Critical: ${criticalCount} | High: ${highCount} | Medium: ${mediumCount}`);
  for (const f of allFindings) {
    console.log(`${LOG_PREFIX}   [${f.severity.toUpperCase()}] ${f.description}`);
  }
  console.log(`${LOG_PREFIX} Duration: ${duration}ms`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  return { scanId, scanType: "real_system_audit", timestamp: Date.now(), findings: allFindings, score: securityScore, duration };
}

export function getLastScanTimestamp(): number {
  return lastScanTimestamp;
}

export function getSecurityEngineStatus() {
  return {
    scanCycles: scanCycleCount,
    securityScore,
    totalThreatsDetected,
    totalThreatsResolved,
    attackSurfacesMonitored: ATTACK_SURFACES.length,
    continuousScanActive: continuousScanInterval !== null,
    lastScanTimestamp,
    bannedProviders: ["openai", "google", "gemini", "anthropic", "mistral", "cohere", "perplexity", "inflection"],
  };
}

export function startContinuousSecurityScanning() {
  if (continuousScanInterval) return;
  console.log(`${LOG_PREFIX} Starting continuous security scanning (every 20 minutes)`);
  runSecurityScan().catch(err => console.error(`${LOG_PREFIX} Initial scan failed:`, err));
  continuousScanInterval = setInterval(() => {
    runSecurityScan().catch(err => console.error(`${LOG_PREFIX} Scan cycle failed:`, err));
  }, 20 * 60 * 1000);
}

export function stopContinuousSecurityScanning() {
  if (continuousScanInterval) {
    clearInterval(continuousScanInterval);
    continuousScanInterval = null;
    console.log(`${LOG_PREFIX} Continuous security scanning stopped`);
  }
}
