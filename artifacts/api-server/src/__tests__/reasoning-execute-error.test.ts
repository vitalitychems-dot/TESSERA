import { afterAll, describe, expect, it, vi } from "vitest";

const savedDatabaseUrl = vi.hoisted(() => {
  const value = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  return value;
});

import { createServer, type Server } from "node:http";
import express from "express";
import reasoningRouter from "../routes/reasoning";

const THROWN = "database not configured";

describe("reasoning execute error body", () => {
  const servers: Server[] = [];

  afterAll(async () => {
    if (savedDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = savedDatabaseUrl;
    await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    })));
  });

  it("returns a fixed details label and omits the thrown message", async () => {
    const app = express();
    app.use(express.json());
    app.use(reasoningRouter);
    const server = createServer(app);
    servers.push(server);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    const response = await fetch(`http://127.0.0.1:${address.port}/reasoning/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ codeId: 1 }),
    });
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: "Execution failed", details: "internal error" });
    expect(text.includes(THROWN)).toBe(false);
  });
});
