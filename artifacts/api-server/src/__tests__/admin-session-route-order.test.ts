import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import adminSessionRouter from "../routes/admin-session";
import providerSovereigntyRouter from "../routes/provider-sovereignty";

describe("admin session gate route ordering", () => {
  let server: Server | undefined;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    // Match the shared router's order: provider sovereignty comes before the
    // admin-session routes.
    app.use("/api", providerSovereigntyRouter);
    app.use("/api", adminSessionRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server failed to start");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("allows the unauthenticated gate-status request to reach its handler", async () => {
    const response = await fetch(`${baseUrl}/api/admin/session/status`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      authenticated: false,
    });
  });

  it("keeps provider-sovereignty endpoints protected", async () => {
    const response = await fetch(`${baseUrl}/api/provider-sovereignty/providers`);
    expect(response.status).toBe(401);
  });
});
