import { afterAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import {
  DbUnavailableError,
  db,
  getDb,
  getPool,
  isDbConfigured,
  setPoolFactoryForTests,
} from "@workspace/db";
import healthRouter from "../routes/health";
import inventionsRouter from "../routes/inventions";
import { rejectWhenDatabaseNotConfigured } from "../lib/db-availability";

const poolCalls: Array<{ connectionString?: string }> = [];

class FakePgPool {
  readonly connectionString: string | undefined;
  constructor(config: { connectionString?: string }) {
    this.connectionString = config.connectionString;
    poolCalls.push(config);
  }
  on(): this {
    return this;
  }
  query(): Promise<{ rows: unknown[]; rowCount: number }> {
    return Promise.resolve({ rows: [], rowCount: 0 });
  }
  connect(): Promise<{ query: () => Promise<{ rows: unknown[]; rowCount: number }>; release: () => void }> {
    return Promise.resolve({
      query: () => Promise.resolve({ rows: [], rowCount: 0 }),
      release: () => undefined,
    });
  }
  end(): Promise<void> {
    return Promise.resolve();
  }
}

const FAKE_CONNECTION_STRING = "postgres://configured-path-test@db.invalid/none";

async function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test server address");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("optional database boot", () => {
  const servers: Server[] = [];

  afterAll(async () => {
    await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    })));
  });

  it("imports @workspace/db with DATABASE_URL unset and does not build a pool", () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(isDbConfigured()).toBe(false);
    expect(poolCalls).toEqual([]);
    expect(() => {
      db.select();
    }).toThrow(DbUnavailableError);
    try {
      db.select();
    } catch (err) {
      expect(err).toBeInstanceOf(DbUnavailableError);
      expect(err).toMatchObject({ message: "database not configured" });
    }
  });

  it("GET /healthz returns 200 and db not-configured without connecting", async () => {
    expect(poolCalls).toEqual([]);
    const app = express();
    app.use(healthRouter);
    const { server, baseUrl } = await listen(app);
    servers.push(server);
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", db: "not-configured" });
    expect(poolCalls).toEqual([]);
  });

  it("GET /api/inventions returns 503 when the database is not configured", async () => {
    const app = express();
    app.use(express.json());
    app.use(rejectWhenDatabaseNotConfigured);
    app.use("/api", inventionsRouter);
    const { server, baseUrl } = await listen(app);
    servers.push(server);
    const response = await fetch(`${baseUrl}/api/inventions`);
    expect(response.status).toBe(503);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "database not configured" });
    expect(JSON.stringify(body)).not.toContain("stack");
    expect(poolCalls).toEqual([]);
  });

  it("builds one drizzle instance from a mocked pool when a fake connection string is set", async () => {
    const previous = process.env.DATABASE_URL;
    poolCalls.length = 0;
    setPoolFactoryForTests(((connectionString: string) => new FakePgPool({ connectionString })) as unknown as NonNullable<
      Parameters<typeof setPoolFactoryForTests>[0]
    >);
    process.env.DATABASE_URL = FAKE_CONNECTION_STRING;
    try {
      expect(isDbConfigured()).toBe(true);
      const database = getDb();
      expect(database).toBe(getDb());
      expect(typeof database.select).toBe("function");
      expect(getPool()).toBe(getDb().$client);
      expect(poolCalls).toEqual([{ connectionString: FAKE_CONNECTION_STRING }]);
      expect(() => {
        db.select();
      }).not.toThrow();
      await getPool().end();
    } finally {
      setPoolFactoryForTests(null);
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(isDbConfigured()).toBe(false);
  });
});
