import { createServer, type Server } from "node:http";
import { DrizzleQueryError } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app, { setServerReady } from "../app";
import { logger } from "../lib/logger";
import { ObjectStorageService } from "../lib/objectStorage";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";

const ADMIN_KEY = "synthetic-storage-log-admin";
const CANARY = `${"f".repeat(16)}CANARYHASH${"e".repeat(16)}`;

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

function queryFault(unavailable: boolean): DrizzleQueryError {
  const query = unavailable ? "select 1 where note = ENOTFOUND" : "select 1 where id = $1";
  return new DrizzleQueryError(query, [CANARY], new Error(`pg ${CANARY}`));
}

describe("storage errors stay out of pino-http logs", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousAdminKey = process.env.TESSERACT_ADMIN_KEY;
  const previousSession = process.env.SOVEREIGN_SESSION_SECRET;

  beforeAll(async () => {
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    process.env.SOVEREIGN_SESSION_SECRET = "synthetic-storage-log-session-secret-32chars";
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "postgresql://127.0.0.1:1/storage_log_redact";
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
    if (previousSession === undefined) delete process.env.SOVEREIGN_SESSION_SECRET;
    else process.env.SOVEREIGN_SESSION_SECRET = previousSession;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function capture(run: () => Promise<void>): Promise<string> {
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
    try {
      await run();
    } finally {
      if (destination && originalWrite) destination.write = originalWrite;
    }
    return chunks.join("");
  }

  function expectRedacted(output: string, body: string): void {
    expect(output.includes(CANARY)).toBe(false);
    expect(output.includes("Failed query")).toBe(false);
    expect(body.includes(CANARY)).toBe(false);
    expect(body.includes("Failed query")).toBe(false);
  }

  it("redacts a drizzle params canary on the upload failure log", async () => {
    const spy = vi.spyOn(ObjectStorageService.prototype, "getObjectEntityUploadURL").mockRejectedValue(queryFault(false));
    try {
      let body = "";
      const output = await capture(async () => {
        const response = await fetch(`${baseUrl}/api/storage/uploads/request-url`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${SESSION_COOKIE}=${issueSession({ ip: "127.0.0.1", userAgent: "vitest" }).signedId}`,
          },
          body: JSON.stringify({ name: "sample.bin" }),
        });
        body = await response.text();
        expect(response.status).toBe(500);
        expect(JSON.parse(body)).toEqual({ error: "Failed to generate upload URL" });
      });
      expect(output.includes("Error generating upload URL")).toBe(true);
      expectRedacted(output, body);
    } finally {
      spy.mockRestore();
    }
  });

  it("redacts a drizzle params canary when object storage is unavailable", async () => {
    const spy = vi.spyOn(ObjectStorageService.prototype, "getObjectEntityFile").mockRejectedValue(queryFault(true));
    try {
      let body = "";
      const output = await capture(async () => {
        const response = await fetch(`${baseUrl}/api/storage/objects/sample`);
        body = await response.text();
        expect(response.status).toBe(404);
        expect(JSON.parse(body)).toEqual({
          error: "Object not found",
          reason: "storage backend unavailable",
        });
      });
      expect(output.includes("Storage backend unavailable")).toBe(true);
      expectRedacted(output, body);
    } finally {
      spy.mockRestore();
    }
  });

  it("redacts a drizzle params canary when serving an object fails", async () => {
    const spy = vi.spyOn(ObjectStorageService.prototype, "getObjectEntityFile").mockRejectedValue(queryFault(false));
    try {
      let body = "";
      const output = await capture(async () => {
        const response = await fetch(`${baseUrl}/api/storage/objects/sample`);
        body = await response.text();
        expect(response.status).toBe(500);
        expect(JSON.parse(body)).toEqual({ error: "Failed to serve object" });
      });
      expect(output.includes("Error serving object")).toBe(true);
      expectRedacted(output, body);
    } finally {
      spy.mockRestore();
    }
  });

  it("redacts a drizzle params canary when public storage is unavailable", async () => {
    const spy = vi.spyOn(ObjectStorageService.prototype, "searchPublicObject").mockRejectedValue(queryFault(true));
    try {
      let body = "";
      const output = await capture(async () => {
        const response = await fetch(`${baseUrl}/api/storage/public-objects/sample.txt`);
        body = await response.text();
        expect(response.status).toBe(404);
        expect(JSON.parse(body)).toEqual({
          error: "File not found",
          reason: "storage backend unavailable",
        });
      });
      expect(output.includes("Public storage backend unavailable")).toBe(true);
      expectRedacted(output, body);
    } finally {
      spy.mockRestore();
    }
  });

  it("redacts a drizzle params canary when serving a public object fails", async () => {
    const spy = vi.spyOn(ObjectStorageService.prototype, "searchPublicObject").mockRejectedValue(queryFault(false));
    try {
      let body = "";
      const output = await capture(async () => {
        const response = await fetch(`${baseUrl}/api/storage/public-objects/sample.txt`);
        body = await response.text();
        expect(response.status).toBe(500);
        expect(JSON.parse(body)).toEqual({ error: "Failed to serve public object" });
      });
      expect(output.includes("Error serving public object")).toBe(true);
      expectRedacted(output, body);
    } finally {
      spy.mockRestore();
    }
  });
});
