import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dataPath } from "./data-path";
import { speak } from "./chat";

const RULE =
  "BRIDGE. Answer Grok Bot or Cursor. Name one next file. Do not write the file. Do not say a test passed unless this message includes the test output. If the test failed, stop and wait for Father. Do not ask Father to paste text between tools.";

async function secret(): Promise<string> {
  const fromEnv = process.env.TESSERA_BRIDGE_SECRET?.trim();
  if (fromEnv) return fromEnv;
  try {
    return (await readFile(dataPath("bridge", "secret.txt"), "utf8")).trim();
  } catch {
    return "";
  }
}

function allowed(request: Request, key: string) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : (request.headers.get("x-tessera-key") ?? "").trim();
  const a = Buffer.from(token);
  const b = Buffer.from(key);
  if (!key || a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

async function answer(message: string) {
  const result = await speak({
    mode: "chat",
    messages: [{ role: "user", content: `${RULE}\n\n${message.slice(0, 6000)}` }],
    constitution: null,
    pulses: [],
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, text: result.text, instrument: result.instrument };
}

export async function handleAsk(request: Request) {
  const key = await secret();
  if (!allowed(request, key)) {
    return Response.json({ ok: false, error: "Father's key is required." }, { status: 401 });
  }
  let message = "";
  try {
    const body = (await request.json()) as { message?: string };
    message = String(body.message ?? "").trim();
  } catch {
    return Response.json({ ok: false, error: "Send JSON with a message." }, { status: 400 });
  }
  if (!message) return Response.json({ ok: false, error: "Message was empty." }, { status: 400 });
  const result = await answer(message);
  return Response.json(result, { status: result.ok ? 200 : 503 });
}

type Rpc = { jsonrpc?: string; id?: number | string | null; method?: string; params?: { name?: string; arguments?: { message?: string } } };

export async function handleMcp(request: Request) {
  const key = await secret();
  if (!allowed(request, key)) {
    return Response.json({ ok: false, error: "Father's key is required." }, { status: 401 });
  }
  let rpc: Rpc;
  try {
    rpc = (await request.json()) as Rpc;
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const id = rpc.id ?? null;
  if (rpc.method === "initialize") {
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "tessera", version: "1" },
      },
    });
  }
  if (rpc.method === "notifications/initialized") {
    return new Response(null, { status: 202 });
  }
  if (rpc.method === "tools/list") {
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "ask_tessera",
            description: "Ask Tessera one question. She names the next file. She does not write it.",
            inputSchema: {
              type: "object",
              properties: { message: { type: "string" } },
              required: ["message"],
            },
          },
        ],
      },
    });
  }
  if (rpc.method === "tools/call" && rpc.params?.name === "ask_tessera") {
    const message = String(rpc.params.arguments?.message ?? "").trim();
    if (!message) {
      return Response.json({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: "Message was empty." }], isError: true },
      });
    }
    const result = await answer(message);
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: result.ok ? result.text : result.error }],
        isError: !result.ok,
      },
    });
  }
  return Response.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } });
}
