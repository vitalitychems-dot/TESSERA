import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { tesseraChatCompletion, tesseraEmbeddings } from "../lib/tessera-llm-http";

const packageRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

const classAPaths = [
  resolve(packageRoot, "src/lib/llm-client.ts"),
  resolve(packageRoot, "src/lib/neural-embeddings.ts"),
  resolve(packageRoot, "src/lib/tessera-llm-http.ts"),
  resolve(packageRoot, "package.json"),
];

describe("tessera llm http", () => {
  const originalBase = process.env.TESSERA_LLM_BASE_URL;
  const originalKey = process.env.TESSERA_LLM_API_KEY;
  let server: Server | undefined;

  afterEach(async () => {
    if (originalBase === undefined) delete process.env.TESSERA_LLM_BASE_URL;
    else process.env.TESSERA_LLM_BASE_URL = originalBase;
    if (originalKey === undefined) delete process.env.TESSERA_LLM_API_KEY;
    else process.env.TESSERA_LLM_API_KEY = originalKey;
    if (!server) return;
    const closing = server;
    server = undefined;
    await new Promise<void>((resolveClose, reject) => {
      closing.close((error) => (error ? reject(error) : resolveClose()));
    });
  });

  it("does not call the network when the base URL is unset", async () => {
    delete process.env.TESSERA_LLM_BASE_URL;
    await expect(
      tesseraChatCompletion({
        model: "m",
        max_completion_tokens: 8,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("TESSERA_LLM_BASE_URL not set");
  });

  it("does not call the network when the API key is unset", async () => {
    process.env.TESSERA_LLM_BASE_URL = "http://127.0.0.1:9";
    delete process.env.TESSERA_LLM_API_KEY;
    await expect(
      tesseraChatCompletion({
        model: "m",
        max_completion_tokens: 8,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("TESSERA_LLM_API_KEY not set");
  });

  it("posts chat completions and embeddings", async () => {
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
          res.end(JSON.stringify({ choices: [{ message: { content: "llm-ok" } }] }));
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
    process.env.TESSERA_LLM_BASE_URL = `http://127.0.0.1:${address.port}/`;
    process.env.TESSERA_LLM_API_KEY = "test-key";

    const chat = await tesseraChatCompletion({
      model: "GLM-5",
      max_completion_tokens: 16,
      messages: [{ role: "user", content: "hi" }],
    });
    const embeddings = await tesseraEmbeddings({
      model: "text-embedding-3-small",
      input: ["ab", "cdef"],
    });

    expect(chat.choices?.[0]?.message?.content).toBe("llm-ok");
    expect(embeddings.data?.map((item) => item.embedding)).toEqual([[2, 0], [4, 1]]);
    expect(seen.map((call) => call.url)).toEqual(["/chat/completions", "/embeddings"]);
    expect(seen.every((call) => call.auth === "Bearer test-key")).toBe(true);
  });

  it("has zero Class A SDK imports, caret dependencies, and the old integration slot", () => {
    const bannedImport = ["import", "Open" + "AI", "from", '"' + "openai" + '"'].join(" ");
    const bannedDep = ['"' + "openai" + '":', '"^'].join(" ");
    const staleSlot = ["AI_INTEGRATIONS_", "OPEN" + "AI_"].join("");
    for (const path of classAPaths) {
      const text = readFileSync(path, "utf8");
      expect(text.includes(bannedImport)).toBe(false);
      expect(text.includes(bannedDep)).toBe(false);
      expect(text.includes(staleSlot)).toBe(false);
    }
  });
});
