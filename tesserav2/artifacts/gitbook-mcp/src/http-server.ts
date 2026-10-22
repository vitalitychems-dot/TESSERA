import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { invokeTool, TOOL_DEFINITIONS, type GitbookService } from "./service.js";

const MAX_BODY = 2_000_000;

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new Error("request body exceeds 2MB");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const POST_TOOLS = new Set([
  "search_docs",
  "read_page",
  "list_pages",
  "get_board",
  "post_board_update",
  "read_handoff",
  "write_handoff",
  "propose_page_change",
  "recent_changes",
  "route_task",
]);

function argsFromQuery(url: URL, tool: string): Record<string, unknown> {
  if (tool === "list_pages") return { dir: url.searchParams.get("dir") ?? "" };
  if (tool === "read_page") return { path: url.searchParams.get("path") ?? "" };
  if (tool === "search_docs") return { query: url.searchParams.get("query") ?? "" };
  if (tool === "route_task") return { description: url.searchParams.get("description") ?? "" };
  return {};
}

export function createHttpServer(service: GitbookService) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/health") {
        send(res, 200, { ok: true, service: "tessera-gitbook-mcp" });
        return;
      }
      if (req.method === "GET" && url.pathname === "/v1/tools") {
        send(res, 200, { ok: true, data: TOOL_DEFINITIONS });
        return;
      }
      const match = /^\/v1\/([a-z_]+)$/.exec(url.pathname);
      if (!match || !POST_TOOLS.has(match[1] ?? "")) {
        send(res, 404, { ok: false, error: "Unknown endpoint" });
        return;
      }
      const tool = match[1] ?? "";
      let args: Record<string, unknown> = {};
      if (req.method === "GET") {
        args = argsFromQuery(url, tool);
      } else if (req.method === "POST") {
        const raw = await readBody(req);
        if (raw.trim()) {
          const parsed = JSON.parse(raw) as unknown;
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            send(res, 400, { ok: false, error: "JSON body must be an object" });
            return;
          }
          args = parsed as Record<string, unknown>;
        }
      } else {
        send(res, 405, { ok: false, error: "Use GET or POST" });
        return;
      }
      const data = await invokeTool(service, tool, args);
      send(res, 200, { ok: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      const status = message.includes("GITBOOK_GITHUB_TOKEN") ? 503 : 400;
      send(res, status, { ok: false, error: message });
    }
  });
}
