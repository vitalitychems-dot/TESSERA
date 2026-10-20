import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { createHash } from "node:crypto";
import { attachMeshClient } from "../../api-server/src/lib/mesh-connection";
import { getGroupSessions } from "../../api-server/src/lib/session-mesh";
import { issueSession, lookupSession, revokeSession, SESSION_COOKIE } from "../../api-server/src/lib/sovereign-session";

// Reuse the API workspace's declared socket dependency; no browser dependency is added.
const apiRequire = createRequire(new URL("../../api-server/package.json", import.meta.url));
const { WebSocket, WebSocketServer } = apiRequire("ws");
const OWNER_KEY = "synthetic-mesh-browser-owner-key";
const SIGNING_SECRET = "synthetic-mesh-browser-signing-secret-at-least-32";

test("the browser registers and exchanges real mesh events using only its owner cookie", async ({ page }) => {
  const previousKey = process.env.TESSERACT_ADMIN_KEY;
  const previousSecret = process.env.SOVEREIGN_SESSION_SECRET;
  process.env.TESSERACT_ADMIN_KEY = OWNER_KEY;
  process.env.SOVEREIGN_SESSION_SECRET = SIGNING_SECRET;
  const ownerHash = createHash("sha256").update(OWNER_KEY).digest("hex");
  const frames: string[] = [];
  const handshakeCookies: boolean[] = [];
  const peerMessages: Array<Record<string, unknown>> = [];
  let signedId: string | null = null;
  const server = createServer();
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024 });
  wss.on("connection", (ws: Parameters<typeof attachMeshClient>[0], req: Parameters<typeof attachMeshClient>[1]) => {
    handshakeCookies.push(Boolean(signedId && req.headers.cookie?.includes(`${SESSION_COOKIE}=${signedId}`)));
    ws.on("message", frame => frames.push(frame.toString()));
    attachMeshClient(ws, req, {
      loadEnrichment: async () => ({ recentTasks: [], recentDecisions: [] }),
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    // Only redirect transport to an isolated real server. The app's actual
    // WebSocket client, MeshProvider and the API's real handler remain in use.
    await page.addInitScript((socketUrl: string) => {
      const NativeWebSocket = window.WebSocket;
      window.WebSocket = class extends NativeWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          // Preserve Vite HMR and any other unrelated socket connections.
          const path = new URL(url, window.location.href).pathname;
          super(path === "/ws" ? socketUrl : url, protocols);
        }
      };
    }, `ws://127.0.0.1:${port}/ws`);
    await page.route("**/api/**", async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === "/api/admin/session/status") {
        const hasCookie = Boolean(signedId && request.headers().cookie?.includes(`${SESSION_COOKIE}=${signedId}`));
        return route.fulfill({
          json: {
            ok: true, configured: true,
            authenticated: hasCookie && lookupSession(signedId).valid,
            expiresAt: Date.now() + 60_000,
          },
        });
      }
      if (path === "/api/admin/session" && request.method() === "POST") {
        if (request.postDataJSON().token !== OWNER_KEY) {
          return route.fulfill({ status: 401, json: { ok: false } });
        }
        const issued = issueSession({ userAgent: "synthetic-browser-mesh-test" });
        signedId = issued.signedId;
        return route.fulfill({
          headers: { "set-cookie": `${SESSION_COOKIE}=${signedId}; Path=/; HttpOnly; SameSite=Strict` },
          json: { ok: true, authenticated: true, expiresAt: issued.expiresAt },
        });
      }
      if (path === "/api/conversations" && request.method() === "POST") {
        return route.fulfill({ status: 201, json: { id: 42, title: "Synthetic mesh test" } });
      }
      if (path === "/api/messages" || path === "/api/conversations") return route.fulfill({ json: [] });
      return route.fulfill({ json: {} });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Use device keyboard", exact: true }).click();
    await page.getByLabel("Father admin code or LUS form").fill(OWNER_KEY);
    await page.getByRole("button", { name: "Unlock Tesseract", exact: true }).click();
    await expect(page.getByTestId("input-message")).toBeVisible();
    await expect.poll(() => getGroupSessions(ownerHash).length).toBe(1);
    const browserSession = getGroupSessions(ownerHash)[0]!.sessionId;
    // Other app subscribers may connect before the entry gate is unlocked.
    // Owner registration must follow a fresh cookie-bearing handshake.
    expect(handshakeCookies.filter(Boolean)).toHaveLength(1);
    const cookie = (await page.context().cookies()).find(value => value.name === SESSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain(SESSION_COOKIE);

    await page.evaluate(async () => {
      const modulePath = "/src/lib/websocket.ts";
      const { tesseraWS } = await import(modulePath);
      const target = window as Window & { __meshReceived?: Array<Record<string, unknown>> };
      target.__meshReceived = [];
      tesseraWS.subscribe("mesh", (message: Record<string, unknown>) => target.__meshReceived!.push(message));
    });
    const peer = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { cookie: `${SESSION_COOKIE}=${signedId}` },
    });
    peer.on("message", (raw: Buffer) => peerMessages.push(JSON.parse(raw.toString())));
    await new Promise<void>((resolve, reject) => {
      peer.once("open", resolve);
      peer.once("error", reject);
    });
    peer.send(JSON.stringify({ type: "mesh:auth", metadata: { currentPage: "/synthetic-peer" } }));
    await expect.poll(() => peerMessages.some(message => message.type === "mesh:registered")).toBe(true);
    await expect.poll(() => getGroupSessions(ownerHash).length).toBe(2);
    expect(handshakeCookies.filter(Boolean)).toHaveLength(2);

    peer.send(JSON.stringify({ type: "mesh:broadcast", eventType: "test:to-browser", payload: { value: "peer-event" } }));
    await expect.poll(() => page.evaluate(() => {
      const target = window as Window & { __meshReceived?: Array<Record<string, unknown>> };
      return target.__meshReceived?.some(message => message.type === "mesh:event" && message.eventType === "test:to-browser");
    })).toBe(true);
    await page.evaluate(async () => {
      const modulePath = "/src/lib/websocket.ts";
      const { tesseraWS } = await import(modulePath);
      tesseraWS.send({ type: "mesh:broadcast", eventType: "test:from-browser", payload: { value: "browser-event" } });
    });
    await expect.poll(() => peerMessages.some(message => message.eventType === "test:from-browser")).toBe(true);
    expect(peerMessages.find(message => message.eventType === "test:from-browser"))
      .toMatchObject({ type: "mesh:event", fromSession: browserSession, payload: { value: "browser-event" } });
    for (const frame of frames) {
      expect(JSON.parse(frame)).not.toHaveProperty("token");
      expect(frame).not.toContain(OWNER_KEY);
      expect(frame).not.toContain(signedId!);
    }
    expect(frames.some(frame => JSON.parse(frame).type === "mesh:auth")).toBe(true);
    expect(page.url()).not.toContain(OWNER_KEY);
    expect(JSON.stringify(peerMessages)).not.toContain(OWNER_KEY);
    expect(JSON.stringify(peerMessages)).not.toContain(signedId!);
  } finally {
    await page.close();
    for (const client of wss.clients) client.terminate();
    await new Promise<void>(resolve => wss.close(() => resolve()));
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (signedId) revokeSession(signedId);
    if (previousKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
    else process.env.TESSERACT_ADMIN_KEY = previousKey;
    if (previousSecret === undefined) delete process.env.SOVEREIGN_SESSION_SECRET;
    else process.env.SOVEREIGN_SESSION_SECRET = previousSecret;
  }
});
