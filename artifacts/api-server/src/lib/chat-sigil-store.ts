import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { getPool } from "@workspace/db";
import { lusEncodeCredential } from "./lingua-universalis";
import type { NextFunction, Request, Response } from "express";
import { lookupSession, SESSION_COOKIE } from "./sovereign-session";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const derive = (value: string, salt: string) => new Promise<Buffer>((resolve, reject) => scrypt(value, salt, 32, (error, key) => error ? reject(error) : resolve(key)));
async function hashSigil(value: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(value, salt)).toString("hex")}`;
}
async function verifySigil(value: string, stored: string) {
  const [salt, expected] = stored.split(":");
  return Boolean(salt && expected && sameHash((await derive(value, salt)).toString("hex"), expected));
}
export class SigilError extends Error {
  constructor(public readonly code: string, public readonly status = 409) { super(code); }
}
type Row = {
  current_hash: string; pending_hash: string | null; pending_token_hash: string | null;
  pending_session_hash: string | null; last_session_hash: string | null; generation: number;
  confirmed_sessions: string[];
};

/** Only hashes are durable. Issuance never changes the workspace admin secret. */
export class ChatSigilStore {
  private ready: Promise<unknown> | undefined;
  constructor(private readonly pool = getPool(), private readonly table = "father_chat_sigils") {
    if (!/^father_chat_sigils(?:_test_[a-z0-9]+)?$/.test(table)) throw new Error("Invalid sigil table");
  }
  private async query(text: string, values: unknown[] = []) {
    return this.pool.query<Record<string, unknown>>(text, values);
  }
  private async ensure() {
    this.ready ??= this.query(`CREATE TABLE IF NOT EXISTS ${this.table} (
      id integer PRIMARY KEY CHECK (id = 1), current_hash text NOT NULL,
      pending_hash text, pending_token_hash text, pending_session_hash text,
      pending_expires_at timestamptz, last_session_hash text, generation integer NOT NULL DEFAULT 0,
      confirmed_sessions text[] NOT NULL DEFAULT '{}'
    )`).catch(error => { this.ready = undefined; throw error; });
    await this.ready;
  }
  async status(session: string) {
    await this.ensure();
    const result = await this.query(`SELECT confirmed_sessions FROM ${this.table} WHERE id = 1`);
    const row = result.rows[0] as unknown as { confirmed_sessions?: string[] } | undefined;
    return { enrolled: Boolean(row), rotatedThisSession: row?.confirmed_sessions?.includes(digest(session)) ?? false };
  }
  async prepare(current: string, session: string, initialize = false) {
    if (current.length < 8 || current.length > 512) throw new SigilError("sigil-length", 400);
    await this.ensure();
    if (initialize) await this.query(`INSERT INTO ${this.table} (id, current_hash) VALUES (1, $1) ON CONFLICT (id) DO NOTHING`, [await hashSigil(current)]);
    const result = await this.query(`SELECT * FROM ${this.table} WHERE id = 1`);
    const row = result.rows[0] as Row | undefined;
    if (!row) throw new SigilError("sigil-enrollment-required", 400);
    if (!await verifySigil(current, row.current_hash)) throw new SigilError("sigil-mismatch", 403);
    const sessionHash = digest(session);
    if (row.confirmed_sessions.includes(sessionHash)) throw new SigilError("already-rotated-this-session");
    const code = lusEncodeCredential(randomBytes(32).toString("base64url"));
    const confirmationToken = randomBytes(32).toString("base64url");
    const updated = await this.query(`UPDATE ${this.table} SET pending_hash = $1, pending_token_hash = $2,
      pending_session_hash = $3, pending_expires_at = NOW() + INTERVAL '15 minutes', generation = generation + 1
      WHERE id = 1 AND current_hash = $4 AND generation = $5 RETURNING id`,
      [await hashSigil(code), digest(confirmationToken), sessionHash, row.current_hash, row.generation]);
    if (!updated.rows.length) throw new SigilError("sigil-changed-retry");
    return { code, confirmationToken };
  }
  async confirm(token: string, session: string) {
    await this.ensure();
    if (!token || token.length > 128) throw new SigilError("confirmation-required", 400);
    const updated = await this.query(`UPDATE ${this.table} SET current_hash = pending_hash,
      last_session_hash = $1, pending_hash = NULL, pending_token_hash = NULL, pending_session_hash = NULL,
      pending_expires_at = NULL, generation = generation + 1,
      confirmed_sessions = (array_prepend($1::text, confirmed_sessions))[1:1024] WHERE id = 1
      AND pending_token_hash = $2 AND pending_session_hash = $1 AND pending_expires_at > NOW()
      AND NOT ($1 = ANY(confirmed_sessions)) RETURNING id`,
      [digest(session), digest(token)]);
    if (!updated.rows.length) throw new SigilError("confirmation-expired-or-replaced");
  }
}

let store: ChatSigilStore | undefined;
export function chatSigilStore() { return store ??= new ChatSigilStore(); }

/** Test-only: point the singleton at an isolated table or clear it between simulated restarts. */
export function setChatSigilStoreForTests(next: ChatSigilStore | undefined) { store = next; }

export async function requireChatSigil(req: Request, res: Response, next: NextFunction) {
  const session = lookupSession(req.cookies?.[SESSION_COOKIE]);
  if (!session.valid || !session.record) return res.status(401).json({ ok: false, error: "unauthenticated" });
  try {
    const status = await chatSigilStore().status(session.record.id);
    if (!status.rotatedThisSession) return res.status(428).json({ ok: false, error: "chat-sigil-required", message: "Verify and save your next private sigil before chatting in this owner session." });
    return next();
  } catch {
    return res.status(503).json({ ok: false, error: "sigil-storage-unavailable" });
  }
}
