/**
 * Bus-history logger (#11a).
 *
 * Append-only JSONL log, one record per bus message:
 *   { ts, from, topic, sha256, goal_id }
 * Hashes only: the payload itself is never written, only sha256 of its JSON.
 * Off by default: enabled only when BUS_HISTORY_LOG=1 (or "true").
 * Size cap + rotation: when the file would exceed BUS_HISTORY_MAX_BYTES
 * (default 5 MB) it is renamed to <file>.1 (older files shift up to
 * BUS_HISTORY_MAX_FILES, default 3) and a fresh file is started.
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface BusHistoryRecord {
  ts: string;
  from: string;
  topic: string;
  sha256: string;
  goal_id: string | null;
}

export interface BusHistoryConfig {
  enabled: boolean;
  path: string;
  maxBytes: number;
  maxFiles: number;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_FILES = 3;

function posInt(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : d;
}

export function busHistoryConfig(env: NodeJS.ProcessEnv = process.env): BusHistoryConfig {
  const flag = String(env.BUS_HISTORY_LOG ?? "").trim().toLowerCase();
  return {
    enabled: flag === "1" || flag === "true",
    path: resolve(env.BUS_HISTORY_PATH || "data/bus-history.jsonl"),
    maxBytes: posInt(env.BUS_HISTORY_MAX_BYTES, DEFAULT_MAX_BYTES),
    maxFiles: posInt(env.BUS_HISTORY_MAX_FILES, DEFAULT_MAX_FILES),
  };
}

export function hashPayload(payload: unknown): string {
  let s: string;
  try { s = JSON.stringify(payload) ?? "undefined"; } catch { s = "[unserializable]"; }
  return createHash("sha256").update(s).digest("hex");
}

export function goalIdOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const g = p.goal_id ?? p.goalId;
  return typeof g === "string" || typeof g === "number" ? String(g) : null;
}

export function toRecord(from: string, topic: string, payload: unknown, at: number = Date.now()): BusHistoryRecord {
  return { ts: new Date(at).toISOString(), from, topic, sha256: hashPayload(payload), goal_id: goalIdOf(payload) };
}

function rotate(cfg: BusHistoryConfig): void {
  const last = `${cfg.path}.${cfg.maxFiles}`;
  if (existsSync(last)) rmSync(last);
  for (let i = cfg.maxFiles - 1; i >= 1; i--) {
    const src = `${cfg.path}.${i}`;
    if (existsSync(src)) renameSync(src, `${cfg.path}.${i + 1}`);
  }
  if (existsSync(cfg.path)) renameSync(cfg.path, `${cfg.path}.1`);
}

/** Append one record. Returns the record written, or null when disabled or on I/O error. */
export function logBusMessage(
  from: string,
  topic: string,
  payload: unknown,
  at: number = Date.now(),
  cfg: BusHistoryConfig = busHistoryConfig(),
): BusHistoryRecord | null {
  if (!cfg.enabled) return null;
  const rec = toRecord(from, topic, payload, at);
  const line = `${JSON.stringify(rec)}\n`;
  try {
    mkdirSync(dirname(cfg.path), { recursive: true });
    const size = existsSync(cfg.path) ? statSync(cfg.path).size : 0;
    if (size > 0 && size + Buffer.byteLength(line) > cfg.maxBytes) rotate(cfg);
    appendFileSync(cfg.path, line, { flag: "a" });
    return rec;
  } catch {
    return null; // logging must never break the bus
  }
}
