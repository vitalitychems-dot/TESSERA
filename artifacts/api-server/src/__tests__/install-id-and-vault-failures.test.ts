import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { terminalErrorHandler } from "../app";
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
      const leaked = response.status !== 500
        || text !== JSON.stringify({ ok: false, error: "request-failed" })
        || mentionsFailureDetail(text, "/tmp/install-id")
        || mentionsFailureDetail(logs(), "/tmp/install-id");
      expect(leaked).toBe(false);
    } finally {
      logs.restore();
      await server.close();
    }
  });
});

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
