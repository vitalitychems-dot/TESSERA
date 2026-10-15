import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import personalDataRouter from "../routes/personal-data";
import feedbackRouter from "../routes/feedback";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";

const testState = vi.hoisted(() => ({
  count: 0,
  selectCalls: 0,
  deleted: [] as unknown[],
  inserted: [] as unknown[],
  feedbackValues: null as Record<string, unknown> | null,
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: (projection?: unknown) => ({
      from: (_table: unknown) => {
        testState.selectCalls += 1;
        if (projection && typeof projection === "object" && "count" in projection) {
          return Promise.resolve([{ count: testState.count }]);
        }
        return Promise.resolve([{ id: 7, content: "synthetic private chat text" }]);
      },
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        testState.feedbackValues = values;
        return { returning: async () => [{ id: 99 }] };
      },
    }),
    transaction: async (run: (tx: any) => Promise<unknown>) => run({
      delete: async (table: unknown) => { testState.deleted.push(table); },
      insert: () => ({
        values: (value: unknown) => {
          testState.inserted.push(value);
          return { onConflictDoUpdate: async () => undefined };
        },
      }),
    }),
  },
}));

const SESSION_SECRET = "synthetic-session-secret-for-personal-data-test-32chars";
let previousSessionSecret: string | undefined;
let previousAdminKey: string | undefined;

beforeAll(() => {
  previousSessionSecret = process.env.SOVEREIGN_SESSION_SECRET;
  previousAdminKey = process.env.TESSERACT_ADMIN_KEY;
  process.env.SOVEREIGN_SESSION_SECRET = SESSION_SECRET;
  process.env.TESSERACT_ADMIN_KEY = "synthetic-admin-key-for-personal-data-test";
});

afterAll(() => {
  if (previousSessionSecret === undefined) delete process.env.SOVEREIGN_SESSION_SECRET;
  else process.env.SOVEREIGN_SESSION_SECRET = previousSessionSecret;
  if (previousAdminKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
  else process.env.TESSERACT_ADMIN_KEY = previousAdminKey;
});

beforeEach(() => {
  testState.count = 0;
  testState.selectCalls = 0;
  testState.deleted = [];
  testState.inserted = [];
  testState.feedbackValues = null;
});

async function start() {
  const app = express();
  app.use(express.json());
  app.use("/api", personalDataRouter);
  app.use("/api", feedbackRouter);
  const server: Server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  const apiUrl = `http://127.0.0.1:${port}/api`;
  return { server, apiUrl, baseUrl: `${apiUrl}/privacy/data` };
}

function ownerCookie() {
  const issued = issueSession({ ip: "127.0.0.1", userAgent: "personal-data-test" });
  return `${SESSION_COOKIE}=${encodeURIComponent(issued.signedId)}`;
}

async function close(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

describe("owner personal data routes", () => {
  it("denies anonymous summary, export, preview, and delete requests before touching stored data", async () => {
    const { server, baseUrl } = await start();
    try {
      const requests = await Promise.all([
        fetch(`${baseUrl}/summary`),
        fetch(`${baseUrl}/export`),
        fetch(`${baseUrl}/delete/preview`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
        fetch(`${baseUrl}/delete`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
        fetch(`${baseUrl.replace("/privacy/data", "")}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rating: "down" }) }),
      ]);
      expect(requests.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);
      expect(testState.selectCalls).toBe(0);
      expect(testState.deleted).toHaveLength(0);
      expect(testState.feedbackValues).toBeNull();
    } finally {
      await close(server);
    }
  });

  it("exports only the documented owner data and summary/export never delete records", async () => {
    const { server, baseUrl } = await start();
    try {
      const headers = { cookie: ownerCookie() };
      const summary = await fetch(`${baseUrl}/summary`, { headers });
      expect(summary.status).toBe(200);
      const summaryData = await summary.json() as { counts: Record<string, number> };
      expect(summaryData.counts).toMatchObject({
        conversations: 0,
        messages: 0,
        feedback: 0,
        providerCalls: 0,
      });

      const response = await fetch(`${baseUrl}/export`, { headers });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("content-disposition")).toContain("tessera-owner-data-");
      const exportData = await response.json() as {
        included: Record<string, unknown>;
        excluded: string[];
      };
      expect(exportData.included).toHaveProperty("conversations");
      expect(exportData.included).toHaveProperty("messages");
      expect(exportData.included).toHaveProperty("providerCalls");
      expect(JSON.stringify(exportData)).toContain("synthetic private chat text");
      expect(exportData.included).not.toHaveProperty("fatherChatSigils");
      expect(exportData.excluded).toContain("Replit Secrets and externally managed provider data");
      expect(testState.deleted).toHaveLength(0);
    } finally {
      await close(server);
    }
  });

  it("requires a fresh count review and exact phrase before an atomic deletion", async () => {
    const { server, baseUrl } = await start();
    try {
      const headers = { cookie: ownerCookie(), "content-type": "application/json" };
      const previewResponse = await fetch(`${baseUrl}/delete/preview`, { method: "POST", headers, body: "{}" });
      expect(previewResponse.status).toBe(200);
      const preview = await previewResponse.json() as { previewToken: string; confirmPhrase: string };

      const rejected = await fetch(`${baseUrl}/delete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ previewToken: preview.previewToken, confirmation: "wrong phrase" }),
      });
      expect(rejected.status).toBe(400);
      expect(testState.deleted).toHaveLength(0);

      const accepted = await fetch(`${baseUrl}/delete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ previewToken: preview.previewToken, confirmation: preview.confirmPhrase }),
      });
      expect(accepted.status).toBe(200);
      expect(testState.deleted).toHaveLength(8);
      expect(testState.inserted).toHaveLength(1);
      expect(testState.inserted[0]).toMatchObject({ key: "privacy:father-natal-chart-removed", value: true });
    } finally {
      await close(server);
    }
  });

  it("refuses deletion if the reviewed record counts changed", async () => {
    const { server, baseUrl } = await start();
    try {
      const headers = { cookie: ownerCookie(), "content-type": "application/json" };
      const previewResponse = await fetch(`${baseUrl}/delete/preview`, { method: "POST", headers, body: "{}" });
      const preview = await previewResponse.json() as { previewToken: string; confirmPhrase: string };
      testState.count = 1;
      const response = await fetch(`${baseUrl}/delete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ previewToken: preview.previewToken, confirmation: preview.confirmPhrase }),
      });
      expect(response.status).toBe(409);
      expect(testState.deleted).toHaveLength(0);
    } finally {
      await close(server);
    }
  });

  it("discards legacy free-text feedback fields instead of persisting them", async () => {
    const { server, apiUrl } = await start();
    try {
      const privateMarker = "synthetic-private-feedback-marker";
      const response = await fetch(`${apiUrl}/feedback`, {
        method: "POST",
        headers: { cookie: ownerCookie(), "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: 4,
          messageId: 8,
          rating: "down",
          userQuery: privateMarker,
          responseExcerpt: privateMarker,
          reason: privateMarker,
          metadata: { private: privateMarker },
          modelTier: privateMarker,
          routerReason: privateMarker,
        }),
      });
      expect(response.status).toBe(200);
      expect(testState.feedbackValues).toMatchObject({
        conversationId: 4,
        messageId: 8,
        rating: "down",
        reason: null,
        userQuery: null,
        responseExcerpt: null,
        metadata: null,
        modelTier: null,
        routerReason: null,
      });
      expect(JSON.stringify(testState.feedbackValues)).not.toContain(privateMarker);
    } finally {
      await close(server);
    }
  });
});
