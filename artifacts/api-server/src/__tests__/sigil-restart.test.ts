import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer, type Server } from "node:http";
import { getPool, isDbConfigured } from "@workspace/db";

/**
 * Integration proof that the durable private chat sigil survives an API restart.
 *
 * Each "process" below is a fresh module graph (vi.resetModules + dynamic import),
 * a fresh in-memory session store, a fresh rate-limit state, and a fresh HTTP
 * server — everything a real restart wipes. Only the isolated database table
 * persists, exactly like production. Synthetic owner credentials only.
 */

const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const OWNER_ENV = "SOVEREIGN_ADMIN_TOKEN";
const LEGACY_ENV = "TESSERACT_ADMIN_KEY";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";
const SYNTHETIC_OWNER_TOKEN = "synthetic-owner-token";
const PRIOR_SIGIL = "test-only-prior-sigil-not-a-user-credential";

type SigilStoreModule = typeof import("../lib/chat-sigil-store");
type SessionModule = typeof import("../lib/sovereign-session");
type RouterModule = typeof import("../routes/language-security");

interface TestProcess {
  baseUrl: string;
  server: Server;
  storeMod: SigilStoreModule;
  sessionMod: SessionModule;
}

describe.skipIf(!isDbConfigured())("private chat sigil across API restarts", () => {
  function restoreEnv(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  const table = `father_chat_sigils_test_${randomBytes(6).toString("hex")}`;
  const pool = getPool();
  const previousSessionSecret = process.env[SESSION_ENV];
  const previousOwnerToken = process.env[OWNER_ENV];
  const previousLegacyKey = process.env[LEGACY_ENV];
  const running: Server[] = [];

  beforeAll(() => {
    process.env[SESSION_ENV] = SYNTHETIC_SESSION_SECRET;
    process.env[OWNER_ENV] = SYNTHETIC_OWNER_TOKEN;
    process.env[LEGACY_ENV] = SYNTHETIC_OWNER_TOKEN;
  });

  afterAll(async () => {
    for (const server of running.splice(0)) {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
    restoreEnv(SESSION_ENV, previousSessionSecret);
    restoreEnv(OWNER_ENV, previousOwnerToken);
    restoreEnv(LEGACY_ENV, previousLegacyKey);
    await pool.query(`DROP TABLE IF EXISTS ${table}`);
  });

  async function startProcess(): Promise<TestProcess> {
    // Simulate a full API restart: every module-level singleton is rebuilt.
    vi.resetModules();
    const storeMod: SigilStoreModule = await import("../lib/chat-sigil-store");
    const sessionMod: SessionModule = await import("../lib/sovereign-session");
    const routerMod: RouterModule = await import("../routes/language-security");
    storeMod.setChatSigilStoreForTests(new storeMod.ChatSigilStore(pool, table));

    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api", routerMod.default);
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    running.push(server);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    return { baseUrl: `http://127.0.0.1:${address.port}`, server, storeMod, sessionMod };
  }

  async function stopProcess(proc: TestProcess): Promise<void> {
    const index = running.indexOf(proc.server);
    if (index >= 0) running.splice(index, 1);
    await new Promise<void>((resolve, reject) => proc.server.close((error) => (error ? reject(error) : resolve())));
  }

  function ownerCookie(proc: TestProcess): string {
    const issued = proc.sessionMod.issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    return `${proc.sessionMod.SESSION_COOKIE}=${issued.signedId}`;
  }

  async function getStatus(proc: TestProcess, cookie: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await fetch(`${proc.baseUrl}/api/sigil/father/status`, { headers: { cookie } });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  async function post(proc: TestProcess, path: string, body: unknown, cookie: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await fetch(`${proc.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        origin: proc.baseUrl,
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  const issueCode = (proc: TestProcess, currentSigil: string, cookie: string, initialize = false) =>
    post(proc, "/api/sigil/father/issue-code", { currentSigil, initialize }, cookie);
  const confirmCode = (proc: TestProcess, confirmationToken: string, cookie: string) =>
    post(proc, "/api/sigil/father/confirm-code", { confirmationToken }, cookie);

  it("keeps a confirmed sigil as the verifier after the API restarts", async () => {
    // Process 1: enroll, confirm a replacement sigil, then die.
    const proc1 = await startProcess();
    const cookie1 = ownerCookie(proc1);
    expect((await getStatus(proc1, cookie1)).body).toMatchObject({ enrolled: false });
    const first = await issueCode(proc1, PRIOR_SIGIL, cookie1, true);
    expect(first.status).toBe(201);
    const confirmedSigil = String(first.body.code);
    expect((await confirmCode(proc1, String(first.body.confirmationToken), cookie1)).body).toMatchObject({ ok: true });
    expect((await getStatus(proc1, cookie1)).body).toMatchObject({ enrolled: true, rotatedThisSession: true });
    await stopProcess(proc1);

    // Process 2: fresh memory, same database. A brand-new owner session must find
    // the confirmed sigil enrolled and still able to authorize the next rotation.
    const proc2 = await startProcess();
    const cookie2 = ownerCookie(proc2);
    expect((await getStatus(proc2, cookie2)).body).toMatchObject({ enrolled: true, rotatedThisSession: false });
    const next = await issueCode(proc2, confirmedSigil, cookie2);
    expect(next.status).toBe(201);
    expect((await confirmCode(proc2, String(next.body.confirmationToken), cookie2)).body).toMatchObject({ ok: true, adminKeyChanged: false });
    await stopProcess(proc2);
    lastConfirmed = String(next.body.code);

    // The stable admin key never changed: every issuance reported adminKeyChanged false.
    expect(first.body).toMatchObject({ adminKeyChanged: false });

    await assertRowsContainOnlyHashes([PRIOR_SIGIL, confirmedSigil, String(first.body.confirmationToken), String(next.body.code), String(next.body.confirmationToken)]);
  });

  it("never lets a pending, unconfirmed replacement replace the active sigil across a restart", async () => {
    // Process 3: issue a replacement but die before it is confirmed.
    const proc3 = await startProcess();
    const cookie3 = ownerCookie(proc3);
    const status3 = await getStatus(proc3, cookie3);
    expect(status3.body).toMatchObject({ enrolled: true, rotatedThisSession: false });
    // Recover the still-active sigil by proving we know it: issue a probe rotation
    // with a wrong sigil to show the active one is still enforced, then issue a real one.
    const wrong = await issueCode(proc3, "test-only-wrong-sigil-value", cookie3);
    expect(wrong.status).toBe(403);
    const pending = await issueCode(proc3, await activeSigilFromPreviousTest(), cookie3);
    expect(pending.status).toBe(201);
    await stopProcess(proc3); // restart with a pending, unconfirmed replacement

    // Process 4: the stale confirmation token is dead with its session, and the
    // prior active sigil is still the only verifier.
    const proc4 = await startProcess();
    const cookie4 = ownerCookie(proc4);
    expect((await getStatus(proc4, cookie4)).body).toMatchObject({ enrolled: true, rotatedThisSession: false });
    const stale = await confirmCode(proc4, String(pending.body.confirmationToken), cookie4);
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ ok: false, error: "confirmation-expired-or-replaced" });
    const reissued = await issueCode(proc4, await activeSigilFromPreviousTest(), cookie4);
    expect(reissued.status).toBe(201);
    expect((await confirmCode(proc4, String(reissued.body.confirmationToken), cookie4)).body).toMatchObject({ ok: true });
    await stopProcess(proc4);

    await assertRowsContainOnlyHashes([String(pending.body.code), String(pending.body.confirmationToken)]);
  });

  // Tracks the last confirmed sigil between the two tests above.
  let lastConfirmed = "";
  async function activeSigilFromPreviousTest(): Promise<string> {
    if (!lastConfirmed) throw new Error("no confirmed sigil carried over");
    return lastConfirmed;
  }

  async function assertRowsContainOnlyHashes(plaintexts: string[]): Promise<void> {
    const raw = JSON.stringify((await pool.query(`SELECT * FROM ${table}`)).rows);
    expect(raw).not.toContain("sovereign");
    for (const value of plaintexts) {
      if (value) expect(raw).not.toContain(value);
    }
  }
});
