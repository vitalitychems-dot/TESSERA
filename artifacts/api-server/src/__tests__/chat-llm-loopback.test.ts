import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  CHAT_LLM_URL_REFUSED,
  decideChatLlmBaseUrl,
  resolveChatLlmBaseUrl,
  tesseraChatCompletion,
} from "../lib/tessera-llm-http";

const ACCEPTED = [
  "http://127.0.0.1:9/v1",
  "http://127.0.0.1/v1",
  "https://127.0.0.1:443/v1",
  "HTTP://127.0.0.1:9/v1",
  "http://[::1]:9/v1",
  "https://[::1]/v1",
  "http://127.0.0.1:9/v1/",
];

const REJECTED = [
  "http://localhost:9/v1",
  "http://localhost/v1",
  "https://localhost/v1",
  "http://127.0.0.1.example/v1",
  "http://user:pass@127.0.0.1:9/v1",
  "http://127.0.0.1:9@chat.example/v1",
  "ftp://127.0.0.1:9/v1",
  "file:///etc/passwd",
  "javascript:alert(1)",
  "http://2130706433/v1",
  "http://0x7f000001/v1",
  "http://127.1/v1",
  "http://0177.0.0.1/v1",
  "http://[::ffff:127.0.0.1]/v1",
  "http://0.0.0.0:9/v1",
  "https://chat.example/v1",
  "http://chat.example/v1",
  "ws://127.0.0.1:9/v1",
];

const GUARDS = [undefined, "1", "true", "TRUE", "0", "false", ""] as const;

describe("chat TESSERA_LLM_BASE_URL loopback policy", () => {
  const originalBase = process.env.TESSERA_LLM_BASE_URL;
  const originalKey = process.env.TESSERA_LLM_API_KEY;
  const originalGuard = process.env.SOVEREIGN_NO_EXTERNAL_LLM;
  let server: Server | undefined;

  afterEach(async () => {
    restore("TESSERA_LLM_BASE_URL", originalBase);
    restore("TESSERA_LLM_API_KEY", originalKey);
    restore("SOVEREIGN_NO_EXTERNAL_LLM", originalGuard);
    if (!server) return;
    const closing = server;
    server = undefined;
    await new Promise<void>((resolveClose, reject) => {
      closing.close((error) => (error ? reject(error) : resolveClose()));
    });
  });

  it("accepts only literal loopback http(s) URLs with the sovereign guard on or off", () => {
    for (const guard of GUARDS) {
      const env = envWithGuard(guard);
      for (const raw of ACCEPTED) {
        const decision = decideChatLlmBaseUrl(raw, env);
        expect(decision.ok, `${guard ?? "unset"} ${raw}`).toBe(true);
        if (!decision.ok) continue;
        expect(decision.href).not.toContain("@");
        expect(decision.href.includes("127.0.0.1") || decision.href.includes("[::1]")).toBe(true);
      }
      for (const raw of REJECTED) {
        expect(decideChatLlmBaseUrl(raw, env), `${guard ?? "unset"} ${raw}`).toEqual({
          ok: false,
          code: "refused",
        });
        expect(() => resolveChatLlmBaseUrl(raw, env)).toThrow(CHAT_LLM_URL_REFUSED);
        try {
          resolveChatLlmBaseUrl(raw, env);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          expect(message).toBe(CHAT_LLM_URL_REFUSED);
          expect(message).not.toContain(raw);
          expect(message).not.toContain("chat.example");
          expect(message).not.toContain("localhost");
        }
      }
    }
  });

  it("does not fetch when a non-loopback chat URL is refused", async () => {
    let calls = 0;
    const original = globalThis.fetch;
    globalThis.fetch = async () => {
      calls += 1;
      throw new Error("fetch should not run");
    };
    process.env.TESSERA_LLM_BASE_URL = "https://chat.example/secret-v1";
    process.env.TESSERA_LLM_API_KEY = "test-key";
    process.env.SOVEREIGN_NO_EXTERNAL_LLM = "0";
    try {
      await expect(
        tesseraChatCompletion({
          model: "m",
          max_completion_tokens: 8,
          messages: [{ role: "user", content: "hi" }],
        }),
      ).rejects.toThrow(CHAT_LLM_URL_REFUSED);
      expect(calls).toBe(0);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("does not follow a loopback redirect and does not echo the target", async () => {
    const hits: string[] = [];
    server = createServer((req, res) => {
      hits.push(req.url ?? "");
      res.statusCode = 302;
      res.setHeader("Location", "http://chat.example/secret-target-token");
      res.end("redirect-body-secret-target-token");
    });
    await new Promise<void>((resolveListen) => {
      server?.listen(0, "127.0.0.1", () => resolveListen());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    process.env.TESSERA_LLM_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
    process.env.TESSERA_LLM_API_KEY = "test-key";
    process.env.SOVEREIGN_NO_EXTERNAL_LLM = "0";

    await expect(
      tesseraChatCompletion({
        model: "m",
        max_completion_tokens: 8,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow(CHAT_LLM_URL_REFUSED);
    try {
      await tesseraChatCompletion({
        model: "m",
        max_completion_tokens: 8,
        messages: [{ role: "user", content: "hi" }],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toBe(CHAT_LLM_URL_REFUSED);
      expect(message).not.toContain("secret-target-token");
      expect(message).not.toContain("chat.example");
      expect(message).not.toContain(String(address.port));
    }
    expect(hits).toEqual(["/v1/chat/completions", "/v1/chat/completions"]);
  });
});

function envWithGuard(guard: (typeof GUARDS)[number]): NodeJS.ProcessEnv {
  const env = {} as NodeJS.ProcessEnv;
  if (guard !== undefined) env.SOVEREIGN_NO_EXTERNAL_LLM = guard;
  return env;
}

function restore(name: "TESSERA_LLM_BASE_URL" | "TESSERA_LLM_API_KEY" | "SOVEREIGN_NO_EXTERNAL_LLM", value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
