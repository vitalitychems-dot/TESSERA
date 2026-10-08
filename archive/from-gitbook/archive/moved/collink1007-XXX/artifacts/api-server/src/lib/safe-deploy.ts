import fs from "fs";
import path from "path";
import http from "http";
import { execSync } from "child_process";
import { logger } from "./logger";
import type { SandboxProposal } from "./code-sandbox";

const dlog = (msg: string) => logger.info("[SafeDeploy] " + msg);

const BACKUP_DIR = path.join(process.cwd(), ".deploy-backups");
const DEPLOY_LOG_PATH = path.join(process.cwd(), "deploy-log.json");
const BUILD_VERIFY_TIMEOUT_MS = 30_000;
const HEALTH_CHECK_TIMEOUT_MS = 15_000;
const HEALTH_CHECK_URL = `http://localhost:${process.env.PORT || 8080}/api/health`;

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

export interface DeploymentRecord {
  id: string;
  proposalId: string;
  targetPath: string;
  fileName: string;
  description: string;
  deployedAt: string;
  status: "success" | "failed" | "rolled-back";
  backupPath?: string;
  rollbackReason?: string;
  buildVerified?: boolean;
}

const deploymentLog: DeploymentRecord[] = [];

function loadDeployLog(): void {
  try {
    if (fs.existsSync(DEPLOY_LOG_PATH)) {
      const data = JSON.parse(fs.readFileSync(DEPLOY_LOG_PATH, "utf-8"));
      if (Array.isArray(data)) deploymentLog.push(...data.slice(-200));
    }
  } catch {
    dlog("Could not load deploy log, starting fresh");
  }
}

function saveDeployLog(): void {
  try {
    fs.writeFileSync(DEPLOY_LOG_PATH, JSON.stringify(deploymentLog.slice(-200), null, 2), "utf-8");
  } catch (e: any) {
    dlog(`Failed to save deploy log: ${e.message}`);
  }
}

loadDeployLog();

const NEW_FILE_SENTINEL = "__NEW_FILE__";

function backupFile(targetPath: string): string {
  const fullPath = path.join(process.cwd(), targetPath);
  const ts = Date.now();
  const backupName = `${path.basename(targetPath)}.backup.${ts}`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  if (fs.existsSync(fullPath)) {
    fs.copyFileSync(fullPath, backupPath);
    dlog(`Backed up ${targetPath} → ${backupName}`);
  } else {
    fs.writeFileSync(backupPath, NEW_FILE_SENTINEL, "utf-8");
    dlog(`Sentinel backup created for new file ${targetPath} → ${backupName}`);
  }
  return backupPath;
}

function rollbackFile(targetPath: string, backupPath: string): boolean {
  try {
    const fullPath = path.join(process.cwd(), targetPath);
    const backupContent = fs.readFileSync(backupPath, "utf-8");
    if (backupContent === NEW_FILE_SENTINEL) {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      dlog(`Rolled back ${targetPath} — new file removed`);
    } else {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(backupPath, fullPath);
      dlog(`Rolled back ${targetPath} from backup`);
    }
    return true;
  } catch (err: any) {
    dlog(`Rollback failed: ${err.message}`);
    return false;
  }
}

function writeFileAtomic(targetPath: string, content: string): void {
  const fullPath = path.join(process.cwd(), targetPath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${fullPath}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpPath, content, "utf-8");
  fs.renameSync(tmpPath, fullPath);
}

function verifyBuildCompiles(onProgress?: (msg: string) => void): { ok: boolean; error?: string } {
  onProgress?.("Verifying TypeScript build compiles...");
  try {
    execSync("npx tsc --noEmit 2>&1", {
      timeout: BUILD_VERIFY_TIMEOUT_MS,
      encoding: "utf8",
      cwd: process.cwd(),
    });
    onProgress?.("Build compile check: PASSED");
    return { ok: true };
  } catch (err: any) {
    const output: string = err.stdout || err.stderr || err.message || "";
    const errors = output
      .split("\n")
      .filter((l: string) => l.includes("error TS"))
      .slice(0, 5)
      .join("; ");
    onProgress?.(`Build compile check: FAILED — ${errors}`);
    return { ok: false, error: errors || output.slice(0, 300) };
  }
}

async function verifyServerHealth(
  onProgress?: (msg: string) => void
): Promise<{ ok: boolean; error?: string }> {
  onProgress?.("Running server health check...");
  const deadline = Date.now() + HEALTH_CHECK_TIMEOUT_MS;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(HEALTH_CHECK_URL, { timeout: 3000 }, (res) => {
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
          res.resume();
        });
        req.on("error", reject);
        req.on("timeout", () => reject(new Error("timeout")));
      });
      onProgress?.("Health check: PASSED");
      return { ok: true };
    } catch (e: any) {
      lastError = e.message;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  onProgress?.(`Health check: TIMED OUT (${lastError})`);
  return { ok: false, error: `Health check failed after ${HEALTH_CHECK_TIMEOUT_MS}ms: ${lastError}` };
}

export interface DeployResult {
  success: boolean;
  deploymentId: string;
  targetPath: string;
  backupPath?: string;
  rolledBack: boolean;
  error?: string;
  buildVerified: boolean;
  record: DeploymentRecord;
}

const reloadListeners: Array<() => void> = [];
const sseReloadClients: Array<(event: string) => void> = [];

export function onReloadRequired(listener: () => void): void {
  reloadListeners.push(listener);
}

export function registerReloadClient(send: (event: string) => void): () => void {
  sseReloadClients.push(send);
  return () => {
    const idx = sseReloadClients.indexOf(send);
    if (idx !== -1) sseReloadClients.splice(idx, 1);
  };
}

export function broadcastReloadEvent(event: Record<string, unknown>): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const fn of sseReloadClients) {
    try { fn(payload); } catch {}
  }
}

function notifyReload(): void {
  for (const fn of reloadListeners) {
    try { fn(); } catch {}
  }
  broadcastReloadEvent({ type: "server_reload", message: "File deployed — server is applying changes" });
}

export async function deployProposal(
  proposal: SandboxProposal,
  onProgress?: (msg: string) => void
): Promise<DeployResult> {
  if (proposal.status !== "passed") {
    return {
      success: false,
      deploymentId: "",
      targetPath: proposal.targetPath,
      rolledBack: false,
      buildVerified: false,
      error: `Cannot deploy proposal with status "${proposal.status}" — must be "passed"`,
      record: {
        id: "",
        proposalId: proposal.id,
        targetPath: proposal.targetPath,
        fileName: proposal.fileName,
        description: proposal.description,
        deployedAt: new Date().toISOString(),
        status: "failed",
        rollbackReason: "Proposal not in passed state",
      },
    };
  }

  const deploymentId = `dep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  dlog(`Deploying proposal ${proposal.id} to ${proposal.targetPath}`);
  onProgress?.(`Deploying ${proposal.fileName} to ${proposal.targetPath}...`);

  const backupPath = backupFile(proposal.targetPath);
  if (backupPath) {
    onProgress?.(`Backup created: ${path.basename(backupPath)}`);
  }

  const record: DeploymentRecord = {
    id: deploymentId,
    proposalId: proposal.id,
    targetPath: proposal.targetPath,
    fileName: proposal.fileName,
    description: proposal.description,
    deployedAt: new Date().toISOString(),
    status: "failed",
    backupPath,
    buildVerified: false,
  };

  let buildVerified = false;

  try {
    writeFileAtomic(proposal.targetPath, proposal.code);
    dlog(`Wrote ${proposal.targetPath} atomically (${proposal.code.length} bytes)`);
    onProgress?.(`File written successfully`);

    const buildCheck = verifyBuildCompiles(onProgress);
    buildVerified = buildCheck.ok;

    if (!buildCheck.ok) {
      dlog(`Build verification FAILED after write — rolling back`);
      onProgress?.(`Build failed post-write — rolling back automatically`);

      if (backupPath) {
        const rolled = rollbackFile(proposal.targetPath, backupPath);
        record.status = "rolled-back";
        record.rollbackReason = `Build failed: ${buildCheck.error}`;
        record.buildVerified = false;
        onProgress?.(`Rollback ${rolled ? "succeeded" : "FAILED"}`);
      }

      deploymentLog.push(record);
      saveDeployLog();

      return {
        success: false,
        deploymentId,
        targetPath: proposal.targetPath,
        backupPath,
        rolledBack: !!backupPath,
        buildVerified: false,
        error: `Build verification failed: ${buildCheck.error}`,
        record,
      };
    }

    record.status = "success";
    record.buildVerified = true;
    deploymentLog.push(record);
    saveDeployLog();

    proposal.status = "deployed";
    proposal.deployedAt = new Date().toISOString();

    onProgress?.(`Deployment complete — notifying for reload`);
    notifyReload();

    const healthResult = await verifyServerHealth(onProgress);
    if (!healthResult.ok) {
      dlog(`Health check failed post-deploy — auto-rolling back`);
      onProgress?.(`Health check failed — rolling back automatically`);

      if (backupPath) {
        rollbackFile(proposal.targetPath, backupPath);
        record.status = "rolled-back";
        record.rollbackReason = `Health check failed: ${healthResult.error}`;
        saveDeployLog();
        proposal.status = "passed";
        proposal.deployedAt = undefined;

        return {
          success: false,
          deploymentId,
          targetPath: proposal.targetPath,
          backupPath,
          rolledBack: true,
          buildVerified,
          error: `Auto-rolled back: ${healthResult.error}`,
          record,
        };
      }
    }

    dlog(`Deployed ${proposal.fileName} successfully (id: ${deploymentId}, build: verified, health: ${healthResult.ok ? "ok" : "degraded"})`);

    return {
      success: true,
      deploymentId,
      targetPath: proposal.targetPath,
      backupPath,
      rolledBack: false,
      buildVerified,
      record,
    };
  } catch (err: any) {
    dlog(`Deployment write failed: ${err.message}`);
    onProgress?.(`Deployment failed: ${err.message}`);

    if (backupPath) {
      const rolled = rollbackFile(proposal.targetPath, backupPath);
      record.status = "rolled-back";
      record.rollbackReason = err.message;
      onProgress?.(`Rollback ${rolled ? "succeeded" : "FAILED"}`);
    }

    deploymentLog.push(record);
    saveDeployLog();

    return {
      success: false,
      deploymentId,
      targetPath: proposal.targetPath,
      backupPath,
      rolledBack: !!backupPath,
      buildVerified,
      error: err.message,
      record,
    };
  }
}

export async function rollbackDeployment(deploymentId: string): Promise<{ success: boolean; error?: string }> {
  const record = deploymentLog.find(d => d.id === deploymentId);
  if (!record) return { success: false, error: `Deployment ${deploymentId} not found` };
  if (!record.backupPath || !fs.existsSync(record.backupPath)) {
    return { success: false, error: "No backup available for rollback" };
  }

  const rolled = rollbackFile(record.targetPath, record.backupPath);
  if (rolled) {
    record.status = "rolled-back";
    record.rollbackReason = "Manual rollback";
    saveDeployLog();
    notifyReload();
    dlog(`Manual rollback successful for deployment ${deploymentId}`);
    return { success: true };
  }

  return { success: false, error: "Rollback operation failed" };
}

export function getDeploymentLog(limit = 50): DeploymentRecord[] {
  return deploymentLog.slice(-limit).reverse();
}

export function getDeploymentStatus() {
  const recent = deploymentLog.slice(-20);
  return {
    totalDeployments: deploymentLog.length,
    successful: deploymentLog.filter(d => d.status === "success").length,
    failed: deploymentLog.filter(d => d.status === "failed").length,
    rolledBack: deploymentLog.filter(d => d.status === "rolled-back").length,
    recentDeployments: recent.reverse(),
    backupDir: BACKUP_DIR,
  };
}

export function listBackups(): Array<{ file: string; size: number; createdAt: string }> {
  try {
    const entries = fs.readdirSync(BACKUP_DIR);
    return entries.map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return {
        file: f,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
  } catch {
    return [];
  }
}

const MAX_BACKUPS = 50;

function cleanupOldBackups(): void {
  try {
    const entries = fs.readdirSync(BACKUP_DIR)
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (entries.length > MAX_BACKUPS) {
      for (const entry of entries.slice(MAX_BACKUPS)) {
        try { fs.unlinkSync(path.join(BACKUP_DIR, entry.name)); } catch {}
      }
      dlog(`Cleaned up ${entries.length - MAX_BACKUPS} old backups`);
    }
  } catch {}
}

setInterval(cleanupOldBackups, 60 * 60_000);

dlog("Safe deployment system initialized");
