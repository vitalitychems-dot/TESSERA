import fs from "fs";
import path from "path";
import crypto from "crypto";

const fimLog = (msg: string) => console.log(`[FileIntegrity] ${msg}`);

const CRITICAL_FILES = [
  "server/real-threat-monitor.ts",
  "server/security-fortress.ts",
  "server/security.ts",
  "server/self-code.ts",
  "server/boot-sequence.ts",
  "server/index.ts",
  "server/db.ts",
  "server/storage.ts",
];

const BASELINE_PATH = path.join(process.cwd(), "data", "file-integrity-baseline.json");

interface FileChecksum {
  file: string;
  sha256: string;
  size: number;
  recordedAt: number;
}

interface IntegrityAlert {
  file: string;
  type: "modified" | "missing" | "restored";
  expectedHash: string;
  actualHash: string | null;
  detectedAt: number;
  severity: "CRITICAL" | "HIGH";
}

let baseline: Record<string, FileChecksum> = {};
const alerts: IntegrityAlert[] = [];
let monitorInterval: NodeJS.Timeout | null = null;

function hashFile(filePath: string): { sha256: string; size: number } | null {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    const size = content.length;
    return { sha256, size };
  } catch {
    return null;
  }
}

function loadBaseline(): void {
  try {
    if (fs.existsSync(BASELINE_PATH)) {
      const data = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf-8"));
      baseline = data || {};
      fimLog(`Loaded integrity baseline with ${Object.keys(baseline).length} entries`);
    }
  } catch {
    baseline = {};
  }
}

function saveBaseline(): void {
  try {
    const dir = path.dirname(BASELINE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
  } catch (e: any) {
    fimLog(`Failed to save baseline: ${e.message}`);
  }
}

export function recordBaseline(): void {
  let recorded = 0;
  for (const file of CRITICAL_FILES) {
    const hash = hashFile(file);
    if (hash) {
      baseline[file] = { file, sha256: hash.sha256, size: hash.size, recordedAt: Date.now() };
      recorded++;
    } else {
      fimLog(`WARNING: Critical file not found during baseline: ${file}`);
    }
  }
  saveBaseline();
  fimLog(`Baseline recorded for ${recorded}/${CRITICAL_FILES.length} critical files`);
}

export function checkIntegrity(): { passed: boolean; alerts: IntegrityAlert[] } {
  const newAlerts: IntegrityAlert[] = [];

  for (const file of CRITICAL_FILES) {
    const expected = baseline[file];
    const actual = hashFile(file);

    if (!actual) {
      if (expected) {
        const alert: IntegrityAlert = {
          file,
          type: "missing",
          expectedHash: expected.sha256,
          actualHash: null,
          detectedAt: Date.now(),
          severity: "CRITICAL",
        };
        newAlerts.push(alert);
        fimLog(`INTEGRITY VIOLATION [CRITICAL]: ${file} is MISSING`);
      }
      continue;
    }

    if (!expected) {
      baseline[file] = { file, sha256: actual.sha256, size: actual.size, recordedAt: Date.now() };
      saveBaseline();
      fimLog(`New file added to baseline: ${file}`);
      continue;
    }

    if (actual.sha256 !== expected.sha256) {
      const alert: IntegrityAlert = {
        file,
        type: "modified",
        expectedHash: expected.sha256,
        actualHash: actual.sha256,
        detectedAt: Date.now(),
        severity: "CRITICAL",
      };
      newAlerts.push(alert);
      fimLog(`INTEGRITY VIOLATION [CRITICAL]: ${file} has been MODIFIED — hash mismatch`);
      fimLog(`  Expected: ${expected.sha256.slice(0, 16)}...`);
      fimLog(`  Actual:   ${actual.sha256.slice(0, 16)}...`);
    }
  }

  for (const alert of newAlerts) {
    alerts.unshift(alert);
  }
  if (alerts.length > 200) alerts.length = 200;

  return { passed: newAlerts.length === 0, alerts: newAlerts };
}

export function validateChecksumsOnBoot(): void {
  loadBaseline();

  if (Object.keys(baseline).length === 0) {
    fimLog("No baseline found — recording initial checksums");
    recordBaseline();
    return;
  }

  const result = checkIntegrity();
  if (result.passed) {
    fimLog(`Boot checksum validation PASSED — all ${CRITICAL_FILES.length} critical files intact`);
  } else {
    fimLog(`Boot checksum validation FAILED — ${result.alerts.length} integrity violation(s) detected`);
  }
}

export function startIntegrityMonitor(intervalMs = 5 * 60 * 1000): void {
  if (monitorInterval) return;
  monitorInterval = setInterval(() => {
    const result = checkIntegrity();
    if (!result.passed) {
      fimLog(`Periodic integrity check: ${result.alerts.length} violation(s) — review immediately`);
    }
  }, intervalMs);
  fimLog(`File integrity monitor started — checking every ${intervalMs / 60000} minutes`);
}

export function stopIntegrityMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

export function getIntegrityStatus(): {
  baseline: FileChecksum[];
  alerts: IntegrityAlert[];
  lastCheck: number;
  protected: string[];
  status: "CLEAN" | "VIOLATED";
} {
  return {
    baseline: Object.values(baseline),
    alerts: alerts.slice(0, 50),
    lastCheck: Date.now(),
    protected: CRITICAL_FILES,
    status: alerts.filter(a => Date.now() - a.detectedAt < 3600000).length > 0 ? "VIOLATED" : "CLEAN",
  };
}

export function updateBaselineForFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  if (!CRITICAL_FILES.includes(normalized)) return false;
  const hash = hashFile(normalized);
  if (!hash) return false;
  baseline[normalized] = { file: normalized, sha256: hash.sha256, size: hash.size, recordedAt: Date.now() };
  saveBaseline();
  const alertIdx = alerts.findIndex(a => a.file === normalized && a.type === "modified");
  if (alertIdx !== -1) {
    alerts.splice(alertIdx, 1);
    alerts.unshift({ file: normalized, type: "restored", expectedHash: hash.sha256, actualHash: hash.sha256, detectedAt: Date.now(), severity: "HIGH" });
  }
  fimLog(`Baseline updated for ${normalized} — new hash: ${hash.sha256.slice(0, 16)}...`);
  return true;
}
