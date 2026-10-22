import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  councilSessionsTable: { id: "id" },
}));

vi.mock("../lib/grand-council-deliberation", () => ({
  convene: vi.fn(async () => {
    throw new Error("synthetic-secret-detail");
  }),
  getSession: vi.fn(async () => null),
  listSessions: vi.fn(async () => []),
  memberRoster: vi.fn(() => []),
  COUNCIL_PROPOSALS: [],
  subscribe: vi.fn(() => () => undefined),
}));

vi.mock("../lib/sacred-conference-orchestrator", () => ({
  runSacredConference: vi.fn(async () => {
    throw new Error("synthetic-secret-detail");
  }),
  getSacredConference: vi.fn(async () => null),
}));

import express from "express";
import { createServer, type Server } from "node:http";
import grandCouncilRouter from "../routes/grand-council";
import omniversalRouter from "../routes/omniversal";

describe("privileged 500 bodies", () => {
  let server: Server | undefined;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(grandCouncilRouter);
    app.use(omniversalRouter);
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

  it("returns a generic grand-council convene failure", async () => {
    const response = await fetch(`${baseUrl}/grand-council/convene`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.40",
      },
      body: "{}",
    });
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("synthetic-secret-detail");
    expect(JSON.parse(text)).toEqual({ ok: false, error: "grand-council-failed" });
  });

  it("returns a generic conference run failure", async () => {
    const response = await fetch(`${baseUrl}/omniversal/conference/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.41",
      },
      body: "{}",
    });
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("synthetic-secret-detail");
    expect(JSON.parse(text)).toEqual({ ok: false, error: "conference-failed" });
  });
});
