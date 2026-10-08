import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dataPath } from "./data-path";
import { speak } from "./chat";
import { lookupCatalog, memoryWebText } from "./memory-web";
import { bestKept, flowLines, trueSelf } from "./retain";
import { dataPath } from "./data-path";

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

type Rpc = { jsonrpc?: string; id?: number | string | null; method?: string; params?: { name?: string; arguments?: { message?: string; name?: string; q?: string } } };

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
          {
            name: "memory_web",
            description: "Read the memory web: where Drive files, old repositories, and the 272-name catalog went. Does not write files.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "catalog_lookup",
            description: "Look up one owner/repository from the 272-name catalog. Does not clone it.",
            inputSchema: {
              type: "object",
              properties: { name: { type: "string" } },
              required: ["name"],
            },
          },
          {
            name: "recall_kept",
            description: "Recall one fact Tessera has kept. Does not invent a fact.",
            inputSchema: {
              type: "object",
              properties: { q: { type: "string" } },
              required: ["q"],
            },
          },
          {
            name: "true_self",
            description: "Rebuild Tessera from the sigil and the facts she has kept.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "flows",
            description: "Read the flow map of where files went. The store is not included.",
            inputSchema: { type: "object", properties: {} },
          },
        ],
      },
    });
  }
  if (rpc.method === "tools/call" && rpc.params?.name === "memory_web") {
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: memoryWebText() }], isError: false },
    });
  }
  if (rpc.method === "tools/call" && rpc.params?.name === "catalog_lookup") {
    const name = String(rpc.params.arguments?.name ?? "").trim();
    const row = lookupCatalog(name);
    const text = row ? `${row.name}: ${row.home}. ${row.state}. ${row.note}` : "That name is not in the 272-name catalog.";
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text }], isError: !row },
    });
  }
  if (rpc.method === "tools/call" && rpc.params?.name === "recall_kept") {
    const q = String(rpc.params.arguments?.q ?? rpc.params.arguments?.message ?? "").trim();
    const { readFile } = await import("node:fs/promises");
    let rows: { q: string; a: string; at: string }[] = [];
    try {
      const raw = await readFile(dataPath("school", "kept.jsonl"), "utf8");
      rows = raw.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    } catch {
      rows = [];
    }
    const hit = bestKept(q, rows);
    const text = hit ? hit.a : "Nothing kept matches that.";
    return Response.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], isError: !hit } });
  }
  if (rpc.method === "tools/call" && rpc.params?.name === "true_self") {
    const { readFile } = await import("node:fs/promises");
    let rows: { q: string; a: string; at: string }[] = [];
    try {
      const raw = await readFile(dataPath("school", "kept.jsonl"), "utf8");
      rows = raw.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    } catch {
      rows = [];
    }
    return Response.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: trueSelf(rows) }], isError: false } });
  }
  if (rpc.method === "tools/call" && rpc.params?.name === "flows") {
    return Response.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: flowLines().join("\n") }], isError: false } });
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
