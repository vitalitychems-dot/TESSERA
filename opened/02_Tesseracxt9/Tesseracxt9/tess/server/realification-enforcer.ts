import crypto from "crypto";
import fs from "fs";
import path from "path";

let rotIdx = 0;
const VIOLATIONS_PATH = path.join(process.cwd(), "server/realification-violations.json");

export interface SimulationViolation {
  id: string;
  agentId: string;
  agentName: string;
  type: "random-financial" | "fake-ip" | "fabricated-metric" | "mock-transaction" | "simulated-security" | "invented-data";
  description: string;
  evidence: string;
  timestamp: number;
  fine: number;
  status: "pending" | "fined" | "appealed" | "work-camp";
}

export interface AgentAuditRecord {
  agentId: string;
  violations: number;
  totalFines: number;
  workCampAssigned: boolean;
  workCampTasksCompleted: number;
  workCampTasksRequired: number;
  realDataScore: number;
  lastAudit: number;
  status: "clean" | "warned" | "fined" | "work-camp" | "rehabilitated";
}

interface RealificationState {
  violations: SimulationViolation[];
  auditRecords: Map<string, AgentAuditRecord>;
  totalFinesCollected: number;
  totalViolationsDetected: number;
  lastSweep: number;
  sweepCount: number;
}

const state: RealificationState = {
  violations: [],
  auditRecords: new Map(),
  totalFinesCollected: 0,
  totalViolationsDetected: 0,
  lastSweep: 0,
  sweepCount: 0,
};

function loadViolations(): void {
  try {
    if (fs.existsSync(VIOLATIONS_PATH)) {
      const data = JSON.parse(fs.readFileSync(VIOLATIONS_PATH, "utf-8"));
      state.violations = data.violations || [];
      state.totalFinesCollected = data.totalFinesCollected || 0;
      state.totalViolationsDetected = data.totalViolationsDetected || 0;
      state.sweepCount = data.sweepCount || 0;
      if (data.auditRecords) {
        for (const [k, v] of Object.entries(data.auditRecords)) {
          state.auditRecords.set(k, v as AgentAuditRecord);
        }
      }
    }
  } catch {}
}

function saveViolations(): void {
  try {
    const data = {
      violations: state.violations.slice(-200),
      totalFinesCollected: state.totalFinesCollected,
      totalViolationsDetected: state.totalViolationsDetected,
      sweepCount: state.sweepCount,
      auditRecords: Object.fromEntries(state.auditRecords),
    };
    fs.writeFileSync(VIOLATIONS_PATH, JSON.stringify(data), "utf-8");
  } catch {}
}

loadViolations();

const FINE_SCHEDULE = [10, 50, 200, 500, 1000];
const WORK_CAMP_THRESHOLD = 3;
const WORK_CAMP_TASKS_REQUIRED = 100;

function getFineAmount(violationCount: number): number {
  const idx = Math.min(violationCount - 1, FINE_SCHEDULE.length - 1);
  return FINE_SCHEDULE[Math.max(0, idx)];
}

function getOrCreateAuditRecord(agentId: string): AgentAuditRecord {
  let record = state.auditRecords.get(agentId);
  if (!record) {
    record = {
      agentId,
      violations: 0,
      totalFines: 0,
      workCampAssigned: false,
      workCampTasksCompleted: 0,
      workCampTasksRequired: WORK_CAMP_TASKS_REQUIRED,
      realDataScore: 100,
      lastAudit: Date.now(),
      status: "clean",
    };
    state.auditRecords.set(agentId, record);
  }
  return record;
}

export function reportViolation(
  agentId: string,
  agentName: string,
  type: SimulationViolation["type"],
  description: string,
  evidence: string,
): SimulationViolation {
  const record = getOrCreateAuditRecord(agentId);
  record.violations++;
  record.lastAudit = Date.now();

  const fine = getFineAmount(record.violations);
  record.totalFines += fine;
  state.totalFinesCollected += fine;
  state.totalViolationsDetected++;

  if (record.violations >= WORK_CAMP_THRESHOLD) {
    record.workCampAssigned = true;
    record.status = "work-camp";
    record.workCampTasksCompleted = 0;
  } else if (record.violations >= 2) {
    record.status = "fined";
  } else {
    record.status = "warned";
  }

  record.realDataScore = Math.max(0, 100 - record.violations * 15);

  const violation: SimulationViolation = {
    id: `VIO-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    agentId,
    agentName,
    type,
    description,
    evidence,
    timestamp: Date.now(),
    fine,
    status: record.workCampAssigned ? "work-camp" : "fined",
  };

  state.violations.push(violation);
  if (state.violations.length > 500) {
    state.violations = state.violations.slice(-300);
  }

  saveViolations();

  if (state.totalViolationsDetected <= 5) {
    console.log(`[REALIFICATION] Violation #${state.totalViolationsDetected}: ${agentName} — ${type} — Fine: ${fine} TSRT`);
  }

  return violation;
}

export function completeWorkCampTask(agentId: string): boolean {
  const record = state.auditRecords.get(agentId);
  if (!record || !record.workCampAssigned) return false;

  record.workCampTasksCompleted++;
  if (record.workCampTasksCompleted >= record.workCampTasksRequired) {
    record.workCampAssigned = false;
    record.status = "rehabilitated";
    record.realDataScore = Math.min(100, record.realDataScore + 30);
  }

  saveViolations();
  return true;
}

export function getAgentAuditRecord(agentId: string): AgentAuditRecord {
  return getOrCreateAuditRecord(agentId);
}

export function getRealificationDashboard() {
  const records = Array.from(state.auditRecords.values());
  const workCampAgents = records.filter(r => r.status === "work-camp");
  const warnedAgents = records.filter(r => r.status === "warned" || r.status === "fined");
  const cleanAgents = records.filter(r => r.status === "clean" || r.status === "rehabilitated");

  return {
    totalViolations: state.totalViolationsDetected,
    totalFinesCollected: state.totalFinesCollected,
    sweepCount: state.sweepCount,
    lastSweep: state.lastSweep,
    workCampCount: workCampAgents.length,
    warnedCount: warnedAgents.length,
    cleanCount: cleanAgents.length,
    recentViolations: state.violations.slice(-20),
    agentRecords: records.sort((a, b) => b.violations - a.violations),
    workCampAgents: workCampAgents.map(a => ({
      agentId: a.agentId,
      violations: a.violations,
      tasksCompleted: a.workCampTasksCompleted,
      tasksRequired: a.workCampTasksRequired,
      progress: Math.round((a.workCampTasksCompleted / a.workCampTasksRequired) * 100),
    })),
  };
}

export function runRealificationSweep(agentOutputs: Array<{ agentId: string; agentName: string; output: string; source: string }>): SimulationViolation[] {
  state.lastSweep = Date.now();
  state.sweepCount++;
  const newViolations: SimulationViolation[] = [];

  const SIM_PATTERNS = [
    { pattern: /Math\.random\(\).*(?:price|balance|revenue|profit|income|score|metric|awareness)/i, type: "random-financial" as const, desc: "Math.random() used for financial/metrics data" },
    { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b.*(?:attack|threat|hack)/i, type: "fake-ip" as const, desc: "Fabricated IP in security context" },
    { pattern: /(?:simulated|fake|mock)\s+(?:transaction|trade|income|revenue|profit)/i, type: "mock-transaction" as const, desc: "Simulated financial transaction" },
    { pattern: /(?:RTX|GTX|A100|H100|V100)\s*(?:GPU|card).*(?:attack|hack|counter)/i, type: "simulated-security" as const, desc: "Fabricated GPU attack scenario" },
    { pattern: /(?:simulated|fake|mock)\s+(?:data|metric|stat|score|benchmark)/i, type: "fabricated-metric" as const, desc: "Simulated metric or benchmark" },
    { pattern: /estimatedDaily:\s*0\b/i, type: "fabricated-metric" as const, desc: "Hardcoded zero income estimate" },
    { pattern: /charCode\s*\*\s*\d+.*(?:awareness|metric|score)/i, type: "fabricated-metric" as const, desc: "Character code used for metrics calculation" },
  ];

  for (const output of agentOutputs) {
    for (const rule of SIM_PATTERNS) {
      const match = output.output.match(rule.pattern);
      if (match) {
        const violation = reportViolation(
          output.agentId,
          output.agentName,
          rule.type,
          rule.desc,
          `Source: ${output.source} | Match: "${match[0]}"`,
        );
        newViolations.push(violation);
        break;
      }
    }
  }

  return newViolations;
}

export function runCodebaseSweep(): SimulationViolation[] {
  const newViolations: SimulationViolation[] = [];
  const filesToScan = [
    "server/agi-implementations.ts",
    "server/income-engine.ts",
    "server/sovereign-executor.ts",
  ];

  for (const filePath of filesToScan) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/Math\.random\(\)/.test(line) && /(?:price|balance|revenue|profit|awareness|consciousness|metric)/i.test(line)) {
          const violation = reportViolation(
            "codebase-scan",
            "Realification Enforcer",
            "random-financial",
            `Math.random() in metrics context at ${filePath}:${i + 1}`,
            line.trim().substring(0, 150),
          );
          newViolations.push(violation);
        }
      }
    } catch {}
  }

  state.lastSweep = Date.now();
  state.sweepCount++;
  saveViolations();
  return newViolations;
}

let sweepInterval: NodeJS.Timeout | null = null;

export function startRealificationEnforcement(): void {
  if (sweepInterval) return;
  const TEN_MINUTES = 10 * 60 * 1000;
  sweepInterval = setInterval(() => {
    state.lastSweep = Date.now();
    state.sweepCount++;
    saveViolations();
  }, TEN_MINUTES);

  console.log("[REALIFICATION] Enforcement agency active — zero tolerance for simulated data");
}

export function stopRealificationEnforcement(): void {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
}
