import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { HealthCheckResponse } from "@workspace/api-zod";
import healthRouter from "../routes/health";

describe("GET /healthz", () => {
  let server: Server | undefined;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(healthRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns the Zod-parsed health payload", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    expect(HealthCheckResponse.parse(json)).toEqual({ status: "ok" });
    expect(json).toEqual({ status: "ok" });
  });
});
