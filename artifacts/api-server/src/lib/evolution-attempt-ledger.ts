import { mkdirSync, appendFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "./logger";

const LEDGER_DIR = join(process.cwd(), "_evolutions");
const LEDGER_PATH = join(LEDGER_DIR, "attempt-ledger.jsonl");

export type AttemptEvent =
  | "PROPOSED"
  | "SANDBOXED_PASS"
  | "SANDBOXED_FAIL"
  | "APPLIED"
  | "REVERTED";

export interface AttemptEntry {
  id: string;
  proposalId: string;
  event: AttemptEvent;
  targetModule: string;
  reason?: string;
  verifyOutput?: string;
  durationMs?: number;
  timestamp: number;
}

const memoryLedger: AttemptEntry[] = [];
const MAX_MEMORY = 500;

function ensureDir(): void {
  if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });
}

let loaded = false;
function loadFromDisk(): void {
  if (loaded) return;
  loaded = true;
  try {
    if (!existsSync(LEDGER_PATH)) return;
    const lines = readFileSync(LEDGER_PATH, "utf8").split("\n").filter(l => l.trim().length > 0);
    const recent = lines.slice(-MAX_MEMORY);
    for (const line of recent) {
      try {
        const parsed = JSON.parse(line) as AttemptEntry;
        if (parsed && typeof parsed === "object" && parsed.event) memoryLedger.push(parsed);
      } catch { /* skip malformed line */ }
    }
  } catch (err) {
    logger.warn({ err }, "AttemptLedger: failed to load existing ledger");
  }
}

export function recordAttempt(
  entry: Omit<AttemptEntry, "id" | "timestamp"> & { timestamp?: number },
): AttemptEntry {
  loadFromDisk();
  ensureDir();
  const full: AttemptEntry = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: entry.timestamp ?? Date.now(),
    proposalId: entry.proposalId,
    event: entry.event,
    targetModule: entry.targetModule,
    reason: entry.reason,
    verifyOutput: entry.verifyOutput,
    durationMs: entry.durationMs,
  };
  try {
    appendFileSync(LEDGER_PATH, JSON.stringify(full) + "\n", "utf8");
  } catch (err) {
    logger.warn({ err, proposalId: full.proposalId }, "AttemptLedger: append failed");
  }
  memoryLedger.push(full);
  if (memoryLedger.length > MAX_MEMORY) memoryLedger.splice(0, memoryLedger.length - MAX_MEMORY);
  return full;
}

export function getRecentAttempts(limit = 50): AttemptEntry[] {
  loadFromDisk();
  const n = Math.max(1, Math.min(limit, MAX_MEMORY));
  return memoryLedger.slice(-n).reverse();
}

export function getAttemptsByProposal(proposalId: string): AttemptEntry[] {
  loadFromDisk();
  return memoryLedger.filter(e => e.proposalId === proposalId);
}

export function _clearLedgerForTests(): void {
  memoryLedger.length = 0;
  loaded = false;
}
