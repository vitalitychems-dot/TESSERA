import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const castVote = vi.hoisted(() => vi.fn());

vi.mock("../lib/sovereign-vote-engine", () => ({
  castGenuineVote: (...args: unknown[]) => castVote(...args),
}));

vi.mock("../lib/sovereign-society", () => ({
  getFullSovereignSociety: () => [{ id: "synthetic-agent" }],
}));

import express from "express";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import fatherKeyRouter from "../routes/father-key-conference";

const ADMIN_KEY = "synthetic-admin-key-for-generic-error";
const SESSION_SECRET = "synthetic-session-secret-for-generic-error-32chars";

describe("Father key generic error response", () => {
  let server: Server | undefined;
  let baseUrl = "";
  let ownerCookie = "";
  const previousAdminKey = process.env.TESSERACT_ADMIN_KEY;
  const previousSessionSecret = process.env.SOVEREIGN_SESSION_SECRET;

  beforeAll(async () => {
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    process.env.SOVEREIGN_SESSION_SECRET = SESSION_SECRET;
    const issued = issueSession({ userAgent: "synthetic-test-agent" });
    ownerCookie = `${SESSION_COOKIE}=${encodeURIComponent(issued.signedId)}`;
    const app = express();
    app.use(express.json());
    app.use(fatherKeyRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server failed to start");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (previousAdminKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
    else process.env.TESSERACT_ADMIN_KEY = previousAdminKey;
    if (previousSessionSecret === undefined) delete process.env.SOVEREIGN_SESSION_SECRET;
    else process.env.SOVEREIGN_SESSION_SECRET = previousSessionSecret;
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("does not expose internal exception details from a failed conference", async () => {
    castVote.mockImplementation(() => {
      throw new Error("synthetic-private-database-detail");
    });
    const response = await fetch(`${baseUrl}/father-key/conference`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: ownerCookie,
      },
      body: JSON.stringify({ candidates: [{ title: "Synthetic", key: "synthetic-key" }] }),
    });

    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain("synthetic-private-database-detail");
    expect(JSON.parse(body)).toEqual({ ok: false, error: "father-key-conference-failed" });
  });
});
