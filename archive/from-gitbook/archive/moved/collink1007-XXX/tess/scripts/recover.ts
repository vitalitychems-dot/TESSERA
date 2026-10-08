#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";

const rlog = (msg: string) => console.log(`[Recover] ${msg}`);
const rerr = (msg: string) => console.error(`[Recover] ERROR: ${msg}`);

const CWD = process.cwd();

const CRITICAL_FILE_TEMPLATES: Record<string, string> = {
  "data/.gitkeep": "",
};

const REQUIRED_DIRECTORIES = [
  "data",
  "logs",
];

interface RecoveryReport {
  timestamp: number;
  directoriesChecked: number;
  directoriesCreated: number;
  filesChecked: number;
  filesRestored: number;
  errors: string[];
  warnings: string[];
  actions: string[];
}

function ensureDirectory(dir: string, report: RecoveryReport): void {
  const fullPath = path.join(CWD, dir);
  try {
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      report.directoriesCreated++;
      report.actions.push(`Created missing directory: ${dir}`);
      rlog(`Created missing directory: ${dir}`);
    }
    report.directoriesChecked++;
  } catch (e: any) {
    report.errors.push(`Failed to create directory ${dir}: ${e.message}`);
    rerr(`Failed to create directory ${dir}: ${e.message}`);
  }
}

function checkCriticalFile(filePath: string, expectedContent: string, report: RecoveryReport): void {
  const fullPath = path.join(CWD, filePath);
  report.filesChecked++;

  try {
    if (!fs.existsSync(fullPath)) {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, expectedContent, "utf-8");
      report.filesRestored++;
      report.actions.push(`Restored missing file: ${filePath}`);
      rlog(`Restored missing file: ${filePath}`);
    }
  } catch (e: any) {
    report.errors.push(`Failed to restore ${filePath}: ${e.message}`);
    rerr(`Failed to restore ${filePath}: ${e.message}`);
  }
}

function checkCorruptedJson(filePath: string, report: RecoveryReport): void {
  const fullPath = path.join(CWD, filePath);
  if (!fs.existsSync(fullPath)) return;

  report.filesChecked++;
  try {
    const content = fs.readFileSync(fullPath, "utf-8");
    JSON.parse(content);
  } catch (e: any) {
    report.warnings.push(`Corrupted JSON file detected: ${filePath}`);
    rlog(`WARNING: Corrupted JSON at ${filePath} — creating backup and resetting`);
    try {
      const backupPath = fullPath + `.corrupt.${Date.now()}.bak`;
      fs.copyFileSync(fullPath, backupPath);
      fs.writeFileSync(fullPath, "[]", "utf-8");
      report.filesRestored++;
      report.actions.push(`Reset corrupted JSON: ${filePath} (backup at ${path.basename(backupPath)})`);
    } catch (backupErr: any) {
      report.errors.push(`Failed to recover ${filePath}: ${backupErr.message}`);
    }
  }
}

function checkNodeProcess(report: RecoveryReport): void {
  try {
    const uptime = process.uptime();
    rlog(`Node process healthy — PID ${process.pid}, uptime ${Math.floor(uptime)}s`);
    report.actions.push(`Process check: PID ${process.pid} running for ${Math.floor(uptime)}s`);
  } catch (e: any) {
    report.errors.push(`Process check failed: ${e.message}`);
  }
}

function checkDiskSpace(report: RecoveryReport): void {
  try {
    const result = execSync("df -BM / 2>/dev/null | tail -1", { encoding: "utf-8", timeout: 5000 });
    const parts = result.trim().split(/\s+/);
    if (parts.length >= 5) {
      const used = parseInt(parts[2], 10);
      const available = parseInt(parts[3], 10);
      const usedPercent = parseInt(parts[4], 10);
      rlog(`Disk space: ${used}MB used, ${available}MB available (${usedPercent}% full)`);
      if (usedPercent > 90) {
        report.warnings.push(`Disk usage critical: ${usedPercent}% used, only ${available}MB remaining`);
      }
      report.actions.push(`Disk check: ${usedPercent}% used`);
    }
  } catch {
    report.warnings.push("Could not check disk space");
  }
}

function checkIntegrityBaseline(report: RecoveryReport): void {
  const baselinePath = path.join(CWD, "data", "file-integrity-baseline.json");
  if (!fs.existsSync(baselinePath)) {
    report.warnings.push("File integrity baseline not found — will be created on next server start");
    report.actions.push("File integrity baseline: absent (will be created on next start)");
    return;
  }

  try {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
    const fileCount = Object.keys(baseline).length;
    rlog(`File integrity baseline present: ${fileCount} files tracked`);
    report.actions.push(`File integrity baseline: ${fileCount} files tracked`);

    for (const [file, entry] of Object.entries(baseline) as [string, any][]) {
      const fullPath = path.join(CWD, file);
      report.filesChecked++;
      if (!fs.existsSync(fullPath)) {
        report.warnings.push(`Baseline references missing file: ${file}`);
        report.actions.push(`WARNING: Critical file missing: ${file}`);
        rlog(`WARNING: Critical file missing: ${file}`);
        continue;
      }

      const content = fs.readFileSync(fullPath);
      const actualHash = crypto.createHash("sha256").update(content).digest("hex");
      if (actualHash !== entry.sha256) {
        report.warnings.push(`Integrity mismatch for ${file} — file may have been modified`);
        report.actions.push(`Hash mismatch: ${file} expected=${entry.sha256?.slice(0, 12)}... actual=${actualHash.slice(0, 12)}...`);
        rlog(`INTEGRITY ALERT: ${file} hash does not match baseline`);
      }
    }
  } catch (e: any) {
    report.errors.push(`Integrity baseline check failed: ${e.message}`);
  }
}

async function runRecovery(): Promise<RecoveryReport> {
  rlog("Starting system recovery check...");

  const report: RecoveryReport = {
    timestamp: Date.now(),
    directoriesChecked: 0,
    directoriesCreated: 0,
    filesChecked: 0,
    filesRestored: 0,
    errors: [],
    warnings: [],
    actions: [],
  };

  rlog("Phase 1: Ensuring required directories...");
  for (const dir of REQUIRED_DIRECTORIES) {
    ensureDirectory(dir, report);
  }

  rlog("Phase 2: Checking critical files...");
  for (const [file, content] of Object.entries(CRITICAL_FILE_TEMPLATES)) {
    checkCriticalFile(file, content, report);
  }

  rlog("Phase 3: Checking JSON data files for corruption...");
  const dataDir = path.join(CWD, "data");
  if (fs.existsSync(dataDir)) {
    try {
      const jsonFiles = fs.readdirSync(dataDir).filter(f => f.endsWith(".json") && !f.includes(".corrupt."));
      for (const file of jsonFiles) {
        checkCorruptedJson(path.join("data", file), report);
      }
    } catch (e: any) {
      report.warnings.push(`Could not scan data directory: ${e.message}`);
    }
  }

  rlog("Phase 4: Process and system checks...");
  checkNodeProcess(report);
  checkDiskSpace(report);

  rlog("Phase 5: File integrity check...");
  checkIntegrityBaseline(report);

  const status = report.errors.length === 0 ? "HEALTHY" : report.errors.length <= 2 ? "DEGRADED" : "CRITICAL";

  rlog(`Recovery check complete — Status: ${status}`);
  rlog(`  Directories: ${report.directoriesChecked} checked, ${report.directoriesCreated} created`);
  rlog(`  Files: ${report.filesChecked} checked, ${report.filesRestored} restored`);
  rlog(`  Errors: ${report.errors.length}, Warnings: ${report.warnings.length}`);

  if (report.errors.length > 0) {
    rerr(`Errors encountered:`);
    for (const err of report.errors) rerr(`  - ${err}`);
  }

  if (report.warnings.length > 0) {
    rlog(`Warnings:`);
    for (const warn of report.warnings) rlog(`  - ${warn}`);
  }

  const reportPath = path.join(CWD, "data", "recovery-report.json");
  try {
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ ...report, status }, null, 2));
    rlog(`Recovery report saved to ${reportPath}`);
  } catch (e: any) {
    rerr(`Failed to save report: ${e.message}`);
  }

  return report;
}

runRecovery().then((report) => {
  const hasErrors = report.errors.length > 0;
  process.exit(hasErrors ? 1 : 0);
}).catch((err) => {
  rerr(`Fatal recovery error: ${err.message}`);
  process.exit(1);
});
