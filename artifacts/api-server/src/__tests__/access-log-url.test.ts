import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app, { setServerReady } from "../app";
import { redactAccessLogUrl } from "../lib/access-log-url";
import { logger } from "../lib/logger";

const ADMIN_KEY = "synthetic-access-log-admin-key";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const adminHash = sha256Hex(ADMIN_KEY);

type WritableStream = { write: (chunk: unknown, ...rest: unknown[]) => unknown };

function loggerDestination(target: object): WritableStream | undefined {
  let current: object | null = target;
  while (current) {
    for (const symbol of Object.getOwnPropertySymbols(current)) {
      const value = (current as Record<symbol, unknown>)[symbol];
      if (
        value
        && typeof value === "object"
        && "write" in value
        && typeof (value as { write?: unknown }).write === "function"
      ) {
        return value as WritableStream;
      }
    }
    current = Object.getPrototypeOf(current) as object | null;
  }
  return undefined;
}

const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

describe("redactAccessLogUrl", () => {
  it("redacts percent-encoded labels, encoded ids, and double slashes", () => {
    expect(redactAccessLogUrl("/api/%6d%65%73%68/%73%65%73%73%69%6f%6e%73/not-a-digest")).toBe(
      "/api/%6d%65%73%68/%73%65%73%73%69%6f%6e%73/redacted",
    );
    expect(redactAccessLogUrl("/api/mesh/sessions/%6e%6f%74%2d%61%2d%64%69%67%65%73%74")).toBe(
      "/api/mesh/sessions/redacted",
    );
    expect(redactAccessLogUrl("/api/mesh//sessions/not-a-digest")).toBe("/api/mesh//sessions/redacted");
    expect(redactAccessLogUrl("/api/mesh/sessions//not-a-digest")).toBe("/api/mesh/sessions//redacted");
    expect(redactAccessLogUrl(`/api/mesh/sessions/${adminHash}`)).toBe("/api/mesh/sessions/redacted");
    expect(redactAccessLogUrl("%E0%A4%A")).toBe("%E0%A4%A");
  });
});

describe("mesh session hashes stay out of access logs", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousAdminKey = process.env.TESSERACT_ADMIN_KEY;

  beforeAll(async () => {
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "postgresql://127.0.0.1:1/access_log_redact";
    }
    setServerReady();
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousAdminKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
    else process.env.TESSERACT_ADMIN_KEY = previousAdminKey;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("redacts the key hash in the logged request url", async () => {
    const destination = loggerDestination(logger);
    expect(destination === undefined).toBe(false);
    const chunks: string[] = [];
    const originalWrite = destination?.write.bind(destination);
    if (destination && originalWrite) {
      destination.write = (chunk: unknown, ...rest: unknown[]) => {
        chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8"));
        return originalWrite(chunk, ...rest);
      };
    }
    const loggerSpies = LOG_LEVELS.map((level) => vi.spyOn(logger, level));
    try {
      const response = await fetch(`${baseUrl}/api/mesh/sessions/${adminHash}`, {
        headers: { "x-admin-token": ADMIN_KEY },
      });
      expect(response.status).toBe(200);
      const output = [
        chunks.join(""),
        JSON.stringify(loggerSpies.map((spy) => spy.mock.calls)),
      ].join("\n");
      expect(output.includes("/api/mesh/sessions/redacted")).toBe(true);
      expect(output.includes(adminHash)).toBe(false);
      expect(output.includes(ADMIN_KEY)).toBe(false);
      for (let length = 4; length <= adminHash.length; length += 1) {
        expect(output.includes(adminHash.slice(0, length))).toBe(false);
      }
    } finally {
      if (destination && originalWrite) destination.write = originalWrite;
      for (const spy of loggerSpies) spy.mockRestore();
    }
  });

  it("redacts a mixed-case mesh sessions path in the logged request url", async () => {
    const destination = loggerDestination(logger);
    expect(destination === undefined).toBe(false);
    const chunks: string[] = [];
    const originalWrite = destination?.write.bind(destination);
    if (destination && originalWrite) {
      destination.write = (chunk: unknown, ...rest: unknown[]) => {
        chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8"));
        return originalWrite(chunk, ...rest);
      };
    }
    const loggerSpies = LOG_LEVELS.map((level) => vi.spyOn(logger, level));
    try {
      const response = await fetch(`${baseUrl}/api/MESH/Sessions/${adminHash}`, {
        headers: { "x-admin-token": ADMIN_KEY },
      });
      expect(response.status > 0).toBe(true);
      const output = [
        chunks.join(""),
        JSON.stringify(loggerSpies.map((spy) => spy.mock.calls)),
      ].join("\n");
      expect(output.includes("/api/MESH/Sessions/redacted")).toBe(true);
      expect(output.includes(adminHash)).toBe(false);
      expect(output.includes(ADMIN_KEY)).toBe(false);
      for (let length = 4; length <= adminHash.length; length += 1) {
        expect(output.includes(adminHash.slice(0, length))).toBe(false);
      }
    } finally {
      if (destination && originalWrite) destination.write = originalWrite;
      for (const spy of loggerSpies) spy.mockRestore();
    }
  });
});
