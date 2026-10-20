import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

vi.mock("@workspace/db", () => ({
  db: {},
  moltbookPublicationsTable: {},
}));

vi.mock("../lib/sovereign-admin", () => ({
  decideOwnerSession: () => ({ ok: false, status: 401, error: "unauthenticated" }),
}));

vi.mock("../lib/moltbook-publisher", () => ({
  createMoltbookPost: vi.fn(),
  verifyMoltbookPost: vi.fn(),
}));

vi.mock("../lib/moltbook-bridge", () => ({
  fetchMoltbookPublicPosts: vi.fn(),
}));

import { createMoltbookPost, verifyMoltbookPost } from "../lib/moltbook-publisher";
import publicationRouter from "../routes/moltbook-publishing";

describe("Moltbook publication owner gate", () => {
  const app = express();
  app.use(express.json());
  app.use(publicationRouter);

  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server failed to bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  it("rejects every queue mutation without an owner session before accessing Moltbook", async () => {
    const requests: Array<[string, string, object?]> = [
      ["/drafts", "POST", { title: "Owner title", content: "Owner-written text." }],
      ["/1/approve", "POST"],
      ["/1/publish", "POST"],
      ["/1/verify", "POST", { verificationCode: "moltbook_verify_12345678", answer: "25.00" }],
      ["/1/reconcile", "POST"],
      ["/1", "DELETE"],
    ];

    for (const [path, method, body] of requests) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      expect(response.status, `${method} ${path}`).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }

    expect(createMoltbookPost).not.toHaveBeenCalled();
    expect(verifyMoltbookPost).not.toHaveBeenCalled();
  });
});
