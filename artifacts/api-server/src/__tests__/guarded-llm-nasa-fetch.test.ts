import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { priorEnv, queryResult, penMock } = vi.hoisted(() => {
  const prior = {
    base: process.env.TESSERA_LLM_BASE_URL,
    key: process.env.TESSERA_LLM_API_KEY,
    model: process.env.TESSERA_LLM_MODEL,
    sandbox: process.env.SANDBOX_TRAINING_ALLOWED,
  };
  process.env.TESSERA_LLM_BASE_URL = "https://llm.tessera.test/v1";
  process.env.TESSERA_LLM_API_KEY = "unit-test-key";
  process.env.TESSERA_LLM_MODEL = "unit-test-model";

  function queryResult(value: unknown): any {
    const promise = Promise.resolve(value);
    const call = () => queryResult(value);
    return new Proxy(call, {
      get(_target, prop) {
        if (prop === "then") return promise.then.bind(promise);
        if (prop === "catch") return promise.catch.bind(promise);
        if (prop === "finally") return promise.finally.bind(promise);
        return call;
      },
      apply() {
        return queryResult(value);
      },
    });
  }

  return { priorEnv: prior, queryResult, penMock: { mode: "disabled" as string } };
});

vi.mock("@workspace/db", async () => {
  const schema = await vi.importActual<Record<string, unknown>>("@workspace/db/schema");
  return {
    db: {
      insert: (table: unknown) => queryResult(
        table === schema.providerCallsTable ? [{ id: 1 }] : undefined,
      ),
      update: () => queryResult(undefined),
      delete: () => queryResult(undefined),
      select: () => queryResult([]),
      execute: () => queryResult([]),
    },
    pool: { query: async () => ({ rows: [] }) },
    providerCallsTable: schema.providerCallsTable,
  };
});

vi.mock("@workspace/db/schema", async () => vi.importActual<Record<string, unknown>>("@workspace/db/schema"));

vi.mock("../lib/chat-sigil-store", async () => {
  const actual = await vi.importActual<typeof import("../lib/chat-sigil-store")>("../lib/chat-sigil-store");
  return {
    ...actual,
    // This suite verifies outbound LLM routing, not sigil rotation. The
    // dedicated sigil-tool-owner-gate suite exercises that fail-closed gate.
    requireChatSigil: async (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

vi.mock("../lib/shepherd-outbound", () => ({
  classifyCaller: (caller: string | undefined | null) => {
    const normalized = caller?.trim().toLowerCase() ?? "";
    if (normalized === "shepherd-proxy" || normalized.startsWith("shepherd-")) return "shepherd";
    return "unknown";
  },
  recordShepherdAudit: vi.fn(async () => undefined),
  ConsciousAgentOutboundRefused: class ConsciousAgentOutboundRefused extends Error {
    constructor(caller: string, url: string) {
      super(
        `SOVEREIGN POLICY: conscious agent "${caller}" attempted direct external call to "${url}". Refused — must be routed via Shepherd proxy.`,
      );
      this.name = "ConsciousAgentOutboundRefused";
    }
  },
}));

vi.mock("../lib/rick-autonomous-loop", () => ({
  getRickAutonomousHeartbeat: () => ({ ok: true }),
  listAutonomousInventions: async () => [],
  RICK_AUTONOMOUS_CATEGORIES: [],
}));

vi.mock("../lib/tessera-chat-model", () => ({
  getTesseraChatModelStatus: () => penMock.mode === "disabled"
    ? { enabled: false, reason: "disabled" }
    : { enabled: true, model: "configured-model" },
  draftTesseraChatReply: async (_content: string, evidence: unknown[]) => {
    if (penMock.mode === "failure") return { ok: false, reason: "provider-unavailable" };
    const citedEvidence = evidence.length > 0 ? [evidence[0]] : [];
    return {
      ok: true,
      draft: {
        answer: "Quantum entanglement describes correlations between measurements of separated quantum systems.",
        model: "unit-test-actual-model",
        evidence: citedEvidence,
        provenance: citedEvidence.length > 0 ? "retrieved-evidence" : "unverified-model-knowledge",
      },
    };
  },
}));

import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import { getShepherdContext, installSovereignFetchGuard } from "../lib/sovereign-fetch-guard";
import { getAllowedDomains, secureExternalBinaryFetch } from "../lib/secureExternalWrapper";
import rickRouter from "../routes/rick";
import conversationsRouter from "../routes/conversations";
import { generateFreshProposals } from "../lib/rick-proposals";

const originalFetch = globalThis.fetch;

type SeenFetch = { url: string; caller: string | null; body: string };

const seen: SeenFetch[] = [];

const networkFetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const body = typeof init?.body === "string" ? init.body : "";
  seen.push({ url, caller: getShepherdContext()?.caller ?? null, body });

  if (url.includes("images-api.nasa.gov")) {
    return new Response(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    });
  }

  if (body.includes('"stream":true')) {
    const streamBody = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "guarded stream ok" } }] })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n");
    return new Response(streamBody, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }

  return new Response(
    JSON.stringify({
      choices: [{
        message: {
          content: "A hash map answers point lookup in constant time. A balanced tree answers range queries by walking an ordered span. Rotations keep sibling heights within one.",
        },
      }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});

function restoreEnv(): void {
  if (priorEnv.base === undefined) delete process.env.TESSERA_LLM_BASE_URL;
  else process.env.TESSERA_LLM_BASE_URL = priorEnv.base;
  if (priorEnv.key === undefined) delete process.env.TESSERA_LLM_API_KEY;
  else process.env.TESSERA_LLM_API_KEY = priorEnv.key;
  if (priorEnv.model === undefined) delete process.env.TESSERA_LLM_MODEL;
  else process.env.TESSERA_LLM_MODEL = priorEnv.model;
  if (priorEnv.sandbox === undefined) delete process.env.SANDBOX_TRAINING_ALLOWED;
  else process.env.SANDBOX_TRAINING_ALLOWED = priorEnv.sandbox;
}

function ownerCookie(): string {
  process.env.TESSERACT_ADMIN_KEY = "synthetic-owner-token";
  process.env.SOVEREIGN_SESSION_SECRET = "synthetic-session-secret-32chars!!";
  const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
  return `${SESSION_COOKIE}=${issued.signedId}`;
}

function postJson(
  app: express.Express,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("test server did not bind a port"));
        return;
      }
      const payload = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: address.port,
          path,
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
            ...headers,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const status = res.statusCode ?? 0;
            const text = Buffer.concat(chunks).toString("utf8");
            server.close(() => resolve({ status, text }));
          });
        },
      );
      req.on("error", (err) => {
        server.close(() => reject(err));
      });
      req.write(payload);
      req.end();
    });
  });
}

describe("guarded LLM and NASA fetch", () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(rickRouter);
  app.use(conversationsRouter);

  beforeAll(() => {
    vi.stubGlobal("fetch", networkFetch);
    installSovereignFetchGuard();
  });

  beforeEach(() => {
    seen.length = 0;
    networkFetch.mockClear();
    penMock.mode = "disabled";
  });

  afterAll(() => {
    vi.stubGlobal("fetch", originalFetch);
    restoreEnv();
  });

  it("allows a NASA host through secureExternalBinaryFetch with the index.ts fetch guard installed", async () => {
    await expect(fetch("https://images-api.nasa.gov/direct-without-shepherd")).rejects.toThrow(/SOVEREIGN POLICY/);
    expect(networkFetch).not.toHaveBeenCalled();

    const result = await secureExternalBinaryFetch("https://images-api.nasa.gov/asset/unit-test", {
      requestedBy: "nasa-image-proxy",
    });

    expect(result.status).toBe(200);
    expect(result.contentType.startsWith("image/")).toBe(true);
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(seen).toEqual([
      expect.objectContaining({
        url: "https://images-api.nasa.gov/asset/unit-test",
        caller: "shepherd-proxy",
      }),
    ]);
    expect(getAllowedDomains()).toEqual(expect.arrayContaining([
      "images-api.nasa.gov",
      "images-assets.nasa.gov",
      "images-orig.nasa.gov",
      "api.nasa.gov",
      "llm.tessera.test",
    ]));
  });

  it("runs /rick/chat streaming inside runWithShepherdContext", async () => {
    const res = await postJson(app, "/rick/chat", {
      messages: [{ role: "user", content: "coolant loop status" }],
      stream: true,
    });

    expect(res.status).toBe(200);
    const llm = seen.find((entry) => entry.url.startsWith("https://llm.tessera.test/"));
    expect(llm?.caller).toBe("shepherd-proxy");
    expect(llm?.url).toBe("https://llm.tessera.test/v1/chat/completions");
    const parsed = JSON.parse(llm?.body ?? "{}") as {
      stream?: boolean;
      temperature?: number;
      model?: string;
    };
    expect(parsed.stream).toBe(true);
    expect(parsed.temperature).toBe(0.9);
    expect(parsed.model).toBe("unit-test-model");
  });

  it("runs the conversations LLM path inside runWithShepherdContext", async () => {
    process.env.SANDBOX_TRAINING_ALLOWED = "true";
    const res = await postJson(
      app,
      "/messages",
      {
        conversationId: 7,
        content: "Explain quantum entanglement in simple terms",
      },
      { "x-sandbox-training": "true", cookie: ownerCookie() },
    );

    expect(res.status).toBe(200);
    expect(res.text).toContain("Unverified note from the built-in catalog — Quantum Physics");
    expect(res.text).toContain("Quantum entanglement connects particles");
    expect(res.text).toContain("[1]");
    expect(res.text).toContain("artifacts/api-server/src/lib/tessera-knowledge.ts#TESSERA_SUBJECTS.quantum-physics");
    expect(res.text).toContain("\"trustStatus\":\"unverified\"");
    expect(res.text).toContain("\"sourceUrl\":null");
    expect(res.text).toContain("\"retrievedAt\":null");
    expect(res.text).not.toContain("A hash map answers");
    expect(res.text).not.toContain("**Sources:**");
    expect(res.text).toContain("\"authorRole\":\"local\"");
    expect(res.text).toContain("\"model\":null");
    expect(res.text).toContain("no configured model authored this reply");
    expect(res.text).toContain("✦");
    const llm = seen.find((entry) => entry.url.startsWith("https://llm.tessera.test/"));
    expect(llm?.caller).toBe("shepherd-proxy");
    expect(llm?.url).toBe("https://llm.tessera.test/v1/chat/completions");
    const parsed = JSON.parse(llm?.body ?? "{}") as {
      stream?: boolean;
      temperature?: number;
      model?: string;
    };
    expect(parsed.stream).toBe(false);
    expect(parsed.temperature).toBe(0.7);
    expect(parsed.model).toBe("unit-test-model");
  }, 20_000);

  it("reports model-drafting status and labels the final configured-model provenance", async () => {
    penMock.mode = "success";

    const res = await postJson(
      app,
      "/messages",
      {
        conversationId: 7,
        content: "Explain quantum entanglement in simple terms",
      },
      { cookie: ownerCookie() },
    );

    expect(res.status).toBe(200);
    expect(res.text).toContain("\"authorRole\":\"model-drafting\"");
    expect(res.text).toContain("\"authorRole\":\"model-authored\"");
    expect(res.text).toContain("\"model\":\"unit-test-actual-model\"");
    expect(res.text).toContain("Draft attribution: Tessera Pen");
    expect(res.text).toContain("Retrieved evidence is cited by the application.");
    expect(res.text).toContain("\"modelAuthored\":true");
    expect(res.text).toContain("\"tools\":[]");
  });

  it("labels a provider failure as a local fallback instead of claiming model authorship", async () => {
    penMock.mode = "failure";

    const res = await postJson(
      app,
      "/messages",
      {
        conversationId: 7,
        content: "Explain quantum entanglement in simple terms",
      },
      { cookie: ownerCookie() },
    );

    expect(res.status).toBe(200);
    expect(res.text).toContain("\"authorRole\":\"local-fallback\"");
    expect(res.text).toContain("\"model\":null");
    expect(res.text).toContain("no model authored this reply");
    expect(res.text).not.toContain("Draft attribution: Tessera Pen");
    expect(res.text).toContain("\"modelAuthored\":false");
  });

  describe("blank or spaces-only TESSERA_LLM_API_KEY", () => {
    const blankKeys = [
      { label: "blank", value: "" },
      { label: "spaces-only", value: "   " },
    ] as const;

    async function withApiKey(value: string, run: () => Promise<void>): Promise<void> {
      const previous = process.env.TESSERA_LLM_API_KEY;
      process.env.TESSERA_LLM_API_KEY = value;
      try {
        await run();
      } finally {
        if (previous === undefined) delete process.env.TESSERA_LLM_API_KEY;
        else process.env.TESSERA_LLM_API_KEY = previous;
      }
    }

    for (const blankKey of blankKeys) {
      it(`rick /rick/chat makes no fetch when the key is ${blankKey.label}`, async () => {
        await withApiKey(blankKey.value, async () => {
          const res = await postJson(app, "/rick/chat", {
            messages: [{ role: "user", content: "coolant loop status" }],
            stream: true,
          });
          expect(res.status).toBe(200);
          expect(networkFetch).not.toHaveBeenCalled();
        });
      });

      it(`conversations /messages makes no fetch when the key is ${blankKey.label}`, async () => {
        await withApiKey(blankKey.value, async () => {
          process.env.SANDBOX_TRAINING_ALLOWED = "true";
          const res = await postJson(
            app,
            "/messages",
            {
              conversationId: 7,
              content: "Describe the difference between a hash map and a balanced tree for range queries?",
            },
            { "x-sandbox-training": "true", cookie: ownerCookie() },
          );
          expect(res.status).toBe(200);
          expect(networkFetch).not.toHaveBeenCalled();
        });
      }, 20_000);

      it(`rick-proposals generateFreshProposals makes no fetch when the key is ${blankKey.label}`, async () => {
        await withApiKey(blankKey.value, async () => {
          const proposals = await generateFreshProposals(1);
          expect(proposals.length).toBeGreaterThan(0);
          expect(networkFetch).not.toHaveBeenCalled();
        });
      });
    }
  });
});
