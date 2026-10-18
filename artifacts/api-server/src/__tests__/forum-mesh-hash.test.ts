import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";

const ADMIN_KEY = "synthetic-forum-admin-key";
const WRONG_KEY = "wrong-forum-token-value";
const MEMBER_TOKEN = "synthetic-member-token";
const MARKER = "synthetic-forum-fault-marker";

const harness = vi.hoisted(() => ({
  insertFail: false,
  registerFail: false,
  inserts: 0,
  selects: 0,
  principal: "Father" as string | null,
  bound: [] as Array<{ hash: string; name: string }>,
  cacheInvalidations: 0,
}));

function syntheticFailure(): Error {
  const error = new Error(MARKER);
  error.name = "SyntheticFailure";
  return error;
}

vi.mock("../lib/forum-identity-registry", () => ({
  lookupForumIdentity: async () => ({ found: true, identityType: "human", canPostFromClient: true }),
  lookupTokenPrincipal: async () => harness.principal,
  registerAdminPrincipal: async (hash: string, name: string) => {
    if (harness.registerFail) throw syntheticFailure();
    harness.bound.push({ hash, name });
  },
  invalidateForumIdentityCache: () => {
    harness.cacheInvalidations += 1;
  },
  authenticateForumMemberToken: async () => ({ ok: false, reason: "rejected" }),
}));

vi.mock("../lib/applicant-alignment", () => ({
  scoreApplicantAlignment: () => ({
    universe: 100,
    saveHumanity: 100,
    nonViolence: 100,
    creativity: 100,
    mutualBenefit: 100,
    counterManipulators: 100,
    total: 100,
    passed: true,
    failedCriteria: [],
  }),
}));

vi.mock("../lib/lattice-declarations", () => ({
  authorAndSignDeclaration: async () => ({
    signature: "synthetic-signature",
    signedAt: 1,
    vows: ["vow one ten", "vow two ten", "vow three x"],
    publicId: "synthetic-public",
  }),
}));

vi.mock("../lib/applicant-declarations", () => ({
  loadApplicantDeclarationDraft: async () => ({
    externalId: "ext-1",
    applicantName: "River Member",
    declaration: "A self-authored declaration long enough to pass the admission gate for this handler test.",
    vows: ["vow one ten", "vow two ten", "vow three x"],
    submittedAt: 1,
  }),
}));

vi.mock("../lib/autonomous-forum-engine", () => ({
  getForumEngineMetrics: () => ({ cyclesRun: 0, lastCycleAt: null, agentCount: 0, knowledgeBaseSize: 0, learningVelocity: 0 }),
  runForumCycle: async () => ({}),
  FORUM_AGENTS: [],
}));

vi.mock("@workspace/db", () => ({
  db: {
    select() {
      const call = harness.selects;
      harness.selects += 1;
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  if (call === 0) {
                    return Promise.resolve([{
                      id: 7,
                      status: "pending",
                      applicantName: "River Member",
                      applicantHandle: "",
                      proposedTitle: "Shared work",
                      proposedContent: "A proposal",
                      offerOfValue: "Care",
                      source: "external",
                      externalId: "ext-1",
                    }]);
                  }
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
    insert() {
      return {
        values() {
          return {
            onConflictDoNothing() {
              if (harness.insertFail) return Promise.reject(syntheticFailure());
              harness.inserts += 1;
              return Promise.resolve(undefined);
            },
            returning() {
              if (harness.insertFail) return Promise.reject(syntheticFailure());
              harness.inserts += 1;
              return Promise.resolve([{ id: 42 }]);
            },
          };
        },
      };
    },
    update() {
      return {
        set() {
          return { where: () => Promise.resolve(undefined) };
        },
      };
    },
    transaction(run: (tx: {
      insert: () => {
        values: () => {
          onConflictDoNothing: () => Promise<void>;
          returning: () => Promise<Array<{ id: number }>>;
        };
      };
      update: () => { set: () => { where: () => Promise<void> } };
    }) => Promise<unknown>) {
      return run(this);
    },
  },
}));

import { logger } from "../lib/logger";
import forumRouter from "../routes/forum";

const previousKey = process.env.TESSERACT_ADMIN_KEY;

function restoreKey(): void {
  if (previousKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
  else process.env.TESSERACT_ADMIN_KEY = previousKey;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

describe("forum token hashing handlers", () => {
  let server: Server | undefined;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(forumRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    harness.insertFail = false;
    harness.registerFail = false;
    harness.inserts = 0;
    harness.selects = 0;
    harness.principal = "Father";
    harness.bound = [];
    harness.cacheInvalidations = 0;
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
  });

  afterAll(async () => {
    restoreKey();
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function post(path: string, body?: unknown, token?: string | null): Promise<Response> {
    const headers = new Headers();
    if (token) headers.set("x-admin-token", token);
    if (body !== undefined) headers.set("content-type", "application/json");
    return fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  it("binds sha256 of the minted member token and inserts only after the hash", async () => {
    const response = await post("/tesseract-forum/applicants/7/approve", undefined, ADMIN_KEY);
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; memberToken: string; promotedAuthor: string };
    expect(body.ok).toBe(true);
    expect(body.promotedAuthor).toBe("River Member");
    expect(/^[0-9a-f]{64}$/.test(body.memberToken)).toBe(true);
    expect(harness.bound).toEqual([{ hash: sha256Hex(body.memberToken), name: "River Member" }]);
    expect(harness.inserts).toBe(2);
    expect(harness.cacheInvalidations).toBe(1);
  });

  it("rejects approve without a key, with the wrong key, and for a non-admin principal", async () => {
    const missing = await post("/tesseract-forum/applicants/7/approve");
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toEqual({
      ok: false,
      error: "Valid sovereign key required to post in the forum",
    });

    const wrong = await post("/tesseract-forum/applicants/7/approve", undefined, WRONG_KEY);
    expect(wrong.status).toBe(401);

    harness.principal = "visitor";
    const forbidden = await post("/tesseract-forum/applicants/7/approve", undefined, ADMIN_KEY);
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toEqual({
      ok: false,
      error: "Only Father/Admin may vet applicants",
    });
    expect(harness.inserts).toBe(0);
    expect(harness.bound).toEqual([]);
  });

  it("returns a generic approve error when a later insert fails", async () => {
    harness.insertFail = true;
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined as never);
    try {
      const response = await post("/tesseract-forum/applicants/7/approve", undefined, ADMIN_KEY);
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).not.toContain(MARKER);
      expect(JSON.parse(text)).toEqual({ ok: false, error: "applicant-approve-failed" });
      expect(harness.bound).toEqual([]);
      expect(errorSpy).toHaveBeenCalledWith({ name: "SyntheticFailure" }, "applicant approve failed");
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(MARKER);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("binds sha256 of the supplied token, including a trimmed token", async () => {
    const response = await post("/tesseract-forum/admin/register-principal", {
      token: MEMBER_TOKEN,
      principalName: "Aletheia",
    }, ADMIN_KEY);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: 'Token bound to "Aletheia" by Father',
    });
    expect(harness.bound).toEqual([{ hash: sha256Hex(MEMBER_TOKEN), name: "Aletheia" }]);

    harness.bound = [];
    const padded = await post("/tesseract-forum/admin/register-principal", {
      token: `  ${MEMBER_TOKEN}  `,
      principalName: "Aletheia",
    }, ADMIN_KEY);
    expect(padded.status).toBe(200);
    expect(harness.bound).toEqual([{ hash: sha256Hex(MEMBER_TOKEN), name: "Aletheia" }]);
  });

  it("rejects register-principal without a key, with the wrong key, and for a non-admin principal", async () => {
    const body = { token: MEMBER_TOKEN, principalName: "Aletheia" };
    const missing = await post("/tesseract-forum/admin/register-principal", body);
    expect(missing.status).toBe(401);

    const wrong = await post("/tesseract-forum/admin/register-principal", body, WRONG_KEY);
    expect(wrong.status).toBe(401);

    harness.principal = "visitor";
    const forbidden = await post("/tesseract-forum/admin/register-principal", body, ADMIN_KEY);
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toEqual({
      ok: false,
      error: 'Principal "visitor" does not have admin registration authority (requires Father or Admin)',
    });
    expect(harness.bound).toEqual([]);
  });

  it("rejects a short register-principal token before binding", async () => {
    const response = await post("/tesseract-forum/admin/register-principal", {
      token: "short",
      principalName: "Aletheia",
    }, ADMIN_KEY);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "token is too short (minimum 8 chars) or invalid",
    });
    expect(harness.bound).toEqual([]);
  });

  it("returns a generic register-principal error", async () => {
    harness.registerFail = true;
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined as never);
    try {
      const response = await post("/tesseract-forum/admin/register-principal", {
        token: MEMBER_TOKEN,
        principalName: "Aletheia",
      }, ADMIN_KEY);
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).not.toContain(MARKER);
      expect(JSON.parse(text)).toEqual({ ok: false, error: "principal-register-failed" });
      expect(errorSpy).toHaveBeenCalledWith({ name: "SyntheticFailure" }, "Failed to register principal");
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(MARKER);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
