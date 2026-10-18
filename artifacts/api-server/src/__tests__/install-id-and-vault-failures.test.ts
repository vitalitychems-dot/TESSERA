import { createCipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import apiApp, { setServerReady, terminalErrorHandler } from "../app";
import { getFatherSeal } from "../lib/father-identity";
import { logger } from "../lib/logger";

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const ADMIN_KEY = "synthetic-admin-key-for-tests-only";
const VAULT_ENV = "SOVEREIGN_VAULT_PATH";

describe("install id and vault failures stay generic", () => {
  const previousAdmin = process.env[ADMIN_ENV];
  const previousVault = process.env[VAULT_ENV];
  const dirs: string[] = [];

  afterEach(() => {
    vi.resetModules();
    if (previousAdmin === undefined) delete process.env[ADMIN_ENV];
    else process.env[ADMIN_ENV] = previousAdmin;
    if (previousVault === undefined) delete process.env[VAULT_ENV];
    else process.env[VAULT_ENV] = previousVault;
    for (const dir of dirs.splice(0)) {
      try {
        chmodSync(dir, 0o700);
      } catch {
        // The directory is already removable.
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws a fixed install-id error and anonymous status returns 503", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tessera-install-"));
    dirs.push(dir);
    chmodSync(dir, 0o555);
    vi.resetModules();
    process.env[ADMIN_ENV] = ADMIN_KEY;
    const logs = captureLogs();
    const identity = await import("../lib/father-identity");
    identity.setInstallIdDirectoryForTests(dir);
    let message = "";
    let configured = false;
    try {
      identity.getInstallId();
    } catch (err: unknown) {
      configured = isInstallUnavailable(err);
      message = err instanceof Error && err.message === "install-id-unavailable" ? err.message : "";
    }
    const doctrine = await import("../routes/sovereign-doctrine");
    const app = express();
    app.use(express.json());
    app.use(doctrine.default);
    const server = await listen(app);
    try {
      const response = await fetch(`${server.url}/sigil/status`);
      const text = await response.text();
      const leaked = !configured
        || message !== "install-id-unavailable"
        || text !== JSON.stringify({ ok: false, error: "not-configured" })
        || response.status !== 503
        || mentionsFailureDetail(message, dir)
        || mentionsFailureDetail(text, dir)
        || mentionsFailureDetail(logs(), dir);
      expect(leaked).toBe(false);
    } finally {
      logs.restore();
      await server.close();
    }
  });

  it("leaves session-key history unchanged when install id storage fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tessera-rotate-"));
    dirs.push(dir);
    chmodSync(dir, 0o700);
    vi.resetModules();
    process.env[ADMIN_ENV] = ADMIN_KEY;
    const identity = await import("../lib/father-identity");
    const cipher = await import("../lib/sigil-cipher");
    identity.setInstallIdDirectoryForTests(dir);
    cipher.rotateSessionKey("first");
    cipher.rotateSessionKey("second");
    const before = cipher.getKeyHistory().map((key) => key.id);
    const activeId = cipher.getActiveKey().id;
    unlinkSync(join(dir, "install-id"));
    chmodSync(dir, 0o555);
    identity.setInstallIdDirectoryForTests(dir);
    let failed = false;
    try {
      cipher.rotateSessionKey("fail");
    } catch (err: unknown) {
      failed = isInstallUnavailable(err);
    }
    const during = cipher.getKeyHistory().map((key) => key.id);
    const stillActive = cipher.getActiveKey().id === activeId && cipher.getActiveKey().sealed === false;
    chmodSync(dir, 0o700);
    identity.setInstallIdDirectoryForTests(dir);
    cipher.rotateSessionKey("retry");
    const after = cipher.getKeyHistory().length;
    expect(failed).toBe(true);
    expect(during.join("|") === before.join("|")).toBe(true);
    expect(stillActive).toBe(true);
    expect(after).toBe(before.length + 1);
  });

  it("round-trips the vault key and fails closed on a read-only directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tessera-vault-"));
    dirs.push(dir);
    const vaultPath = join(dir, "vault.json");
    vi.resetModules();
    process.env[ADMIN_ENV] = ADMIN_KEY;
    process.env[VAULT_ENV] = vaultPath;
    const vault = await import("../lib/sovereign-vault");
    const plain = "vault-plain";
    vault.vaultPut("behavior", plain);
    const opened = vault.vaultGet("behavior");
    const mode = statSync(vaultPath).mode & 0o777;
    const stored = readFileSync(vaultPath, "utf8");
    expect(opened?.plaintext === plain).toBe(true);
    expect(mode).toBe(0o600);
    expect(stored.includes(plain)).toBe(false);

    vi.resetModules();
    process.env[ADMIN_ENV] = `${ADMIN_KEY}-other`;
    process.env[VAULT_ENV] = vaultPath;
    const other = await import("../lib/sovereign-vault");
    let otherMessage = "";
    try {
      other.vaultGet("behavior");
    } catch (err: unknown) {
      otherMessage = err instanceof Error ? err.message : "";
    }
    expect(otherMessage).toBe("astro-decrypt-failed");

    const locked = mkdtempSync(join(tmpdir(), "tessera-vault-ro-"));
    dirs.push(locked);
    chmodSync(locked, 0o555);
    vi.resetModules();
    process.env[ADMIN_ENV] = ADMIN_KEY;
    process.env[VAULT_ENV] = join(locked, "vault.json");
    const logs = captureLogs();
    const blocked = await import("../lib/sovereign-vault");
    let blockedMessage = "";
    try {
      blocked.vaultPut("blocked", plain);
    } catch (err: unknown) {
      blockedMessage = err instanceof Error ? err.message : "";
    } finally {
      logs.restore();
    }
    const leaked = blockedMessage !== "vault-unavailable"
      || mentionsFailureDetail(blockedMessage, locked)
      || mentionsFailureDetail(logs(), locked);
    expect(leaked).toBe(false);
  });

  it("returns a fixed 500 from the terminal error handler", async () => {
    const logs = captureLogs();
    const app = express();
    app.get("/boom", (_req, _res, next) => {
      next(new Error("EACCES: permission denied, open '/tmp/install-id'"));
    });
    app.use(terminalErrorHandler);
    const server = await listen(app);
    try {
      const response = await fetch(`${server.url}/boom`);
      const text = await response.text();
      const log = logs();
      const leaked = response.status !== 500
        || text !== JSON.stringify({ ok: false, error: "request-failed" })
        || mentionsFailureDetail(text, "/tmp/install-id")
        || mentionsFailureDetail(log, "/tmp/install-id")
        || !log.includes("\"errorName\":\"Error\"")
        || !log.includes("\"status\":500");
      expect(leaked).toBe(false);
    } finally {
      logs.restore();
      await server.close();
    }
  });

  it("keeps a numeric 4xx and a fixed body", async () => {
    const logs = captureLogs();
    const app = express();
    app.get("/bad", (_req, _res, next) => {
      const error = new SyntaxError("Unexpected token in JSON at position 1");
      next(Object.assign(error, { status: 400, statusCode: 400 }));
    });
    app.use(terminalErrorHandler);
    const server = await listen(app);
    try {
      const response = await fetch(`${server.url}/bad`);
      const text = await response.text();
      const log = logs();
      const leaked = response.status !== 400
        || text !== JSON.stringify({ ok: false, error: "bad-request" })
        || log.includes("Unexpected token")
        || log.includes("position")
        || !log.includes("\"errorName\":\"SyntaxError\"")
        || !log.includes("\"status\":400");
      expect(leaked).toBe(false);
    } finally {
      logs.restore();
      await server.close();
    }
  });

  it("calls next when headers are already sent", async () => {
    let forwarded = false;
    const app = express();
    app.get("/partial", (_req, res, next) => {
      res.write("ok");
      const error = new Error("EACCES: permission denied, open '/tmp/install-id'");
      next(Object.assign(error, { status: 400 }));
    });
    app.use(terminalErrorHandler);
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      forwarded = err instanceof Error && (err as { status?: number }).status === 400;
      if (!res.writableEnded) res.end();
    });
    const server = await listen(app);
    try {
      const response = await fetch(`${server.url}/partial`);
      const text = await response.text();
      const leaked = !forwarded
        || text.includes("/tmp/install-id")
        || text.includes("EACCES");
      expect(leaked).toBe(false);
    } finally {
      await server.close();
    }
  });

  it("returns 400 for malformed JSON and 413 for an oversized body on the real app", async () => {
    setServerReady();
    const logs = captureLogs();
    const server = await listen(apiApp);
    try {
      const malformed = await fetch(`${server.url}/api/admin/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      });
      const malformedText = await malformed.text();
      const oversized = await fetch(`${server.url}/api/admin/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: `{"pad":"${"x".repeat(120_000)}"}`,
      });
      const oversizedText = await oversized.text();
      const log = logs();
      const leaked = malformed.status !== 400
        || malformedText !== JSON.stringify({ ok: false, error: "bad-request" })
        || oversized.status !== 413
        || oversizedText !== JSON.stringify({ ok: false, error: "payload-too-large" })
        || log.includes("Unexpected")
        || log.includes("entity")
        || log.includes("too large")
        || log.includes("position");
      expect(leaked).toBe(false);
    } finally {
      logs.restore();
      await server.close();
    }
  });

  it("returns vault plaintext when rewrap persist fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tessera-vault-rewrap-"));
    dirs.push(dir);
    const vaultPath = join(dir, "vault.json");
    vi.resetModules();
    process.env[ADMIN_ENV] = ADMIN_KEY;
    process.env[VAULT_ENV] = vaultPath;
    const astro = await import("../lib/sovereign-astro-cipher");
    const plain = "rewrap-plain";
    const key = "row";
    writeFileSync(vaultPath, retiredVaultDocument(astro.getCurrentEpoch(), astro.activeEpochSignature(), key, plain), { mode: 0o600 });
    chmodSync(dir, 0o555);
    const logs = captureLogs();
    const vault = await import("../lib/sovereign-vault");
    let threw = false;
    let opened = "";
    try {
      opened = vault.vaultGet(key)?.plaintext ?? "";
    } catch {
      threw = true;
    } finally {
      logs.restore();
    }
    const leaked = threw || opened !== plain || mentionsFailureDetail(logs(), dir);
    expect(leaked).toBe(false);
  });

  it("maps vault put and delete failures to 503", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tessera-vault-route-"));
    dirs.push(dir);
    const vaultPath = join(dir, "vault.json");
    vi.resetModules();
    process.env[ADMIN_ENV] = ADMIN_KEY;
    process.env[VAULT_ENV] = vaultPath;
    const writer = await import("../lib/sovereign-vault");
    writer.vaultPut("kept", "vault-plain");
    chmodSync(dir, 0o555);
    vi.resetModules();
    process.env[ADMIN_ENV] = ADMIN_KEY;
    process.env[VAULT_ENV] = vaultPath;
    const [{ default: router }, sessions] = await Promise.all([
      import("../routes/grand-conference-cipher"),
      import("../lib/father-session-store"),
    ]);
    const token = sessions.issueFatherToken("raw-key");
    const app = express();
    app.use(express.json());
    app.use(router);
    const server = await listen(app);
    try {
      const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
      const removed = await fetch(`${server.url}/grand-conference/vault/delete/kept`, { method: "DELETE", headers });
      const removedText = await removed.text();
      const stored = await fetch(`${server.url}/grand-conference/vault/put`, {
        method: "POST",
        headers,
        body: JSON.stringify({ key: "fresh", plaintext: "vault-plain" }),
      });
      const storedText = await stored.text();
      const leaked = removed.status !== 503
        || removedText !== JSON.stringify({ ok: false, error: "vault-unavailable" })
        || stored.status !== 503
        || storedText !== JSON.stringify({ ok: false, error: "vault-unavailable" })
        || removedText.includes(dir)
        || storedText.includes(dir);
      expect(leaked).toBe(false);
    } finally {
      await server.close();
    }
  });
});

function retiredVaultDocument(
  epoch: { epochId: string; epochHash: string },
  sig: string,
  key: string,
  plain: string,
): string {
  const raw = process.env[ADMIN_ENV] ?? "";
  const retired = createHash("sha256").update(`tesseract:father:v1|${raw}`).digest("hex").slice(0, 16);
  const ikm = Buffer.from(`${getFatherSeal()}|${retired}`, "utf8");
  const aesKey = Buffer.from(hkdfSync("sha256", ikm, Buffer.from(sig, "utf8"), Buffer.from("tesseract:astro-cipher:v1", "utf8"), 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
  cipher.setAAD(Buffer.from(`vault:${key}`, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    version: 1,
    entries: {
      [key]: {
        key,
        updatedAt: "2026-01-01T00:00:00.000Z",
        envelope: {
          v: 1,
          alg: "aes-256-gcm",
          epochId: epoch.epochId,
          epochHash: epoch.epochHash,
          iv: iv.toString("base64"),
          tag: tag.toString("base64"),
          ct: ct.toString("base64"),
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      },
    },
  });
}

function isInstallUnavailable(err: unknown): boolean {
  return err instanceof Error && err.name === "NotConfiguredError" && err.message === "install-id-unavailable";
}

function mentionsFailureDetail(text: string, path: string): boolean {
  return text.includes(path) || /EACCES|ENOENT|EPERM|EEXIST|ENOTDIR|ELOOP/.test(text);
}

function captureLogs(): { restore: () => void; (): string } {
  const lines: string[] = [];
  const levels = ["fatal", "error", "warn", "info", "debug", "trace"] as const;
  const restoreFns: Array<() => void> = [];
  for (const level of levels) {
    const current = logger[level];
    if (typeof current !== "function") continue;
    (logger as unknown as Record<string, unknown>)[level] = (...args: unknown[]) => {
      lines.push(JSON.stringify(args));
    };
    restoreFns.push(() => {
      (logger as unknown as Record<string, unknown>)[level] = current;
    });
  }
  const originalStderr = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array) => {
    lines.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }) as typeof process.stderr.write;
  const read = () => lines.join("\n");
  read.restore = () => {
    process.stderr.write = originalStderr;
    for (const restoreFn of restoreFns) restoreFn();
  };
  return read;
}

async function listen(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test server address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}
