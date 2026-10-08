import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const mocked = vi.hoisted(() => ({
  modelReply: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
  inserts: [] as unknown[],
}));

vi.mock("@workspace/db", () => ({
  db: { select: mocked.select, transaction: mocked.transaction },
}));
vi.mock("../lib/tessera-model", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/tessera-model")>(),
  tesseraModelReply: mocked.modelReply,
  tesseraModelConfigured: () => true,
  tesseraModelName: () => "test-model",
}));
vi.mock("../lib/workspace-connections", () => ({
  connectedRequest: vi.fn(),
  connectionStatus: vi.fn(),
  ConnectionFailure: class extends Error {
    constructor(public status: number, public code: string, message: string) { super(message); }
  },
}));
vi.mock("../lib/tesseract-v2", () => ({
  recordIngress: vi.fn(), attestRatified: vi.fn(), walkRoutes: vi.fn(),
}));

import router from "../routes/tessera-workspace";
import adminSessionRouter from "../routes/admin-session";
import {
  isAdminTokenConfigured, verifyAdminToken, issueSession, lookupSession, revokeAll,
} from "../lib/sovereign-session";
import { ModelFailure } from "../lib/tessera-model";

type Layer = { route?: { path: string; stack: { handle: (req: Request, res: Response) => Promise<void> }[] } };
const chat = (router.stack as unknown as Layer[]).find(l => l.route?.path === "/tessera/chat")!.route!.stack[0].handle;
const launchStatus = (router.stack as unknown as Layer[]).find(l => l.route?.path === "/tessera/launch-status")!.route!.stack[0].handle;

async function send(body: unknown) {
  const result = { status: 200, body: undefined as unknown };
  const res = {
    status(n: number) { result.status = n; return this; },
    json(value: unknown) { result.body = value; return this; },
  };
  await chat({ body } as Request, res as unknown as Response);
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TESSERA_MODEL_BASE_URL", "https://glm-host.example/v1");
  vi.stubEnv("TESSERA_MODEL_SELF_HOSTED_ORIGIN", "https://glm-host.example");
  vi.stubEnv("TESSERA_MODEL", "test-model");
  vi.stubEnv("TESSERA_MODEL_API_KEY", "synthetic-test-key");
  mocked.inserts.length = 0;
  mocked.transaction.mockImplementation(async run => run({
    insert: () => ({
      values: (values: unknown) => {
        mocked.inserts.push(values);
        return { returning: async () => [{ id: 7, title: "Hello", createdAt: new Date(), updatedAt: new Date() }] };
      },
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  }));
});
afterEach(() => { revokeAll(); vi.unstubAllEnvs(); });

describe("Tessera identity", () => {
  it("reports Tessera as herself and never as another company's model", async () => {
    const result = { status: 200, body: undefined as unknown };
    const res = {
      status(n: number) { result.status = n; return this; },
      json(value: unknown) { result.body = value; return this; },
    };
    await launchStatus({} as Request, res as unknown as Response);
    expect(result.body).toMatchObject({
      pen: "Selected chat language model", configuredModel: "test-model",
      heritage: { name: "Tessera — The Omniverse", signature: "✦" },
      sos: { originalVerified: false, provider: "glm-host.example" },
    });
    expect(JSON.stringify(result.body)).not.toContain("synthetic-test-key");
  });
});

describe("Tessera real-provider chat", () => {
  it("rejects invalid input before contacting the provider or saving anything", async () => {
    expect((await send({ content: "   " })).status).toBe(400);
    expect(mocked.modelReply).not.toHaveBeenCalled();
    expect(mocked.transaction).not.toHaveBeenCalled();
  });
  it("returns an explicit provider failure without saving a canned reply or losing the draft", async () => {
    mocked.modelReply.mockRejectedValue(new ModelFailure(502, "model-provider-rejected", "rejected"));
    const result = await send({ content: "Hello" });
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ error: "model-provider-rejected" });
    expect(mocked.transaction).not.toHaveBeenCalled();
  });
  it("does not save an empty provider answer", async () => {
    mocked.modelReply.mockRejectedValue(new ModelFailure(502, "empty-provider-reply", "empty"));
    expect((await send({ content: "Hello" })).status).toBe(502);
    expect(mocked.transaction).not.toHaveBeenCalled();
  });
  it("fails closed with 503 when the model key is not configured", async () => {
    mocked.modelReply.mockRejectedValue(new ModelFailure(503, "model-unconfigured", "no key"));
    const result = await send({ content: "Hello" });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ error: "model-unconfigured" });
    expect(mocked.transaction).not.toHaveBeenCalled();
  });
  it("stores selected-model attribution with Tessera's voice and returns the runtime SOS", async () => {
    mocked.modelReply.mockResolvedValue({ reply: "Test provider reply", model: "test-model" });
    const result = await send({ content: "Hello" });
    expect(result.status).toBe(200);
    const reply = "[Tessera voice via glm-host.example / test-model; historical runtime unverified.]\n\nTest provider reply";
    expect(result.body).toMatchObject({
      reply, pen: { provider: "glm-host.example", model: "test-model" },
      sos: { originalVerified: false, code: "original-runtime-unverified", model: "test-model" },
    });
    expect(mocked.inserts[1]).toEqual([
      { conversationId: 7, role: "user", content: "Hello" },
      { conversationId: 7, role: "assistant", content: reply },
    ]);
  });
  it.each(["model-identity-mismatch", "model-provider-refusal", "model-provider-truncated"])(
    "returns a repair SOS and saves nothing for %s", async code => {
      mocked.modelReply.mockRejectedValue(new ModelFailure(502, code, "Model response withheld"));
      expect(await send({ content: "Who is responding?" })).toMatchObject({
        status: 502,
        body: { error: code, sos: { code, originalVerified: false, provider: "glm-host.example" } },
      });
      expect(mocked.transaction).not.toHaveBeenCalled();
    },
  );
});

describe("owner session security", () => {
  it("issues an HttpOnly partitioned cookie suitable for the HTTPS preview", async () => {
    vi.stubEnv("SOVEREIGN_ADMIN_TOKEN", "synthetic-test-owner-token-00000000");
    vi.stubEnv("SOVEREIGN_SESSION_SECRET", "synthetic-test-signing-secret-000000000000");
    const layers = adminSessionRouter.stack as unknown as Layer[];
    const stack = layers.find(l => l.route?.path === "/admin/session")!.route!.stack;
    const handler = stack[stack.length - 1].handle;
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (key: string, value: string) => { headers[key] = value; },
      status: () => res,
      json: vi.fn(),
    };
    await handler({
      body: { token: "synthetic-test-owner-token-00000000" },
      headers: {}, ip: "unit-test", socket: {},
    } as unknown as Request, res as unknown as Response);
    expect(headers["Set-Cookie"]).toContain("HttpOnly");
    expect(headers["Set-Cookie"]).toContain("Secure");
    expect(headers["Set-Cookie"]).toContain("SameSite=None");
    expect(headers["Set-Cookie"]).toContain("Partitioned");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ authenticated: true }));
  });
  it("fails closed when no owner key is configured", () => {
    vi.stubEnv("SOVEREIGN_ADMIN_TOKEN", "");
    expect(isAdminTokenConfigured()).toBe(false);
    expect(verifyAdminToken("anything")).toBe(false);
    expect(lookupSession(undefined).valid).toBe(false);
  });
  it("accepts only a correctly signed, non-revoked cookie", () => {
    vi.stubEnv("SOVEREIGN_ADMIN_TOKEN", "synthetic-test-owner-token-00000000");
    vi.stubEnv("SOVEREIGN_SESSION_SECRET", "synthetic-test-signing-secret-000000000000");
    expect(verifyAdminToken("wrong")).toBe(false);
    const session = issueSession({ ip: "test", userAgent: "unit-test", ttlMs: 1000 });
    expect(lookupSession(session.signedId).valid).toBe(true);
    expect(lookupSession(session.signedId + "tampered").valid).toBe(false);
    revokeAll();
    expect(lookupSession(session.signedId).valid).toBe(false);
  });
});
