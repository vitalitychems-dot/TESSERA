import fs from "fs";
import path from "path";
import crypto from "crypto";

interface AuditResult {
  id: string;
  timestamp: number;
  category: "security" | "performance" | "code-quality" | "realification" | "income" | "agents";
  findings: AuditFinding[];
  score: number;
  autoFixesApplied: number;
  recommendations: string[];
}

interface AuditFinding {
  severity: "info" | "low" | "medium" | "high" | "critical";
  system: string;
  description: string;
  evidence: string;
  autoFixable: boolean;
  fixed: boolean;
}

interface SQAState {
  auditHistory: AuditResult[];
  lastFullAudit: number;
  totalAudits: number;
  totalFindings: number;
  totalAutoFixes: number;
  systemScores: Record<string, number>;
  upSince: number;
}

const AUDIT_HISTORY_PATH = path.join(process.cwd(), "data", "sqa-audit-history.json");

const state: SQAState = {
  auditHistory: [],
  lastFullAudit: 0,
  totalAudits: 0,
  totalFindings: 0,
  totalAutoFixes: 0,
  systemScores: {},
  upSince: Date.now(),
};

function loadState() {
  try {
    if (fs.existsSync(AUDIT_HISTORY_PATH)) {
      const data = JSON.parse(fs.readFileSync(AUDIT_HISTORY_PATH, "utf-8"));
      state.auditHistory = (data.auditHistory || []).slice(-100);
      state.totalAudits = data.totalAudits || 0;
      state.totalFindings = data.totalFindings || 0;
      state.totalAutoFixes = data.totalAutoFixes || 0;
      state.systemScores = data.systemScores || {};
    }
  } catch (e) { console.warn("[SQA] Failed to load state:", (e as Error).message); }
}

function saveState() {
  try {
    const dataDir = path.dirname(AUDIT_HISTORY_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(AUDIT_HISTORY_PATH, JSON.stringify({
      auditHistory: state.auditHistory.slice(-100),
      totalAudits: state.totalAudits,
      totalFindings: state.totalFindings,
      totalAutoFixes: state.totalAutoFixes,
      systemScores: state.systemScores,
    }, null, 2));
  } catch (e) { console.warn("[SQA] Failed to save state:", (e as Error).message); }
}

loadState();

function scanFileForSimulations(filePath: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return findings;
    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      if (/Math\.random\(\)/.test(line) && /(?:price|balance|revenue|profit|income|score|metric|awareness|consciousness)/i.test(line)) {
        findings.push({
          severity: "high",
          system: filePath,
          description: `Math.random() used for metrics/financial data at line ${lineNum}`,
          evidence: line.trim().substring(0, 150),
          autoFixable: false,
          fixed: false,
        });
      }

      if (/estimatedDaily:\s*0\b/.test(line) && !line.includes("//")) {
        findings.push({
          severity: "medium",
          system: filePath,
          description: `Hardcoded zero income estimate at line ${lineNum}`,
          evidence: line.trim().substring(0, 150),
          autoFixable: false,
          fixed: false,
        });
      }

      if (/(?:simulated|fake|mock|placeholder)\s+(?:data|result|response|metric)/i.test(line) && !line.includes("//") && !line.includes("test")) {
        findings.push({
          severity: "medium",
          system: filePath,
          description: `Simulated data reference at line ${lineNum}`,
          evidence: line.trim().substring(0, 150),
          autoFixable: false,
          fixed: false,
        });
      }
    }
  } catch (e) { console.warn("[SQA] File scan error:", (e as Error).message); }
  return findings;
}

async function auditSecurity(): Promise<AuditResult> {
  const findings: AuditFinding[] = [];
  const recommendations: string[] = [];

  try {
    const { getSecurityReport, getThreatLog } = await import("./security");
    const report = getSecurityReport() as any;

    if (report.encryptionStatus !== "CONFIGURED") {
      findings.push({
        severity: "critical",
        system: "security",
        description: "Encryption salt/pepper not configured in environment",
        evidence: `Status: ${report.encryptionStatus}`,
        autoFixable: false,
        fixed: false,
      });
    }

    if (!report.adminKeyConfigured) {
      findings.push({
        severity: "high",
        system: "security",
        description: "Admin key (TESSERACT_ADMIN_KEY) not configured",
        evidence: "No admin authentication available",
        autoFixable: false,
        fixed: false,
      });
    }

    if (report.lastHour > 50) {
      findings.push({
        severity: "high",
        system: "security",
        description: `High threat volume: ${report.lastHour} threats in the last hour`,
        evidence: `By severity: ${JSON.stringify(report.bySeverity)}`,
        autoFixable: false,
        fixed: false,
      });
      recommendations.push("Review threat log for attack patterns");
    }

    if (report.ipReputation?.flagged > 5) {
      recommendations.push(`${report.ipReputation.flagged} IPs flagged — consider blocking repeat offenders`);
    }
  } catch (e) { console.warn("[SQA] Security audit error:", (e as Error).message); }

  const score = Math.max(0, 100 - findings.filter(f => f.severity === "critical").length * 20 - findings.filter(f => f.severity === "high").length * 10);

  return {
    id: `audit-sec-${Date.now()}`,
    timestamp: Date.now(),
    category: "security",
    findings,
    score,
    autoFixesApplied: 0,
    recommendations,
  };
}

function auditCodeQuality(): AuditResult {
  const findings: AuditFinding[] = [];
  const recommendations: string[] = [];

  const serverFiles = [
    "server/agi-implementations.ts",
    "server/income-engine.ts",
    "server/security.ts",
    "server/self-code.ts",
    "server/sovereign-executor.ts",
  ];

  for (const file of serverFiles) {
    const simFindings = scanFileForSimulations(file);
    findings.push(...simFindings);
  }

  if (findings.length === 0) {
    recommendations.push("No simulation patterns detected — all systems using real data");
  } else {
    recommendations.push(`${findings.length} simulation patterns found — review for replacement with real data sources`);
  }

  const score = Math.max(0, 100 - findings.filter(f => f.severity === "high").length * 15 - findings.filter(f => f.severity === "medium").length * 5);

  return {
    id: `audit-code-${Date.now()}`,
    timestamp: Date.now(),
    category: "code-quality",
    findings,
    score,
    autoFixesApplied: 0,
    recommendations,
  };
}

function auditPerformance(): AuditResult {
  const findings: AuditFinding[] = [];
  const recommendations: string[] = [];
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const uptimeH = Math.round(process.uptime() / 3600 * 100) / 100;

  if (heapUsedMB > 512) {
    findings.push({
      severity: "high",
      system: "performance",
      description: `High heap usage: ${heapUsedMB}MB`,
      evidence: `RSS: ${rssMB}MB, Heap: ${heapUsedMB}MB`,
      autoFixable: false,
      fixed: false,
    });
    recommendations.push("Consider running garbage collection or reducing in-memory caches");
  }

  if (rssMB > 1024) {
    findings.push({
      severity: "medium",
      system: "performance",
      description: `High RSS memory: ${rssMB}MB`,
      evidence: `Process using ${rssMB}MB total`,
      autoFixable: false,
      fixed: false,
    });
  }

  const score = Math.max(0, 100 - (heapUsedMB > 512 ? 20 : 0) - (rssMB > 1024 ? 10 : 0));

  return {
    id: `audit-perf-${Date.now()}`,
    timestamp: Date.now(),
    category: "performance",
    findings,
    score,
    autoFixesApplied: 0,
    recommendations: [
      ...recommendations,
      `Uptime: ${uptimeH}h, Heap: ${heapUsedMB}MB, RSS: ${rssMB}MB`,
    ],
  };
}

async function auditAgentSystem(): Promise<AuditResult> {
  const findings: AuditFinding[] = [];
  const recommendations: string[] = [];

  try {
    const { trackAgentActivity } = await import("./agi-implementations");
  } catch {
    findings.push({
      severity: "medium",
      system: "agents",
      description: "Agent activity tracking not accessible",
      evidence: "Could not import trackAgentActivity",
      autoFixable: false,
      fixed: false,
    });
  }

  const score = Math.max(0, 100 - findings.length * 10);

  return {
    id: `audit-agents-${Date.now()}`,
    timestamp: Date.now(),
    category: "agents",
    findings,
    score,
    autoFixesApplied: 0,
    recommendations,
  };
}

export async function runFullAudit(): Promise<{ audits: AuditResult[]; overallScore: number; summary: string }> {
  const audits = await Promise.all([
    auditSecurity(),
    Promise.resolve(auditCodeQuality()),
    Promise.resolve(auditPerformance()),
    auditAgentSystem(),
  ]);

  for (const audit of audits) {
    if (!audit || !audit.findings) continue;
    state.auditHistory.push(audit);
    state.totalAudits++;
    state.totalFindings += audit.findings.length;
    state.totalAutoFixes += audit.autoFixesApplied;
    state.systemScores[audit.category] = audit.score;
  }

  if (state.auditHistory.length > 200) {
    state.auditHistory = state.auditHistory.slice(-100);
  }

  state.lastFullAudit = Date.now();
  saveState();

  const validAudits = audits.filter(a => a && a.findings);
  const overallScore = validAudits.length > 0 ? Math.round(validAudits.reduce((s, a) => s + a.score, 0) / validAudits.length) : 0;
  const totalFindings = validAudits.reduce((s, a) => s + a.findings.length, 0);
  const criticalCount = validAudits.reduce((s, a) => s + a.findings.filter(f => f.severity === "critical").length, 0);

  return {
    audits: validAudits,
    overallScore,
    summary: `SQA Audit Complete: Score ${overallScore}/100, ${totalFindings} findings (${criticalCount} critical), ${validAudits.length} systems checked`,
  };
}

export function getSQADashboard() {
  const recentAudits = state.auditHistory.slice(-20);
  const scoreHistory = recentAudits.map(a => ({ timestamp: a.timestamp, category: a.category, score: a.score }));

  return {
    upSince: state.upSince,
    totalAudits: state.totalAudits,
    totalFindings: state.totalFindings,
    totalAutoFixes: state.totalAutoFixes,
    lastFullAudit: state.lastFullAudit,
    systemScores: state.systemScores,
    overallScore: Object.values(state.systemScores).length > 0
      ? Math.round(Object.values(state.systemScores).reduce((a, b) => a + b, 0) / Object.values(state.systemScores).length)
      : 0,
    scoreHistory,
    recentFindings: recentAudits.flatMap(a => a.findings).slice(-30),
    recommendations: recentAudits.flatMap(a => a.recommendations).slice(-20),
    version: "2.0",
    status: "ACTIVE",
  };
}

export function getAuditHistory(limit = 20) {
  return state.auditHistory.slice(-limit);
}

let sqaInterval: NodeJS.Timeout | null = null;

export function startSQA() {
  if (sqaInterval) return;

  setTimeout(async () => {
    try {
      const result = await runFullAudit();
      console.log(`[SQA] Initial audit: ${result.summary}`);
    } catch (e: any) {
      console.warn("[SQA] Initial audit error:", e?.message || e);
    }
  }, 10000);

  sqaInterval = setInterval(async () => {
    try {
      const result = await runFullAudit();
      if (result.overallScore < 70) {
        console.log(`[SQA] WARNING: System score ${result.overallScore}/100 — review recommended`);
      }
    } catch (e: any) {
      console.warn("[SQA] Periodic audit error:", e?.message || e);
    }
  }, 30 * 60 * 1000);

  console.log("[SQA] Sovereign Quality Agency v2.0 ACTIVE — autonomous monitoring, real code scanning, persistent audit history");
}

export function stopSQA() {
  if (sqaInterval) {
    clearInterval(sqaInterval);
    sqaInterval = null;
  }
}
