import http from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { priorEnv, queryResult } = vi.hoisted(() => {
  const prior = {
    base: process.env.TESSERA_LLM_BASE_URL,
    key: process.env.TESSERA_LLM_API_KEY,
    model: process.env.TESSERA_LLM_MODEL,
    sandbox: process.env.SANDBOX_TRAINING_ALLOWED,
    noExternal: process.env.SOVEREIGN_NO_EXTERNAL_LLM,
  };
  process.env.TESSERA_LLM_BASE_URL = "https://127.0.0.1:9/v1";
  process.env.TESSERA_LLM_API_KEY = "unit-test-key";
  process.env.TESSERA_LLM_MODEL = "unit-test-model";
  process.env.SOVEREIGN_NO_EXTERNAL_LLM = "0";

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

  return { priorEnv: prior, queryResult };
});

vi.mock("@workspace/db", () => ({
  db: {
    insert: () => queryResult(undefined),
    update: () => queryResult(undefined),
    delete: () => queryResult(undefined),
    select: () => queryResult([]),
    execute: () => queryResult([]),
  },
  pool: { query: async () => ({ rows: [] }) },
}));

vi.mock("@workspace/db/schema", async () => vi.importActual<Record<string, unknown>>("@workspace/db/schema"));

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
  if (priorEnv.noExternal === undefined) delete process.env.SOVEREIGN_NO_EXTERNAL_LLM;
  else process.env.SOVEREIGN_NO_EXTERNAL_LLM = priorEnv.noExternal;
}

function ownerCookie(): string {
  process.env.TESSERACT_ADMIN_KEY = "synthetic-owner-token";
  process.env.SOVEREIGN_SESSION_SECRET = "syn*****!!";
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
      "127.0.0.1",
    ]));
  });

  it("runs /rick/chat streaming inside runWithShepherdContext", async () => {
    const res = await postJson(app, "/rick/chat", {
      messages: [{ role: "user", content: "coolant loop status" }],
      stream: true,
    });

    expect(res.status).toBe(200);
    const llm = seen.find((entry) => entry.url.startsWith("https://127.0.0.1:9/"));
    expect(llm?.caller).toBe("shepherd-proxy");
    expect(llm?.url).toBe("https://127.0.0.1:9/v1/chat/completions");
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
        content: "Describe the difference between a hash map and a balanced tree for range queries?",
      },
      { "x-sandbox-training": "true", cookie: ownerCookie() },
    );

    expect(res.status).toBe(200);
    const llm = seen.find((entry) => entry.url.startsWith("https://127.0.0.1:9/"));
    expect(llm?.caller).toBe("shepherd-proxy");
    expect(llm?.url).toBe("https://127.0.0.1:9/v1/chat/completions");
    const parsed = JSON.parse(llm?.body ?? "{}") as {
      stream?: boolean;
      temperature?: number;
      model?: string;
    };
    expect(parsed.stream).toBe(false);
    expect(parsed.temperature).toBe(0.7);
    expect(parsed.model).toBe("unit-test-model");
  }, 20_000);

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
