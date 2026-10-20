/**
 * Bus-history logger (#11a).
 *
 * Append-only JSONL log, one record per bus message:
 *   { ts, from, topic, hmac_sha256, goal_id }
 * Hashes only: the payload itself is never written, only HMAC-SHA256(key, JSON(payload)) with a
 * server secret from BUS_HISTORY_HMAC_KEY (>= 32 chars), so short or guessable payloads can't be
 * confirmed by hashing guesses. Unset or too-short key => fail closed: nothing is written.
 * goal_id is kept only when it is id-like; emails and name-like values are dropped (null).
 * Off by default: enabled only when BUS_HISTORY_LOG=1 (or "true").
 * Size cap + rotation: when the file would exceed BUS_HISTORY_MAX_BYTES
 * (default 5 MB) it is renamed to <file>.1 (older files shift up to
 * BUS_HISTORY_MAX_FILES, default 3) and a fresh file is started.
 */
import { createHmac } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface BusHistoryRecord {
  ts: string;
  from: string;
  topic: string;
  hmac_sha256: string;
  goal_id: string | null;
}

export interface BusHistoryConfig {
  enabled: boolean;
  /** HMAC key (server secret). null => logging is off even when enabled (fail closed). */
  hmacKey: string | null;
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
    hmacKey: typeof env.BUS_HISTORY_HMAC_KEY === "string" && env.BUS_HISTORY_HMAC_KEY.length >= MIN_HMAC_KEY_CHARS ? env.BUS_HISTORY_HMAC_KEY : null,
    path: resolve(env.BUS_HISTORY_PATH || "data/bus-history.jsonl"),
    maxBytes: posInt(env.BUS_HISTORY_MAX_BYTES, DEFAULT_MAX_BYTES),
    maxFiles: posInt(env.BUS_HISTORY_MAX_FILES, DEFAULT_MAX_FILES),
  };
}

export const MIN_HMAC_KEY_CHARS = 32;

export function hashPayload(payload: unknown, key: string): string {
  if (typeof key !== "string" || key.length < MIN_HMAC_KEY_CHARS) throw new Error("BUS_HISTORY_HMAC_KEY missing or too short");
  let s: string;
  try { s = JSON.stringify(payload) ?? "undefined"; } catch { s = "[unserializable]"; }
  return createHmac("sha256", key).update(s).digest("hex");
}

const EMAIL = /[^\s@]+@[^\s@]+/;
/** id-like: ASCII, starts alphanumeric, at most 64 chars, and contains a digit or a separator (so a bare word like a first name is not kept). */
const GOAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
/** Returns the goal_id when it is safe to log, else null: no emails, no whitespace/name-like values. */
export function safeGoalId(v: unknown): string | null {
  if (typeof v === "number") return Number.isSafeInteger(v) && v >= 0 ? String(v) : null;
  if (typeof v !== "string") return null;
  if (EMAIL.test(v) || !GOAL_ID.test(v)) return null;
  if (!/[0-9._:-]/.test(v)) return null;
  return v;
}

export function goalIdOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  return safeGoalId(p.goal_id ?? p.goalId);
}

export function toRecord(from: string, topic: string, payload: unknown, key: string, at: number = Date.now()): BusHistoryRecord {
  return { ts: new Date(at).toISOString(), from, topic, hmac_sha256: hashPayload(payload, key), goal_id: goalIdOf(payload) };
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
  if (!cfg.enabled || typeof cfg.hmacKey !== "string" || cfg.hmacKey.length < MIN_HMAC_KEY_CHARS) return null;
  const rec = toRecord(from, topic, payload, cfg.hmacKey, at);
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
