import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { penChatCompletion, penEmbeddings } from "../lib/pen-provider";

const packageRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

const classAPaths = [
  resolve(packageRoot, "src/lib/llm-client.ts"),
  resolve(packageRoot, "src/lib/neural-embeddings.ts"),
  resolve(packageRoot, "src/lib/pen-provider.ts"),
  resolve(packageRoot, "package.json"),
  resolve(packageRoot, "../../archives/source-variants/T44/main/artifacts/api-server/src/lib/llm-client.ts"),
];

describe("pen provider", () => {
  const originalBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const originalKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  let server: Server | undefined;

  afterEach(async () => {
    if (originalBase === undefined) delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    else process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = originalBase;
    if (originalKey === undefined) delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    else process.env.AI_INTEGRATIONS_OPENAI_API_KEY = originalKey;
    if (!server) return;
    const closing = server;
    server = undefined;
    await new Promise<void>((resolveClose, reject) => {
      closing.close((error) => (error ? reject(error) : resolveClose()));
    });
  });

  it("does not call the network when the base URL is unset", async () => {
    delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    await expect(
      penChatCompletion({
        model: "m",
        max_completion_tokens: 8,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("AI_INTEGRATIONS_OPENAI_BASE_URL not set");
  });

  it("posts chat completions and embeddings without the OpenAI SDK", async () => {
    const seen: Array<{ url: string | undefined; auth: string | undefined; body: unknown }> = [];
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        const body: unknown = JSON.parse(raw);
        seen.push({
          url: req.url,
          auth: req.headers.authorization,
          body,
        });
        res.setHeader("content-type", "application/json");
        if (req.url === "/chat/completions") {
          res.end(JSON.stringify({ choices: [{ message: { content: "pen-ok" } }] }));
          return;
        }
        if (req.url === "/embeddings") {
          const input = (body as { input?: string | string[] }).input;
          const inputs = Array.isArray(input) ? input : [input ?? ""];
          res.end(JSON.stringify({
            data: inputs.map((text, index) => ({ index, embedding: [text.length, index] })),
          }));
          return;
        }
        res.statusCode = 404;
        res.end("{}");
      });
    });
    await new Promise<void>((resolveListen) => {
      server?.listen(0, "127.0.0.1", () => resolveListen());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = `http://127.0.0.1:${address.port}/`;
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test-key";

    const chat = await penChatCompletion({
      model: "GLM-5",
      max_completion_tokens: 16,
      messages: [{ role: "user", content: "hi" }],
    });
    const embeddings = await penEmbeddings({
      model: "text-embedding-3-small",
      input: ["ab", "cdef"],
    });

    expect(chat.choices?.[0]?.message?.content).toBe("pen-ok");
    expect(embeddings.data?.map((item) => item.embedding)).toEqual([[2, 0], [4, 1]]);
    expect(seen.map((call) => call.url)).toEqual(["/chat/completions", "/embeddings"]);
    expect(seen.every((call) => call.auth === "Bearer test-key")).toBe(true);
  });

  it("has zero Class A SDK imports and caret dependencies", () => {
    const bannedImport = ["import OpenAI from", '"openai"'].join(" ");
    const bannedDep = ['"openai":', '"^'].join(" ");
    for (const path of classAPaths) {
      const text = readFileSync(path, "utf8");
      expect(text.includes(bannedImport)).toBe(false);
      expect(text.includes(bannedDep)).toBe(false);
    }
  });
});
